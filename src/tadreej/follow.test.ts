import { describe, expect, it } from 'vitest';
import { followAllowed, followTarget } from './follow';

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

describe('followTarget edge cases', () => {
  it('clamps a negative row top to 0', () => {
    expect(followTarget({ ...box, scrollTop: 300, rowTop: -50 })).toBe(0);
  });

  it('brings the first row back to 0', () => {
    expect(followTarget({ ...box, scrollTop: 300, rowTop: 0 })).toBe(0);
    expect(followTarget({ ...box, scrollTop: 0, rowTop: 0 })).toBeNull();
  });

  it('ignores a move of under a pixel', () => {
    // The row is the last visible one, but the target is 0.5px from where the box already is.
    expect(followTarget({ clientHeight: 150, scrollHeight: 1000, rowHeight: 100, scrollTop: 299.5, rowTop: 300 })).toBeNull();
  });

  it('does not jitter on a row taller than the view', () => {
    expect(followTarget({ clientHeight: 400, scrollHeight: 1000, rowHeight: 600, scrollTop: 0, rowTop: 0 })).toBeNull();
    expect(followTarget({ clientHeight: 400, scrollHeight: 1000, rowHeight: 600, scrollTop: 0, rowTop: 300 })).toBe(300);
  });

  it('works with page-shaped input, where the row height includes the top margin', () => {
    // Row (with its 12px margin) ends at 1812, below the 1800px bottom of the view.
    expect(followTarget({ scrollTop: 1000, clientHeight: 800, scrollHeight: 5000, rowTop: 1700, rowHeight: 112 })).toBe(1700);
  });
});

describe('followAllowed', () => {
  const ok = { playing: true, settingsOpen: false, sheetOpen: false, gateVisible: false, inputFocused: false, userScrolled: false };

  it('follows while playing with nothing in the way', () => {
    expect(followAllowed(ok)).toBe(true);
  });

  it('does not follow when audio is not playing', () => {
    expect(followAllowed({ ...ok, playing: false })).toBe(false);
  });

  it.each(['settingsOpen', 'sheetOpen', 'gateVisible', 'inputFocused'] as const)('does not follow when %s', (k) => {
    expect(followAllowed({ ...ok, [k]: true })).toBe(false);
  });

  it('stops for good once the user has scrolled', () => {
    expect(followAllowed({ ...ok, userScrolled: true })).toBe(false);
  });
});
