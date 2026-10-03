/* ============================================================
   Tadreej — Stepped Quran Reciter (engine)
   DOM-free: the engine drives one <audio> element and MediaSession,
   and emits UI snapshots via onChange. React renders; the engine
   never touches the DOM.

   Key mechanics:
   - Session token cancels in-flight playback on stop / page change.
   - Background playback: every gap between ayahs is filled with REAL
     silent audio (generated WAV data URIs), never setTimeout — iOS
     freezes JS timers and suspends the page when audio goes idle, so
     continuous audio keeps the session alive with the screen locked.
   - kick() begins audio synchronously inside a user gesture so
     Safari/iOS unlocks the <audio> element.
   ============================================================ */

import {
  clampPage,
  clampSurah,
  expandPage,
  expandSurah,
  normalizeRange,
  pageOf,
  rangePillLabel,
  resolveRange,
  surahMeta,
  type PageRange,
  type RangeEnd,
  type UnitRef,
} from './range';
import { DEFAULT_RECITER, EVERYAYAH_BASE, buildReciters, resolveReciterId } from './reciters';
import { activeWord, alignWords, parseWordsPage, wordsUrl, type AyahWords, type WordView } from './words';

const TEXT_API = 'https://api.alquran.cloud/v1/page';
const TEXT_SURAH_API = 'https://api.alquran.cloud/v1/surah';
const LS = 'tadreej.v1';
const LS_RECENT = 'tadreej.recent';

/** The reciters this build offers. Sufi and Noreen join the seven
 *  everyayah.com reciters only when VITE_EXTRA_AUDIO_BASE is set. */
export const RECITERS = buildReciters(import.meta.env.VITE_EXTRA_AUDIO_BASE);
export const HAS_EXTRA_AUDIO = RECITERS.some((r) => r.base !== undefined);

export interface TadreejSettings {
  unit: 'page' | 'surah' | 'range';
  page: number;
  surah: number;
  /** Range unit: start page, and where it stops. `toPage` is only read when
   *  `rangeEnd === 'page'`, so toggling end mode never loses the other choice. */
  fromPage: number;
  rangeEnd: RangeEnd;
  toPage: number;
  mode: 'stepped' | 'loop';
  reciter: string;
  reps: number;
  stepPause: number;
  ayahGap: number;
  repeatPage: boolean;
  /** Show each word's translation under it. While on, the app calls the Quran.com API. */
  wordByWord: boolean;
  playing?: boolean;
}

const DEFAULTS: TadreejSettings = {
  unit: 'page', page: 1, surah: 1,
  fromPage: 1, rangeEnd: 'surah', toPage: 1,
  mode: 'stepped', reciter: DEFAULT_RECITER,
  reps: 1, stepPause: 1, ayahGap: 0.4, repeatPage: true, wordByWord: true,
};

/** Everything the UI needs to render, pushed on every change. */
export interface UiState {
  settings: TadreejSettings;
  ready: boolean;            // data loaded, unit expanded
  playing: boolean;
  gateVisible: boolean;      // tap-to-play fallback overlay
  surahAr: string;
  surahEn: string;
  ayahText: string;
  words: WordView[] | null;  // the ayah word by word, or null to show ayahText
  stepLabel: string;
  meterCount: number;        // segments in the verse meter
  meterStep: number;         // scope of current step
  meterPos: number;          // 0-based index of ayah sounding now (-1 = none)
  recent: number[];
  unitLabel: string;         // pill caption: "Page" / "Surah" / "Pages"
  unitValue: string;         // pill value: "4" / "67" / "563–564"
  unitNoun: string;          // "page" / "surah" / "range", for settings copy
}

const pad3 = (n: number) => String(n).padStart(3, '0');

export function getRecent(): number[] {
  try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch { return []; }
}

function setRecent(r: number[]) {
  try { localStorage.setItem(LS_RECENT, JSON.stringify(r)); } catch { /* noop */ }
}

/** The status line under the verse meter. `pos` is the 0-based index of the
 *  ayah sounding now, or -1 before playback. */
export function stepLabel(count: number, mode: TadreejSettings['mode'], step: number, pos: number): string {
  if (!count) return 'Loading…';
  if (pos < 0) return `Ready · ${count} ayah${count === 1 ? '' : 's'}`;
  return mode === 'stepped' ? `Step ${step} / ${count} · ayah ${pos + 1}` : `Ayah ${pos + 1} / ${count} · loop`;
}

