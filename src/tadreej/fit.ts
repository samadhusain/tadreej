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

/** Desk mode only: fit an ayah to its box. The CSS sets `--fit: on` on the
 *  element from 980x600 up. Elsewhere the hook leaves the element alone.
 *  Shrinks the font from its CSS size (the maximum) to MIN_AYAH_PX until the
 *  content fits. At the floor the box scrolls inside itself.
 *  Reruns when `key` changes (a new ayah, or words on/off), when the box
 *  resizes (this includes crossing the desk breakpoint, which clears the fit),
 *  and once webfonts load. A new key resets the inner scroll. */
export function useFitFont(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let lastW = -1;
    let lastH = -1;
    const deskOn = () => getComputedStyle(el).getPropertyValue('--fit').trim() === 'on';
    const run = () => {
      el.style.fontSize = '';
      if (deskOn()) {
        const fits = (s: number) => {
          el.style.fontSize = `${s}px`;
          return el.scrollHeight <= el.clientHeight;
        };
        // fits() leaves the font at the size it last tried: the answer, or the floor.
        const size = fitSize(fits, MIN_AYAH_PX, parseFloat(getComputedStyle(el).fontSize));
        fits(size);
      }
      if (!el.getAttribute('style')) el.removeAttribute('style'); // leave no empty style behind
      lastW = el.clientWidth;
      lastH = el.clientHeight;
    };
    if (deskOn()) el.scrollTop = 0;
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
