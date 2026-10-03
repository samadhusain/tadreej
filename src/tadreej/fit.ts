import { useLayoutEffect, type RefObject } from 'react';

/** Smallest Arabic size the ayah shrinks to, in px. */
export const MIN_AYAH_PX = 20;

/** The largest whole-pixel size in [min, max] for which `fits` holds.
 *  Binary search over whole pixels: a fractional max is floored first.
 *  Returns min when nothing fits, so the caller has a floor. */
export function fitSize(fits: (size: number) => boolean, min: number, max: number): number {
  max = Math.floor(max);
  if (max <= min) return max;
  if (fits(max)) return max;
  let lo = min; // assumed to fit, or the floor
  let hi = max; // known not to fit
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Fit an ayah to its box. Shrinks the font from its CSS size (the maximum)
 *  to MIN_AYAH_PX until the content fits. If it still does not fit:
 *  - `--fit-overflow: scroll` (fixed-height desktop layout) keeps the floor
 *    size and the box scrolls inside itself;
 *  - `--fit-overflow: grow` (everywhere else) restores the CSS size and sets
 *    data-fit="grow", which lets the box grow and the page scroll.
 *  Reruns when `key` changes (a new ayah, or words on/off), when the box
 *  resizes, and once webfonts load. A new key also resets the inner scroll. */
export function useFitFont(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let lastW = -1;
    let lastH = -1;
    const run = () => {
      el.removeAttribute('data-fit'); // measure the one-screen box, not the grown one
      el.style.fontSize = '';
      const cs = getComputedStyle(el);
      const grow = cs.getPropertyValue('--fit-overflow').trim() === 'grow';
      const fits = (s: number) => {
        el.style.fontSize = `${s}px`;
        return el.scrollHeight <= el.clientHeight;
      };
      const size = fitSize(fits, MIN_AYAH_PX, parseFloat(cs.fontSize));
      // fits() leaves the font at `size`; at the floor with no fit, grow mode undoes it.
      if (!fits(size) && grow) {
        el.style.fontSize = '';
        el.setAttribute('data-fit', 'grow');
      }
      lastW = el.clientWidth;
      lastH = el.clientHeight;
    };
    el.scrollTop = 0;
    run();
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastW && el.clientHeight === lastH) return;
      run();
    });
    ro.observe(el);
    document.fonts?.ready.then(() => { if (alive) run(); });
    return () => { alive = false; ro.disconnect(); };
  }, [ref, key]);
}
