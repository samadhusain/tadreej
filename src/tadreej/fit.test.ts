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

  it('probes whole pixels when max is fractional', () => {
    const probed: number[] = [];
    const size = fitSize((s) => { probed.push(s); return s <= 30; }, 20, 46.444);
    expect(probed.every(Number.isInteger)).toBe(true);
    expect(size).toBe(30);
  });

  it('returns a whole pixel when a fractional max fits', () => {
    expect(fitSize(() => true, 20, 46.444)).toBe(46);
  });
});
