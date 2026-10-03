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

/** After user scroll input, the page follow waits this long. */
export const USER_PAUSE_MS = 5000;

export interface FollowGuard {
  playing: boolean;
  settingsOpen: boolean;
  sheetOpen: boolean;
  gateVisible: boolean;
  inputFocused: boolean;
  msSinceUserInput: number;
}

/** Whether the page may follow the sounding word now. Never fight the user. */
export function followAllowed(g: FollowGuard): boolean {
  return g.playing && !g.settingsOpen && !g.sheetOpen && !g.gateVisible
    && !g.inputFocused && g.msSinceUserInput >= USER_PAUSE_MS;
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

const smoothness = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export interface ScrollContext {
  playing: boolean;
  sheetOpen: boolean;
  gateVisible: boolean;
}

/** Keeps the sounding word in view.
 *  - Desk mode: the ayah scrolls inside its box (it overflows); the page stays put.
 *  - Phones and tablets: the box never overflows, so the page follows instead.
 *    Guarded by followAllowed; a new ayah returns the page to the top.
 *  A new ayah (`key`) starts the box at the top, and `data-more` marks a box
 *  with text below, for the fade cue. */
export function useAyahScroll(
  ref: RefObject<HTMLElement | null>, key: string, activeWord: number, ctx: ScrollContext,
) {
  const ctxRef = useRef(ctx);
  const lastInput = useRef(-Infinity);
  const followedPage = useRef(false);
  useEffect(() => { ctxRef.current = ctx; });

  const allowed = () => {
    const a = document.activeElement;
    return followAllowed({
      ...ctxRef.current,
      settingsOpen: Boolean(document.querySelector<HTMLDetailsElement>('.settings')?.open),
      inputFocused: !!a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName),
      msSinceUserInput: performance.now() - lastInput.current,
    });
  };

  // User scroll input pauses the page follow. Programmatic scrolls fire no input events.
  useEffect(() => {
    const note = () => { lastInput.current = performance.now(); };
    const onKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) note(); };
    const opts = { passive: true } as const;
    window.addEventListener('touchstart', note, opts);
    window.addEventListener('touchmove', note, opts);
    window.addEventListener('wheel', note, opts);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('touchstart', note);
      window.removeEventListener('touchmove', note);
      window.removeEventListener('wheel', note);
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
    // A new ayah brings the page back to the top, if the follow moved it.
    if (followedPage.current && allowed()) {
      followedPage.current = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    cue();
    el.addEventListener('scroll', cue, { passive: true });
    const ro = new ResizeObserver(cue);
    ro.observe(el);
    document.fonts?.ready.then(() => { if (alive) cue(); });
    return () => { alive = false; el.removeEventListener('scroll', cue); ro.disconnect(); };
  }, [ref, key]);

  useEffect(() => {
    const el = ref.current;
    const word = el?.querySelector('.word.is-active');
    if (!el || !word) return;
    const w = word.getBoundingClientRect();
    if (el.scrollHeight > el.clientHeight + 1) {
      // Box follow (desk mode).
      const b = el.getBoundingClientRect();
      // Rows are measured from the top of the box's padding, so the first row scrolls to 0.
      const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
      const top = followTarget({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        rowTop: w.top - b.top + el.scrollTop - pad,
        rowHeight: w.height,
      });
      if (top !== null) el.scrollTo({ top, behavior: smoothness() });
      return;
    }
    // Page follow. The ayah bounds the scroll, so its end stays reachable and
    // an ayah that fits on screen never scrolls.
    if (!allowed()) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const app = document.querySelector('.app');
    const margin = (app ? parseFloat(getComputedStyle(app).paddingTop) || 0 : 0) + 4; // safe-area top + ~12px
    const top = followTarget({
      scrollTop: window.scrollY,
      clientHeight: vh,
      scrollHeight: el.getBoundingClientRect().bottom + window.scrollY,
      rowTop: w.top + window.scrollY - margin,
      rowHeight: w.height + margin,
    });
    if (top !== null) {
      followedPage.current = true;
      window.scrollTo({ top, behavior: smoothness() });
    }
  }, [ref, activeWord]);
}
