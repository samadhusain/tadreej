import { useLayoutEffect, type RefObject } from 'react';

/** Smallest Arabic size the ayah shrinks to, in px. Below it the box scrolls. */
export const MIN_AYAH_PX = 20;

/** The largest whole-pixel size in [min, max] for which `fits` holds.
 *  Binary search. Returns min when nothing fits, so the caller has a floor. */
export function fitSize(fits: (size: number) => boolean, min: number, max: number): number {
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

/** Shrink the element's font from its CSS size (the maximum) until its content
 *  fits the box. Reruns when `deps` change and when the box resizes. */
export function useFitFont(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastW = -1;
    let lastH = -1;
    const run = () => {
      el.style.fontSize = '';
      const max = parseFloat(getComputedStyle(el).fontSize);
      const size = fitSize((s) => {
        el.style.fontSize = `${s}px`;
        return el.scrollHeight <= el.clientHeight;
      }, MIN_AYAH_PX, max);
      el.style.fontSize = `${size}px`;
    };
    run();
    const ro = new ResizeObserver(() => {
      // Our own font changes never resize the box, but guard against loops anyway.
      if (el.clientWidth === lastW && el.clientHeight === lastH) return;
      lastW = el.clientWidth;
      lastH = el.clientHeight;
      run();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
