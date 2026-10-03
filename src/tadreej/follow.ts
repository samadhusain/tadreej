import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export interface FollowInput {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  /** The active word's row, in content coordinates (not the viewport's). */
  rowTop: number;
  rowHeight: number;
}

/** Where to scroll so the sounding row stays readable, or null to stay put.
 *  Like a page turn: a row that is not fully visible, or is the last fully
 *  visible row with more below, becomes the first visible row. The result is
 *  clamped to the maximum scroll, so the last rows do not jitter.
 *  Works for the ayah box (desk mode) and for the page (phones, tablets). */
export function followTarget(i: FollowInput): number | null {
  const max = i.scrollHeight - i.clientHeight;
  if (max <= 0) return null;
  const rowBottom = i.rowTop + i.rowHeight;
  const viewBottom = i.scrollTop + i.clientHeight;
  const hidden = i.rowTop < i.scrollTop || rowBottom > viewBottom;
  // Rows are about the same height: the next one would not fit fully.
  const lastVisible = rowBottom + i.rowHeight > viewBottom && i.scrollTop < max;
  if (!hidden && !lastVisible) return null;
  const target = Math.min(Math.max(i.rowTop, 0), max);
  return Math.abs(target - i.scrollTop) < 1 ? null : target;
}

export interface FollowGuard {
  playing: boolean;
  settingsOpen: boolean;
  sheetOpen: boolean;
  gateVisible: boolean;
  inputFocused: boolean;
  /** The user scrolled by hand since this ayah began. */
  userScrolled: boolean;
}

/** Whether the page may follow the sounding word now. Never fight the user:
 *  once they scroll by hand, the follow stays off until latchReleases lets go. */
export function followAllowed(g: FollowGuard): boolean {
  return g.playing && !g.settingsOpen && !g.sheetOpen && !g.gateVisible
    && !g.inputFocused && !g.userScrolled;
}

/** How long the view must be still before a hand-scroll stop can end:
 *  briefly when the sounding word is in view, longer when it is out of view. */
export const STILL_IN_VIEW_MS = 400;
export const STILL_AWAY_MS = 2000;

export interface LatchState {
  /** The user scrolled by hand and the follow is off. */
  latched: boolean;
  /** The sounding word is fully inside the visible area (viewport, or the box). */
  wordInView: boolean;
  /** A finger is on the screen. */
  touching: boolean;
  msSinceScroll: number;
  /** Part of the transport controls is on screen (page follow only). The user
   *  may be reaching for pause, so the page must not move. */
  controlsVisible: boolean;
}

/** Whether a hand-scroll stop ends now. No touch is down, the controls are off
 *  screen, and the view has been still (so the follow never grabs a flick).
 *  A word that is out of view waits longer, then the follow brings the view back to it. */
export function latchReleases(l: LatchState): boolean {
  if (!l.latched || l.touching || l.controlsVisible) return false;
  return l.msSinceScroll >= (l.wordInView ? STILL_IN_VIEW_MS : STILL_AWAY_MS);
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

const smoothness = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

const settingsOpen = () => Boolean(document.querySelector<HTMLDetailsElement>('.settings')?.open);
const inputFocused = () => {
  const a = document.activeElement;
  return !!a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName);
};

export interface ScrollContext {
  playing: boolean;
  sheetOpen: boolean;
  gateVisible: boolean;
}

/** Keeps the sounding word in view.
 *  - Desk mode: the ayah overflows its box, so the box scrolls and the page stays put.
 *  - Phones and tablets: the box never overflows, so the page follows instead.
 *  Both follows stop when the user scrolls by hand. The stop ends when the
 *  view is still, the controls are off screen and no touch is down
 *  (latchReleases), or when a new ayah begins. Then the follow scrolls back
 *  to the word. A restart of the same ayah (a loop or a repeat) counts as new.
 *  A new ayah (key) starts the box at the top and returns the page to the top
 *  if the follow moved it.
 *  The data-more attribute marks a box with text below, for the fade cue. */
