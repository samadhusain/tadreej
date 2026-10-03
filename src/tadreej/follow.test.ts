import { describe, expect, it } from 'vitest';
import { followTarget } from './follow';

// A 400px box over 1000px of content, in rows 100px tall: max scroll is 600.
const box = { clientHeight: 400, scrollHeight: 1000, rowHeight: 100 };

describe('followTarget', () => {
  it('leaves a row that is fully visible mid-box alone', () => {
    expect(followTarget({ ...box, scrollTop: 0, rowTop: 100 })).toBeNull();
  });

  it('turns the page when the row is the last fully visible one and more follows', () => {
    expect(followTarget({ ...box, scrollTop: 0, rowTop: 300 })).toBe(300);
  });

  it('brings a row below the view to the top', () => {
    expect(followTarget({ ...box, scrollTop: 0, rowTop: 500 })).toBe(500);
  });

  it('brings a row that is only partly visible to the top', () => {
    expect(followTarget({ ...box, scrollTop: 0, rowTop: 350 })).toBe(350);
  });

  it('brings a row above the view to the top', () => {
    expect(followTarget({ ...box, scrollTop: 300, rowTop: 100 })).toBe(100);
  });

  it('clamps the last row to the maximum scroll', () => {
    expect(followTarget({ ...box, scrollTop: 500, rowTop: 900 })).toBe(600);
  });

  it('does not move once the end is reached', () => {
    expect(followTarget({ ...box, scrollTop: 600, rowTop: 900 })).toBeNull();
    expect(followTarget({ ...box, scrollTop: 600, rowTop: 800 })).toBeNull();
  });

  it('does not move when the row is already the first visible row', () => {
    expect(followTarget({ ...box, scrollTop: 300, rowTop: 300 })).toBeNull();
  });

  it('does nothing when the box does not overflow', () => {
    expect(followTarget({ clientHeight: 400, scrollHeight: 400, rowHeight: 100, scrollTop: 0, rowTop: 300 })).toBeNull();
  });
});