export class TadreejEngine {
  state: TadreejSettings = { ...DEFAULTS };
  ayahs: UnitRef[] = [];
  textMap: Record<string, string> = {};
  /** Word translations and timings, by `reciter:page`. Filled as pages are reached. */
  private wordPages: Record<string, Record<string, AyahWords>> = {};

  private player: HTMLAudioElement;
  private onChange: (s: UiState) => void;
  private session = 0;
  private active = false;
  private curStep = 1;
  private startStep = 1;
  private gateResolve: (() => void) | null = null;
  private unlocked = false;
  private meterStep = 0;
  private meterPos = -1;
  private prefetched = new Set<string>();
  private silenceCache: Record<string, string> = {};
  private currentItem: UnitRef | null = null;
  /** Last page the active range reaches — derived, so it is never persisted
   *  over the user's own `toPage` choice. */
  private rangeToPage = 1;

  constructor(player: HTMLAudioElement, onChange: (s: UiState) => void) {
    this.player = player;
    this.onChange = onChange;
    this.bindMediaSession();
  }

  /* ---------- Init ---------- */

  async init(query?: URLSearchParams) {
    this.load();
    if (query) {
      // ?from=563 → that page to the end of its surah; ?from=562&to=563 → a page span.
      if (query.get('from')) {
        const to = query.get('to');
        this.state.unit = 'range';
        this.state.fromPage = clampPage(parseInt(query.get('from')!, 10));
        this.state.rangeEnd = to && to !== 'surah' ? 'page' : 'surah';
        if (this.state.rangeEnd === 'page') this.state.toPage = clampPage(parseInt(to!, 10));
      }
      else if (query.get('surah')) { this.state.unit = 'surah'; this.state.surah = clampSurah(parseInt(query.get('surah')!, 10)); }
      else if (query.get('page')) { this.state.unit = 'page'; this.state.page = clampPage(parseInt(query.get('page')!, 10)); }
      const mode = query.get('mode');
      if (mode === 'loop' || mode === 'stepped') this.state.mode = mode;
    }
    if (this.state.unit === 'surah') await this.goSurah(this.state.surah, false);
    else if (this.state.unit === 'range') await this.goRange(this.currentRange(), false);
    else await this.goPage(this.state.page, false);
    if (query && (query.get('autoplay') === '1' || query.get('play') === '1')) this.startPlayback();
  }

  /** The range the saved settings describe. */
  currentRange(): PageRange {
    return normalizeRange({ fromPage: this.state.fromPage, end: this.state.rangeEnd, toPage: this.state.toPage });
  }

  /* ---------- Persistence ---------- */

  private save() {
    try { localStorage.setItem(LS, JSON.stringify(this.state)); } catch { /* noop */ }
    this.emit();
  }

