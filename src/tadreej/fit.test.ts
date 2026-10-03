import { describe, expect, it } from 'vitest';
import { fitSize } from './fit';

describe('fitSize', () => {
  it('returns max when max fits', () => {
    expect(fitSize(() => true, 20, 48)).toBe(48);
  });

  it('returns the largest size that fits', () => {
    expect(fitSize((s) => s <= 31, 20, 48)).toBe(31);
  });

  it('returns min when nothing fits', () => {
    expect(fitSize(() => false, 20, 48)).toBe(20);
  });

  it('returns min when only min fits', () => {
    expect(fitSize((s) => s <= 20, 20, 48)).toBe(20);
  });

  it('returns max when max is below min', () => {
    expect(fitSize(() => false, 20, 16)).toBe(16);
  });

  it('calls fits only a handful of times', () => {
    let calls = 0;
    fitSize((s) => { calls++; return s <= 37; }, 20, 64);
    expect(calls).toBeLessThanOrEqual(7);
  });
});
