import { useEffect, useLayoutEffect, type RefObject } from 'react';

export interface FollowInput {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  /** The active word's row, in content coordinates (not the viewport's). */
  rowTop: number;
  rowHeight: number;
}

/** Where to scroll the ayah box so the sounding row stays readable, or null
 *  to stay put. Like a page turn: a row that is not fully visible, or is the
 *  last fully visible row with more below, becomes the first visible row.
 *  The result is clamped to the maximum scroll, so the last rows do not jitter. */
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

/** Desk mode scrolls the ayah inside its box. This hook
 *  - starts every new ayah (`key`) at the top, instantly;
 *  - marks the box `data-more` while text remains below, for the fade cue;
 *  - follows the sounding word row by row, scrolling the box and never the page.
 *  Outside desk mode the box never overflows, so the hook does nothing. */
export function useAyahScroll(ref: RefObject<HTMLElement | null>, key: string, activeWord: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const cue = () => {
      if (el.scrollHeight - el.clientHeight - el.scrollTop > 2) el.setAttribute('data-more', '');
      else el.removeAttribute('data-more');
    };
    if (el.scrollTop !== 0) el.scrollTop = 0;
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
    const b = el.getBoundingClientRect();
    const w = word.getBoundingClientRect();
    // Rows are measured from the top of the box's padding, so the first row scrolls to 0.
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const top = followTarget({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      rowTop: w.top - b.top + el.scrollTop - pad,
      rowHeight: w.height,
    });
    if (top !== null) el.scrollTo({ top, behavior: 'smooth' });
  }, [ref, activeWord]);
}
