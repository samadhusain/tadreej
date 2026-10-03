import { useEffect, useMemo, useRef, useState } from 'react';
import { HAS_EXTRA_AUDIO, RECITERS, TadreejEngine, type UiState } from './engine';
import { footerCredits } from './credits';
import FeedbackSheet from './FeedbackSheet';
import {
  TOTAL_PAGES,
  TOTAL_SURAHS,
  normalizeSurahQuery,
  pageRangeLabel,
  rangeLabel,
  resolveRange,
  steppedPlaybacks,
  surahMeta,
  type RangeEnd,
} from './range';
import { hasTimings } from './words';
import './tadreej.css';

/* Verse meter gradient — lime → deep green by position */
function lerpColor(a: string, b: string, t: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const r = Math.round((A >> 16) + ((B >> 16) - (A >> 16)) * t);
  const g = Math.round(((A >> 8) & 255) + (((B >> 8) & 255) - ((A >> 8) & 255)) * t);
  const c = Math.round((A & 255) + ((B & 255) - (A & 255)) * t);
  return `rgb(${r},${g},${c})`;
}

export default function TadreejPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<TadreejEngine | null>(null);
  const [ui, setUi] = useState<UiState | null>(null);

  // Picker sheet state (pure UI, lives in React)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<'page' | 'surah' | 'range'>('page');
  const [pgInput, setPgInput] = useState(1);
  const [surahFilter, setSurahFilter] = useState('');
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeEnd, setRangeEnd] = useState<RangeEnd>('surah');
  // Held as a span, not an end page: moving the start carries the end with it,
  // and a remembered end can never strand itself hundreds of pages away.
  const [rangeSpan, setRangeSpan] = useState(0);
  const rangeTo = Math.min(TOTAL_PAGES, rangeFrom + rangeSpan);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // The word sounding now, by its number in the ayah. 0 is none.
  const [activeWord, setActiveWord] = useState(0);

  useEffect(() => {
    if (!audioRef.current) return;
    const engine = new TadreejEngine(audioRef.current, setUi);
    engineRef.current = engine;
    engine.init(new URLSearchParams(window.location.search));
    return () => engine.stopPlayback();
  }, []);

  const engine = engineRef.current;
  const settings = ui?.settings;

  // Follow the audio clock while words are on screen. The engine emits once
  // per ayah, which is too coarse to track a word.
  const hasWords = Boolean(ui?.words);
  useEffect(() => {
    if (!ui?.playing || !hasWords) return;
    let frame = requestAnimationFrame(function tick() {
      setActiveWord(engineRef.current?.activeWord() ?? 0);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [ui?.playing, hasWords]);

  // Keyboard shortcuts: Space play/pause · ←/→ step · P picker · L/S mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const eng = engineRef.current;
      if (!eng) return;
      if (ui?.gateVisible) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); eng.dismissGateAndPlay(); }
        return;
      }
      if (sheetOpen || feedbackOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setSheetOpen(false); setFeedbackOpen(false); }
        return;
      }
      switch (e.key) {
        case ' ':
          if (document.activeElement?.tagName === 'BUTTON') return;
          e.preventDefault(); eng.togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); eng.nextStep(); break;
        case 'ArrowLeft': e.preventDefault(); eng.prevStep(); break;
        case 'p': case 'P': e.preventDefault(); openSheet(); break;
        case 'l': case 'L': e.preventDefault(); eng.setMode('loop'); break;
        case 's': case 'S': e.preventDefault(); eng.setMode('stepped'); break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, feedbackOpen, ui?.gateVisible]);

  function openSheet() {
    if (!settings) return;
    setPgInput(settings.page);
    setRangeFrom(settings.fromPage);
    setRangeEnd(settings.rangeEnd);
    // Only a page-ended range saved the two together, so only it has a span.
    setRangeSpan(settings.rangeEnd === 'page' ? Math.max(0, settings.toPage - settings.fromPage) : 0);
    setTab(settings.unit);
    setSheetOpen(true);
  }

  /* Resolved preview for the range tab: what will actually play, and how much
     of it. Stepped mode is quadratic, so the cost is worth showing up front. */
  const rangePreview = useMemo(() => {
    const { ayahs, toPage } = resolveRange({ fromPage: rangeFrom, end: rangeEnd, toPage: rangeTo });
    return {
      label: rangeLabel(ayahs),
      count: ayahs.length,
      lastPage: toPage,
      playbacks: steppedPlaybacks(ayahs.length, settings?.reps ?? 1),
    };
  }, [rangeFrom, rangeEnd, rangeTo, settings?.reps]);

  const surahRows = useMemo(() => {
    const q = normalizeSurahQuery(surahFilter);
    const rows = [];
    for (let s = 1; s <= TOTAL_SURAHS; s++) {
      const m = surahMeta(s);
      if (q && !normalizeSurahQuery(`${s} ${m.name} ${m.translation || ''}`).includes(q)) continue;
      rows.push({ n: s, meta: m });
    }
    return rows;
  }, [surahFilter]);

  const meterSegs = useMemo(() => {
    const n = ui?.meterCount || 0;
    const denom = Math.max(1, n - 1);
    return Array.from({ length: n }, (_, i) => lerpColor('#87c54a', '#0f5f36', i / denom));
  }, [ui?.meterCount]);

  if (!ui || !settings) {
    // NB: the <audio> element must exist in the same tree position in every
    // render — the engine holds a reference to it from mount time.
    return (
      <div className="tadreej-root">
        <div className="app">
          <audio ref={audioRef} playsInline preload="auto" />
          <main className="screen"><p style={{ padding: 24 }}>Loading…</p></main>
        </div>
      </div>
    );
  }

  const reciterName = RECITERS.find((r) => r.id === settings.reciter)?.name || '';

  return (
    <div className="tadreej-root">
      <div className="app">
        {/* Persistent audio element: the engine. MediaSession gives lock-screen and headset controls.
            Must stay in the same tree position across renders (see loading branch). */}
        <audio ref={audioRef} playsInline preload="auto" />

        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
            <span className="brand-name">Tadreej<span className="brand-sub">stepped reciter</span></span>
          </div>
        </header>

        <main className="screen">
          {/* ───────── Now Playing ───────── */}
          <section className="now card" aria-live="polite">
            <button className="page-pill" aria-label="Change page, range or surah" onClick={openSheet}>
              <span className="page-pill__label">{ui.unitLabel}</span>
              <span className="page-pill__num">{ui.unitValue}</span>
              <span className="page-pill__caret" aria-hidden="true">▾</span>
            </button>

            <div className="now__surah">
              <span className="now__surah-ar">{ui.surahAr}</span>
              <span className="now__surah-en">{ui.surahEn}</span>
            </div>

            {ui.words ? (
              <p className="now__ayah now__ayah--words" dir="rtl" lang="ar">
                {ui.words.map((w, i) => (
                  <span key={i} className={`word${ui.meterPos >= 0 && w.pos > 0 && w.pos === activeWord ? ' is-active' : ''}`}>
                    <span className="word__ar">{w.ar}</span>
                    <span className="word__tr" dir="ltr" lang="en">{w.tr}</span>
                  </span>
                ))}
              </p>
            ) : (
              <p className="now__ayah" dir="rtl" lang="ar">{ui.ayahText}</p>
            )}

            <div className="now__progress">
              <div
                className="meter"
                role="progressbar"
                aria-label="Recitation progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((ui.meterStep / (ui.meterCount || 1)) * 100)}
                style={{ gap: ui.meterCount <= 24 ? 3 : ui.meterCount <= 48 ? 2 : ui.meterCount <= 90 ? 1 : 0 }}
              >
                {meterSegs.map((color, i) => {
                  let cls = 'meter__seg';
                  if (i === ui.meterPos) cls += ' is-active';
                  else if (i < ui.meterPos) cls += ' is-recited';
                  else if (i < ui.meterStep) cls += ' is-step';
                  return <span key={i} className={cls} style={{ ['--c' as never]: color }} />;
                })}
              </div>
              <span className="now__step">{ui.stepLabel}</span>
            </div>
          </section>

          <div className="rail">
            {/* ───────── Transport ───────── */}
            <section className="transport" aria-label="Playback controls">
              <button className="round-btn" aria-label="Previous / restart step" onClick={() => engine?.prevStep()}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zm3.5 7 8.5 6V6z"/></svg>
              </button>
              <button
                className="play-btn"
                aria-label={ui.playing ? 'Pause' : 'Play'}
                data-playing={ui.playing ? 'true' : 'false'}
                onClick={() => engine?.togglePlay()}
              >
                {!ui.playing && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>}
                {ui.playing && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>}
              </button>
              <button className="round-btn" aria-label="Next step" onClick={() => engine?.nextStep()}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM6 6v12l8.5-6z"/></svg>
              </button>
            </section>

            {/* ───────── Mode toggle ───────── */}
            <section className="mode" role="tablist" aria-label="Playback mode">
              <button
                className={`mode__btn${settings.mode === 'stepped' ? ' is-active' : ''}`}
                role="tab"
                aria-selected={settings.mode === 'stepped'}
                onClick={() => engine?.setMode('stepped')}
              >
                <strong>Stepped</strong><small>1 · 1-2 · 1-2-3…</small>
              </button>
              <button
                className={`mode__btn${settings.mode === 'loop' ? ' is-active' : ''}`}
                role="tab"
                aria-selected={settings.mode === 'loop'}
                onClick={() => engine?.setMode('loop')}
              >
                <strong>Loop</strong><small>repeat the {ui.unitNoun}</small>
              </button>
            </section>

            {/* ───────── Settings ───────── */}
            <details className="settings card">
              <summary>
                <span>Settings</span>
                <span className="settings__hint">{reciterName}</span>
              </summary>
              <div className="settings__grid">
                <label className="field">
                  <span>Reciter</span>
                  <select value={settings.reciter} onChange={(e) => engine?.updateSettings({ reciter: e.target.value })}>
                    {RECITERS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>

                <label className="field">
                  <span>Reps per step</span>
                  <input
                    type="number" min={1} max={9} inputMode="numeric"
                    value={settings.reps}
                    onChange={(e) => engine?.updateSettings({ reps: Math.min(9, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                  />
                </label>

                <label className="field">
                  <span>Pause between steps <em>(sec)</em></span>
                  <input
                    type="number" min={0} max={15} step={0.5} inputMode="decimal"
                    value={settings.stepPause}
                    onChange={(e) => engine?.updateSettings({ stepPause: Math.min(15, Math.max(0, parseFloat(e.target.value) || 0)) })}
                  />
                </label>

                <label className="field">
                  <span>Gap between ayahs <em>(sec)</em></span>
                  <input
                    type="number" min={0} max={5} step={0.1} inputMode="decimal"
                    value={settings.ayahGap}
                    onChange={(e) => engine?.updateSettings({ ayahGap: Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)) })}
                  />
                </label>

                <label className="field field--row">
                  <input
                    type="checkbox"
                    checked={settings.repeatPage}
                    onChange={(e) => engine?.updateSettings({ repeatPage: e.target.checked })}
                  />
                  <span>Repeat {ui.unitNoun} when finished <em>(keeps playing hands-free)</em></span>
                </label>

                <label className="field field--row">
                  <input
                    type="checkbox"
                    checked={settings.wordByWord}
                    onChange={(e) => engine?.updateSettings({ wordByWord: e.target.checked })}
                  />
                  <span>
                    Word-by-word translation{' '}
                    <em>({hasTimings(settings.reciter) ? 'highlights the word being recited' : 'no word highlight for this reciter'})</em>
                  </span>
                </label>
              </div>
            </details>
          </div>

          <footer className="foot">
            <span className="foot__credits">
              {footerCredits(HAS_EXTRA_AUDIO).map((line, n, lines) => (
                <span key={line.label}>
                  {line.label}{' '}
                  {line.links.map((link, i) => (
                    <span key={link.href}>
                      {i > 0 && line.joiner}
                      <a href={link.href} target="_blank" rel="noopener">{link.text}</a>
                    </span>
                  ))}
                  {/* Ends the last line: it floats to the footer's bottom corner. */}
                  {n === lines.length - 1 && (
                    <button className="foot__feedback" aria-haspopup="dialog" onClick={() => setFeedbackOpen(true)}>Feedback</button>
                  )}
                </span>
              ))}
            </span>
            <span className="foot__dua" dir="rtl" lang="ar">رَبِّ زِدْنِي عِلْمًا</span>
          </footer>
        </main>

        {/* ───────── Page picker sheet ───────── */}
        <div className="sheet" hidden={!sheetOpen}>
          <div className="sheet__backdrop" onClick={() => setSheetOpen(false)}></div>
          <div className="sheet__panel" role="dialog" aria-modal="true" aria-label="Go to page or surah">
            <div className="sheet__grip" aria-hidden="true"></div>

            <div className="seg-tabs" role="tablist" aria-label="Pick by">
              <button
                className={`seg-tab${tab === 'page' ? ' is-active' : ''}`}
                role="tab" aria-selected={tab === 'page'} aria-controls="panel-page"
                onClick={() => setTab('page')}
              >Page</button>
              <button
                className={`seg-tab${tab === 'range' ? ' is-active' : ''}`}
                role="tab" aria-selected={tab === 'range'} aria-controls="panel-range"
                onClick={() => setTab('range')}
              >Range</button>
              <button
                className={`seg-tab${tab === 'surah' ? ' is-active' : ''}`}
                role="tab" aria-selected={tab === 'surah'} aria-controls="panel-surah"
                onClick={() => setTab('surah')}
              >Surah</button>
            </div>

            {/* ── Page panel ── */}
            <div className="sheet__pane" role="tabpanel" aria-labelledby="tab-page" hidden={tab !== 'page'}>
              <div className="pagejump">
                <button className="step-btn" aria-label="Previous page" onClick={() => setPgInput((p) => Math.max(1, p - 1))}>−</button>
                <input
                  className="pagejump__input"
                  type="number" min={1} max={604} inputMode="numeric" aria-label="Page number"
                  value={pgInput}
                  onChange={(e) => setPgInput(Math.min(604, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                />
                <button className="step-btn" aria-label="Next page" onClick={() => setPgInput((p) => Math.min(604, p + 1))}>+</button>
              </div>
              <p className="pagejump__meta"><span>{pageRangeLabel(pgInput)}</span> · of 604</p>

              <div className="quick" aria-label="Recent pages">
                {ui.recent.filter((p) => p !== settings.page).map((p) => (
                  <button key={p} className="quick__chip" onClick={() => setPgInput(p)}>Page {p}</button>
                ))}
              </div>

              <div className="sheet__actions">
                <button className="primary-btn" onClick={() => { setSheetOpen(false); engine?.goPage(pgInput, false); }}>Go to page</button>
                <button
                  className="primary-btn primary-btn--accent"
                  onClick={() => { engine?.kickPage(pgInput); setSheetOpen(false); engine?.goPage(pgInput, true); }}
                >Go &amp; play</button>
              </div>
            </div>

            {/* ── Range panel: step from a page you've already reached ── */}
            <div className="sheet__pane" role="tabpanel" aria-labelledby="tab-range" hidden={tab !== 'range'}>
              <p className="range-cap">Start from page</p>
              <div className="pagejump">
                <button className="step-btn" aria-label="Previous start page" onClick={() => setRangeFrom((p) => Math.max(1, p - 1))}>−</button>
                <input
                  className="pagejump__input"
                  type="number" min={1} max={TOTAL_PAGES} inputMode="numeric" aria-label="Start page"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(Math.min(TOTAL_PAGES, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                />
                <button className="step-btn" aria-label="Next start page" onClick={() => setRangeFrom((p) => Math.min(TOTAL_PAGES, p + 1))}>+</button>
              </div>
              <p className="pagejump__meta">{pageRangeLabel(rangeFrom)}</p>

              <p className="range-cap">Run until</p>
              <div className="seg-tabs seg-tabs--sub" role="tablist" aria-label="Where the range ends">
                <button
                  className={`seg-tab${rangeEnd === 'surah' ? ' is-active' : ''}`}
                  role="tab" aria-selected={rangeEnd === 'surah'}
                  onClick={() => setRangeEnd('surah')}
                >End of surah</button>
                <button
                  className={`seg-tab${rangeEnd === 'page' ? ' is-active' : ''}`}
                  role="tab" aria-selected={rangeEnd === 'page'}
                  onClick={() => setRangeEnd('page')}
                >A page</button>
              </div>

              {rangeEnd === 'page' && (
                <div className="range-to">
                  <button className="step-btn step-btn--sm" aria-label="Previous end page" onClick={() => setRangeSpan((s) => Math.max(0, s - 1))}>−</button>
                  <input
                    className="pagejump__input pagejump__input--sm"
                    type="number" min={rangeFrom} max={TOTAL_PAGES} inputMode="numeric" aria-label="End page"
                    value={rangeTo}
                    onChange={(e) => setRangeSpan(Math.min(TOTAL_PAGES, Math.max(rangeFrom, parseInt(e.target.value, 10) || rangeFrom)) - rangeFrom)}
                  />
                  <button className="step-btn step-btn--sm" aria-label="Next end page" onClick={() => setRangeSpan((s) => Math.min(TOTAL_PAGES - rangeFrom, s + 1))}>+</button>
                </div>
              )}

              <p className="range-preview" aria-live="polite">
                <strong>{rangePreview.label || 'Nothing on that page'}</strong>
                <span>
                  {rangePreview.count} ayah{rangePreview.count === 1 ? '' : 's'}
                  {' · page'}{rangePreview.lastPage === rangeFrom ? ` ${rangeFrom}` : `s ${rangeFrom}–${rangePreview.lastPage}`}
                </span>
              </p>

              {rangePreview.count > 25 && (
                <p className="range-warn">
                  Stepped mode replays every earlier ayah, so one pass is{' '}
                  {rangePreview.playbacks.toLocaleString()} recitations. Ending on a page keeps a
                  session finishable.
                </p>
              )}

              <div className="sheet__actions">
                <button
                  className="primary-btn"
                  onClick={() => { setSheetOpen(false); engine?.goRange({ fromPage: rangeFrom, end: rangeEnd, toPage: rangeTo }, false); }}
                >Go to range</button>
                <button
                  className="primary-btn primary-btn--accent"
                  onClick={() => { engine?.kickPage(rangeFrom); setSheetOpen(false); engine?.goRange({ fromPage: rangeFrom, end: rangeEnd, toPage: rangeTo }, true); }}
                >Go &amp; play</button>
              </div>
            </div>

            {/* ── Surah panel ── */}
            <div className="sheet__pane" role="tabpanel" aria-labelledby="tab-surah" hidden={tab !== 'surah'}>
              <label className="surah-search">
                <svg className="surah-search__ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
                <input
                  type="search" placeholder="Search surah by name or number…" autoComplete="off" aria-label="Search surah"
                  value={surahFilter}
                  onChange={(e) => setSurahFilter(e.target.value)}
                />
              </label>
              <p className="surah-hint">Plays from the first ayah of the surah.</p>
              <div className="surah-list" role="listbox" aria-label="Surahs">
                {surahRows.length === 0 && <p className="surah-empty">No surah matches that search.</p>}
                {surahRows.map(({ n, meta }) => (
                  <button
                    key={n}
                    className={`surah-row${settings.unit === 'surah' && settings.surah === n ? ' is-current' : ''}`}
                    onClick={() => { engine?.kickSurah(n); setSheetOpen(false); engine?.goSurah(n, true); }}
                  >
                    <span className="surah-row__no">{n}</span>
                    <span className="surah-row__txt">
                      <span className="surah-row__name">{meta.name}</span>
                      <span className="surah-row__meta">{meta.translation} · {meta.ayahs} ayahs</span>
                    </span>
                    <span className="surah-row__ar" dir="rtl" lang="ar">{meta.arabic}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ───────── Feedback sheet ───────── */}
        {feedbackOpen && <FeedbackSheet ui={ui} reciterName={reciterName} onClose={() => setFeedbackOpen(false)} />}

        {/* ───────── Tap-to-start overlay (autoplay blocked by iOS) ───────── */}
        <div className="gate" hidden={!ui.gateVisible} onClick={() => engine?.dismissGateAndPlay()}>
          <button className="gate__btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>Tap anywhere to play</span>
          </button>
        </div>
      </div>
    </div>
  );
}