  private load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || '{}');
      this.state = { ...DEFAULTS, ...s };
    } catch { this.state = { ...DEFAULTS }; }
    // A reciter saved on a build that offered it may be missing from this one.
    this.state.reciter = resolveReciterId(this.state.reciter, RECITERS);
  }

  private pushRecent(p: number) {
    const r = getRecent().filter((x) => x !== p);
    r.unshift(p);
    setRecent(r.slice(0, 6));
  }

  /* ---------- Snapshot ---------- */

  private emit() {
    const item = this.currentItem;
    const m = item ? surahMeta(item.s) : null;
    this.onChange({
      settings: { ...this.state },
      ready: this.ayahs.length > 0,
      playing: this.state.playing ?? false,
      gateVisible: this.gateVisible,
      surahAr: m?.arabic || '',
      surahEn: m && item ? `${m.name} · Ayah ${item.a}` : '',
      ayahText: item ? this.textMap[`${item.s}:${item.a}`] || '…' : '…',
      words: this.currentWords(),
      stepLabel: stepLabel(this.ayahs.length, this.state.mode, this.meterStep, this.meterPos),
      meterCount: this.ayahs.length,
      meterStep: this.meterStep,
      meterPos: this.meterPos,
      recent: getRecent(),
      unitLabel: this.state.unit === 'surah' ? 'Surah'
        : this.state.unit === 'range' ? (this.state.fromPage === this.rangeToPage ? 'Page' : 'Pages')
        : 'Page',
      unitValue: this.state.unit === 'surah' ? String(this.state.surah)
        : this.state.unit === 'range' ? rangePillLabel(this.state.fromPage, this.rangeToPage)
        : String(this.state.page),
      unitNoun: this.state.unit === 'surah' ? 'surah' : this.state.unit === 'range' ? 'range' : 'page',
    });
  }

  private gateVisible = false;

  /* ---------- Helpers ---------- */

  private audioUrl(s: number, a: number) {
    const base = RECITERS.find((r) => r.id === this.state.reciter)?.base ?? EVERYAYAH_BASE;
    // Absolute, so a self-hosted path still compares equal to `player.src`.
    return new URL(`${base}/${this.state.reciter}/${pad3(s)}${pad3(a)}.mp3`, location.href).href;
  }

  private kick(s: number, a: number) {
    try {
      const url = this.audioUrl(s, a);
      if (this.player.src !== url) this.player.src = url;
      const p = this.player.play();
      if (p && p.catch) p.catch(() => {});
    } catch { /* noop */ }
  }

  kickPage(p: number) {
    const first = expandPage(p)[0];
    if (first) this.kick(first.s, first.a);
  }

  kickSurah(s: number) { this.kick(s, 1); }

  private prefetch(list: UnitRef[], key: string) {
    if (this.prefetched.has(key)) return;
    this.prefetched.add(key);
    for (const { s, a } of list) fetch(this.audioUrl(s, a)).catch(() => {});
  }

  /** A page is small enough to pull whole; a surah or a range is not, so only
   *  the head is warmed — the rest arrives while the earlier ayahs play. */
  private prefetchCurrent() {
    const r = this.state.reciter;
    if (this.state.unit === 'surah') this.prefetch(this.ayahs.slice(0, 20), `${r}:s${this.state.surah}`);
    else if (this.state.unit === 'range') this.prefetch(this.ayahs.slice(0, 20), `${r}:r${this.state.fromPage}-${this.rangeToPage}`);
    else this.prefetch(expandPage(this.state.page), `${r}:p${this.state.page}`);
  }

  /* ---------- MediaSession ---------- */

  private bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => { if (!this.state.playing) this.togglePlay(); });
    navigator.mediaSession.setActionHandler('pause', () => { if (this.state.playing) this.togglePlay(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prevStep());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextStep());
    try { navigator.mediaSession.setActionHandler('stop', () => this.stopPlayback()); } catch { /* noop */ }
  }

  private setMediaMetadata(item: UnitRef, step: number) {
    if (!('mediaSession' in navigator)) return;
    const m = surahMeta(item.s);
    const reciterName = RECITERS.find((r) => r.id === this.state.reciter)?.name || 'Quran';
    const loc = this.state.unit === 'surah' ? m.name
      : this.state.unit === 'range' ? `Pages ${rangePillLabel(this.state.fromPage, this.rangeToPage)}`
      : `Page ${this.state.page}`;
    const detail = this.state.mode === 'stepped'
      ? `Step ${step}/${this.ayahs.length} · ${loc}`
      : `Ayah ${item.a} · ${loc}`;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${m.name} ${item.a}`,
        artist: reciterName,
        album: detail,
      });
    } catch { /* noop */ }
  }

  /* ---------- Pause gate ---------- */

  private gate(my: number): Promise<void> {
    if (this.state.playing && my === this.session) return Promise.resolve();
    return new Promise((res) => { this.gateResolve = res; });
  }

  private releaseGate() {
    if (this.gateResolve) { const r = this.gateResolve; this.gateResolve = null; r(); }
  }

  /* ---------- Core: play one ayah ---------- */

  private playAyah(item: UnitRef, step: number, pos: number, my: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (my !== this.session) return resolve(false);
      const url = this.audioUrl(item.s, item.a);
      if (this.player.src !== url) this.player.src = url;
      else if (this.player.ended) { try { this.player.currentTime = 0; } catch { /* noop */ } }
      this.currentItem = item;
      this.meterStep = step;
      this.meterPos = pos;
      this.setMediaMetadata(item, step);
      this.loadWords(item);
      this.loadWords(this.ayahs[pos + 1]); // the next page arrives before its first ayah
      this.emit();

      const finish = (val: boolean) => { cleanup(); resolve(val); };
      const onEnded = () => finish(my === this.session);
      const onError = () => finish(my === this.session); // skip broken ayah, keep going
      const onAbort = () => finish(false);
      const cleanup = () => {
        this.player.removeEventListener('ended', onEnded);
        this.player.removeEventListener('error', onError);
        this.player.removeEventListener('tadreej-abort', onAbort);
      };
      this.player.addEventListener('ended', onEnded);
      this.player.addEventListener('error', onError);
      this.player.addEventListener('tadreej-abort', onAbort);

      this.player.play().then(() => {
        this.unlocked = true;
        this.setPlaying(true);
      }).catch((e: Error) => {
        const blocked = e && (e.name === 'NotAllowedError' || e.name === 'AbortError');
        if (blocked && !this.unlocked) {
          // Very first play blocked (autoplay, no gesture) → tap-to-play gate
          cleanup();
          this.showGate();
          resolve(false);
        } else if (blocked) {
          // Already unlocked: transient mid-session block — skip, never interrupt
          cleanup();
          resolve(my === this.session);
        }
      });
    });
  }

  /* ---------- Silent gaps (real audio, not timers) ---------- */

  private silenceUrl(sec: number): string {
    const key = Math.max(0.05, Math.round(sec * 20) / 20);
    if (this.silenceCache[key]) return this.silenceCache[key];
    const rate = 8000, n = Math.round(rate * key), len = 44 + n;
    const dv = new DataView(new ArrayBuffer(len));
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, len - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    str(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);
    let bin = '';
    const u8 = new Uint8Array(dv.buffer);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return (this.silenceCache[key] = 'data:audio/wav;base64,' + btoa(bin));
  }

  private silentWait(sec: number, my: number): Promise<void> {
    return new Promise((resolve) => {
      if (my !== this.session || !(sec > 0)) return resolve();
      const done = () => { cleanup(); resolve(); };
      const cleanup = () => {
        this.player.removeEventListener('ended', done);
        this.player.removeEventListener('error', done);
        this.player.removeEventListener('tadreej-abort', done);
      };
      this.player.addEventListener('ended', done);
      this.player.addEventListener('error', done);
      this.player.addEventListener('tadreej-abort', done);
      this.player.src = this.silenceUrl(sec);
      const p = this.player.play();
      if (p && p.catch) p.catch(() => done());
    });
  }

  /* ---------- Runners ---------- */

  private async runStepped(my: number) {
    const N = this.ayahs.length;
    do {
      for (let step = this.startStep; step <= N; step++) {
        if (my !== this.session) return;
        this.curStep = step;
        for (let rep = 0; rep < this.state.reps; rep++) {
          for (let i = 0; i < step; i++) {
            await this.gate(my); if (my !== this.session) return;
            const ok = await this.playAyah(this.ayahs[i], step, i, my);
            if (!ok) return;
            if (i < step - 1) await this.silentWait(this.state.ayahGap, my);
          }
          if (rep < this.state.reps - 1) { await this.gate(my); if (my !== this.session) return; await this.silentWait(this.state.stepPause, my); }
        }
        if (step < N) { await this.gate(my); if (my !== this.session) return; await this.silentWait(this.state.stepPause, my); }
      }
      this.startStep = 1;
      if (this.state.repeatPage) { await this.gate(my); if (my !== this.session) return; await this.silentWait(this.state.stepPause, my); }
    } while (this.state.repeatPage && my === this.session);
    this.onFinished(my);
  }

  private async runLoop(my: number) {
    const N = this.ayahs.length;
    do {
      for (let i = 0; i < N; i++) {
        await this.gate(my); if (my !== this.session) return;
        const ok = await this.playAyah(this.ayahs[i], i + 1, i, my);
        if (!ok) return;
        if (i < N - 1) await this.silentWait(this.state.ayahGap, my);
      }
      await this.gate(my); if (my !== this.session) return;
      await this.silentWait(this.state.stepPause, my);
    } while (my === this.session);
  }

  private onFinished(my: number) {
    if (my !== this.session) return;
    this.active = false;
    this.state.playing = false;
    this.meterPos = -1;
    this.emit();
  }

  /* ---------- Transport ---------- */

  private setPlaying(v: boolean) {
    this.state.playing = v;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = v ? 'playing' : 'paused';
    if (v) this.releaseGate();
    this.emit();
  }

  startPlayback() {
    if (!this.ayahs.length) return;
    this.player.dispatchEvent(new Event('tadreej-abort'));
    this.releaseGate();
    const my = ++this.session;
    this.active = true;
    this.hideGate();
    this.state.playing = true;
    this.kick(this.ayahs[0].s, this.ayahs[0].a); // unlock inside gesture (Safari/iOS)
    this.prefetchCurrent();
    this.emit();
    (this.state.mode === 'loop' ? this.runLoop : this.runStepped).call(this, my);
  }

  stopPlayback() {
    this.session++;
    this.active = false;
    this.player.pause();
    this.player.dispatchEvent(new Event('tadreej-abort'));
    this.releaseGate();
    this.state.playing = false;
    this.meterPos = -1;
    this.meterStep = 0;
    this.emit();
  }

  togglePlay() {
    if (!this.ayahs.length) return;
    if (this.state.playing) {
      this.state.playing = false;
      this.player.pause();
      this.setPlaying(false);
    } else if (this.active) {
      this.state.playing = true;
      const mid = this.player.currentSrc && !this.player.ended &&
        this.player.currentTime > 0 && this.player.currentTime < (this.player.duration || Infinity);
      if (mid) this.player.play().catch(() => {});
      this.setPlaying(true);
    } else {
      this.startStep = this.curStep;
      this.startPlayback();
    }
  }

  nextStep() {
    if (this.state.mode === 'loop') return this.shiftUnit(1);
    this.startStep = Math.min(this.ayahs.length, this.curStep + 1);
    this.startPlayback();
  }

  prevStep() {
    if (this.state.mode === 'loop') return this.shiftUnit(-1);
    this.startStep = Math.max(1, this.curStep - 1);
    this.startPlayback();
  }

  /** Loop mode's next/prev move to adjacent content. For a range that means
   *  sliding the window a page on — finish page 4 to the end of the surah,
   *  then start at page 5 — which is how page-by-page memorisation proceeds. */
  private shiftUnit(delta: number) {
    if (this.state.unit === 'surah') {
      const s = clampSurah(this.state.surah + delta);
      this.kickSurah(s);
      return this.goSurah(s, true);
    }
    if (this.state.unit === 'range') {
      const span = this.state.rangeEnd === 'page' ? this.state.toPage - this.state.fromPage : 0;
      const fromPage = clampPage(this.state.fromPage + delta);
      this.kickPage(fromPage);
      return this.goRange({ fromPage, end: this.state.rangeEnd, toPage: fromPage + span }, true);
    }
    const p = clampPage(this.state.page + delta);
    this.kickPage(p);
    return this.goPage(p, true);
  }

  /* ---------- Navigation ---------- */

  async goPage(page: number, play: boolean) {
    page = clampPage(page);
    this.stopPlayback();
    this.state.unit = 'page';
    this.state.page = page;
    this.startStep = 1;
    this.curStep = 1;
    this.ayahs = expandPage(page);
    this.pushRecent(page);
    this.currentItem = this.ayahs[0] || null;
    this.save();
    await this.loadPageText(page);
    this.loadWords(this.currentItem);
    this.emit();
    if (play) this.startPlayback();
  }

  async goSurah(surah: number, play: boolean) {
    surah = clampSurah(surah);
    this.stopPlayback();
    this.state.unit = 'surah';
    this.state.surah = surah;
    this.startStep = 1;
    this.curStep = 1;
    this.ayahs = expandSurah(surah);
    this.currentItem = this.ayahs[0] || null;
    this.save();
    await this.loadSurahText(surah);
    this.loadWords(this.currentItem);
    this.emit();
    if (play) this.startPlayback();
  }

  /** Stepped memorisation over a span of pages: start at the top of
   *  `fromPage` and run to the end of that page's surah, or to the bottom of
   *  `toPage`. Step 1 is the first ayah of the range, not of the surah. */
  async goRange(range: PageRange, play: boolean) {
    const r = normalizeRange(range);
    const resolved = resolveRange(r);
    this.stopPlayback();
    this.state.unit = 'range';
    this.state.fromPage = r.fromPage;
    this.state.rangeEnd = r.end;
    // Only a page-ended range owns `toPage`; a surah-ended one leaves the
    // stored value alone so switching end modes back restores the old span.
    if (r.end === 'page') this.state.toPage = r.toPage;
    this.rangeToPage = resolved.toPage;
    this.startStep = 1;
    this.curStep = 1;
    this.ayahs = resolved.ayahs;
    this.pushRecent(r.fromPage);
    this.currentItem = this.ayahs[0] || null;
    this.save();
    await this.loadPagesText(resolved.pages);
    this.loadWords(this.currentItem);
    this.emit();
    if (play) this.startPlayback();
  }

  /* ---------- Mode & settings ---------- */

  setMode(mode: 'stepped' | 'loop') {
    this.state.mode = mode;
    this.save();
    if (this.active) { this.startStep = 1; this.startPlayback(); }
  }

  updateSettings(patch: Partial<TadreejSettings>) {
    Object.assign(this.state, patch);
    this.save();
    if (patch.wordByWord || patch.reciter) this.loadWords(this.currentItem);
    // Reciter change mid-playback: restart from current step with new voice
    if (patch.reciter && this.active) { this.startStep = this.curStep; this.startPlayback(); }
  }

  /* ---------- Tap-to-play gate ---------- */

  private showGate() {
    this.state.playing = false;
    this.gateVisible = true;
    this.emit();
  }

  hideGate() {
    this.gateVisible = false;
    this.emit();
  }

  dismissGateAndPlay() {
    this.hideGate();
    this.startStep = this.curStep;
    this.startPlayback();
  }

  /* ---------- Word by word (display only; audio works without it) ---------- */

  private wordsOf(item: UnitRef | null): AyahWords | undefined {
    if (!item || !this.state.wordByWord) return undefined;
    return this.wordPages[`${this.state.reciter}:${pageOf(item.s, item.a)}`]?.[`${item.s}:${item.a}`];
  }

  private currentWords(): WordView[] | null {
    const item = this.currentItem;
    const words = this.wordsOf(item);
    const text = item && this.textMap[`${item.s}:${item.a}`];
    return item && words && text ? alignWords(text, words.tr, item.a) : null;
  }

  /** Fetch the words of the page that holds `item`, once per reciter: the
   *  timings differ by reciter. A failed page is asked for again next time. */
  private async loadWords(item: UnitRef | null | undefined) {
    if (!item || !this.state.wordByWord) return;
    const reciter = this.state.reciter;
    const page = pageOf(item.s, item.a);
    const key = `${reciter}:${page}`;
    if (this.wordPages[key]) return;
    this.wordPages[key] = {};
    try {
      const res = await fetch(wordsUrl(page, reciter));
      if (!res.ok) throw new Error(String(res.status));
      this.wordPages[key] = parseWordsPage(await res.json());
      this.emit();
    } catch (e) {
      delete this.wordPages[key];
      console.warn('Word load failed for page', page, e);
    }
  }

  /** The word sounding now, as its number in the ayah, or 0 for none: in a
   *  gap, before playback, or with a reciter that has no timings. */
  activeWord(): number {
    const item = this.currentItem;
    const segs = this.wordsOf(item)?.segs;
    if (!item || !segs?.length || this.meterPos < 0) return 0;
    if (this.player.src !== this.audioUrl(item.s, item.a)) return 0;
    return activeWord(segs, this.player.currentTime * 1000);
  }

  /* ---------- Quran text (display only; audio works without it) ---------- */

  private async fetchPageText(page: number): Promise<Record<string, string>> {
    const key = `tadreej.text.${page}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch { /* noop */ }
    try {
      const res = await fetch(`${TEXT_API}/${page}/quran-uthmani`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const ay of data.data.ayahs) map[`${ay.surah.number}:${ay.numberInSurah}`] = ay.text;
      try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* noop */ }
      return map;
    } catch (e) {
      console.warn('Text load failed for page', page, e);
      return {};
    }
  }

  private async loadPageText(page: number) {
    this.textMap = await this.fetchPageText(page);
  }

  /** A range spans pages, so its text is the union of theirs. Each page is
   *  cached on its own, so a range overlapping one already read costs nothing. */
  private async loadPagesText(pages: number[]) {
    this.textMap = {};
    const maps = await Promise.all(pages.map((p) => this.fetchPageText(p)));
    this.textMap = Object.assign({}, ...maps);
  }

  private async loadSurahText(surah: number) {
    this.textMap = {};
    const key = `tadreej.text.s${surah}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) { this.textMap = JSON.parse(cached); return; }
    } catch { /* noop */ }
    try {
      const res = await fetch(`${TEXT_SURAH_API}/${surah}/quran-uthmani`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const ay of data.data.ayahs) map[`${data.data.number}:${ay.numberInSurah}`] = ay.text;
      this.textMap = map;
      try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* noop */ }
    } catch (e) {
      console.warn('Text load failed for surah', surah, e);
    }
  }
}
