import { describe, expect, it } from 'vitest';
import { isStale, parseDraft, typeDraft } from './numberDraft';

describe('parseDraft', () => {
  it('returns null for an empty or unparseable draft', () => {
    for (const text of ['', ' ', '-', '.', 'abc']) {
      expect(parseDraft(text, 1, 9, true)).toBeNull();
      expect(parseDraft(text, 0, 15, false)).toBeNull();
    }
  });

  it('parses an integer draft', () => {
    expect(parseDraft('5', 1, 9, true)).toBe(5);
  });

  it('parses a decimal draft, including a half-typed one', () => {
    expect(parseDraft('1.5', 0, 15, false)).toBe(1.5);
    expect(parseDraft('1.', 0, 15, false)).toBe(1);
    expect(parseDraft('1.7', 1, 9, true)).toBe(1);
  });

  it('clamps to the limits', () => {
    expect(parseDraft('15', 1, 9, true)).toBe(9);
    expect(parseDraft('0', 1, 9, true)).toBe(1);
    expect(parseDraft('20', 0, 15, false)).toBe(15);
    expect(parseDraft('-3', 0, 5, false)).toBe(0);
  });
});

describe('typeDraft', () => {
  it('commits a complete number and expects it as the saved value', () => {
    expect(typeDraft('15', 1, 1, 9, true)).toEqual({ draft: { text: '15', expect: 9 }, commit: 9 });
  });

  it('commits nothing for an empty draft and expects the saved value', () => {
    expect(typeDraft('', 5, 1, 604, true)).toEqual({ draft: { text: '', expect: 5 }, commit: null });
  });
});

describe('isStale', () => {
  it('is false while the saved value is the one the draft produced', () => {
    expect(isStale({ text: '7', expect: 7 }, 7)).toBe(false);
  });

  it('is true after a cleared draft at 5 when + moves the value to 6', () => {
    const { draft } = typeDraft('', 5, 1, 604, true);
    expect(isStale(draft, 6)).toBe(true);
  });

  it('is true after typing 7 at 5 when − moves the value to 6', () => {
    const { draft } = typeDraft('7', 5, 1, 604, true);
    expect(isStale(draft, 6)).toBe(true);
  });
});