export function useAyahScroll(
  ref: RefObject<HTMLElement | null>, key: string, activeWord: number, ctx: ScrollContext,
) {
  const ctxRef = useRef(ctx);
  const userScrolled = useRef(false);
  const touching = useRef(false);
  const lastScroll = useRef(-Infinity); // while stopped we never scroll, so any scroll is the user's
  const lastWord = useRef(0); // the last active word, to spot a restart
  const followedPage = useRef(false);
  const lastTarget = useRef<number | null>(null); // the last scroll we asked for
  const runFollow = useRef<() => void>(() => {}); // the follow for the current word
  const recheck = useRef(0); // timer: look again once the view has been still
  // After a hand scroll, check again when the view has been still long enough,
  // so the view returns to the word even if no word changes meanwhile.
  const armRecheck = () => {
    if (!userScrolled.current) return;
    window.clearTimeout(recheck.current);
    recheck.current = window.setTimeout(() => runFollow.current(), STILL_AWAY_MS + 50);
  };
  // Declared first, so the layout effect below reads this render's values.
  useLayoutEffect(() => { ctxRef.current = ctx; });

  // User scroll input stops the follow. Programmatic scrolls fire no input events.
  useEffect(() => {
    const note = () => { userScrolled.current = true; lastTarget.current = null; };
    const down = () => { touching.current = true; note(); };
    const up = () => { touching.current = false; };
    const onHide = () => { if (document.visibilityState === 'hidden') touching.current = false; };
    const stamp = () => { lastScroll.current = performance.now(); armRecheck(); };
    const onKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) note(); };
    const opts = { passive: true } as const;
    window.addEventListener('touchstart', down, opts);
    window.addEventListener('touchend', up, opts);
    window.addEventListener('touchcancel', up, opts);
    window.addEventListener('pagehide', up);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('touchmove', note, opts);
    window.addEventListener('wheel', note, opts);
    window.addEventListener('scroll', stamp, opts);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(recheck.current);
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      window.removeEventListener('pagehide', up);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('touchmove', note);
      window.removeEventListener('wheel', note);
      window.removeEventListener('scroll', stamp);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const cue = () => {
      if (el.scrollHeight - el.clientHeight - el.scrollTop > 2) el.setAttribute('data-more', '');
      else el.removeAttribute('data-more');
    };
    if (el.scrollTop !== 0) el.scrollTop = 0;
    // A new ayah brings the page back to the top if the follow moved it,
    // whether or not the user has scrolled since. Settings, sheets and fields stay untouched.
    if (followedPage.current && !ctxRef.current.sheetOpen && !settingsOpen() && !inputFocused()) {
      followedPage.current = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    userScrolled.current = false;
    lastTarget.current = null;
    lastWord.current = 0;
    cue();
    const onScroll = () => { lastScroll.current = performance.now(); armRecheck(); cue(); };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(cue);
    ro.observe(el);
    document.fonts?.ready.then(() => { if (alive) cue(); });
    return () => { alive = false; el.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, [ref, key]);

  useEffect(() => {
    const run = () => {
      // A paused player never follows, and a timed recheck must not pull a paused view back.
      if (!ctxRef.current.playing) return;
      const el = ref.current;
      const word = el?.querySelector('.word.is-active');
      if (!el || !word) return;
      const w = word.getBoundingClientRect();
      // The first row always scrolls to the very top, so the header shows again.
      const first = w.top === el.querySelector('.word')?.getBoundingClientRect().top;
      // The words only move forward within an ayah. A drop back to the first row
      // is a restart (a loop or a repeat), and counts as a new ayah.
      const restarted = first && activeWord < lastWord.current;
      lastWord.current = activeWord;
      if (restarted) { userScrolled.current = false; lastTarget.current = null; }
      const boxMode = el.scrollHeight > el.clientHeight + 1;
      if (userScrolled.current) {
        // Stopped by a hand scroll: resume once the view is still. The follow below
        // then brings the view back to the word, wherever its row is.
        const vh = window.visualViewport?.height ?? window.innerHeight;
        const area = boxMode ? el.getBoundingClientRect() : { top: 0, bottom: vh };
        const bar = document.querySelector('.transport')?.getBoundingClientRect();
        const released = latchReleases({
          latched: true,
          wordInView: w.top >= area.top && w.bottom <= area.bottom,
          touching: touching.current,
          msSinceScroll: performance.now() - lastScroll.current,
          controlsVisible: !boxMode && !!bar && bar.bottom > 0 && bar.top < vh,
        });
        if (!released) return;
        userScrolled.current = false;
        lastTarget.current = null;
      }
      // Ask for a scroll only when the target differs from the last one asked for.
      const go = (top: number | null, scroll: (t: number) => void) => {
        if (top === null || top === lastTarget.current) return;
        lastTarget.current = top;
        scroll(top);
      };
      if (boxMode) {
        // Box follow (desk mode). Rows are measured from the top of the box's
        // padding, so the first row scrolls to 0.
        const b = el.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
        const top = followTarget({
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          rowTop: first ? 0 : w.top - b.top + el.scrollTop - pad,
          rowHeight: w.height,
        });
        go(top, (t) => el.scrollTo({ top: t, behavior: smoothness() }));
        return;
      }
      // Page follow. The ayah bounds the scroll, so its end stays reachable and
      // an ayah that fits on screen never scrolls.
      const guard = { ...ctxRef.current, settingsOpen: settingsOpen(), inputFocused: inputFocused(), userScrolled: false };
      if (!followAllowed(guard)) return;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const app = document.querySelector('.app');
      // The page's top padding (the safe-area inset plus 8px), and 4px more.
      const margin = (app ? parseFloat(getComputedStyle(app).paddingTop) || 0 : 0) + 4;
      const top = followTarget({
        scrollTop: window.scrollY,
        clientHeight: vh,
        scrollHeight: el.getBoundingClientRect().bottom + window.scrollY,
        rowTop: first ? 0 : w.top + window.scrollY - margin,
        rowHeight: w.height + margin,
      });
      go(top, (t) => {
        followedPage.current = true;
        window.scrollTo({ top: t, behavior: smoothness() });
      });
    };
    runFollow.current = run;
    run();
  }, [ref, activeWord]);
}
