import { describe, expect, it } from 'vitest';
import { parseDraft } from './numberDraft';

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
  });

  it('clamps to the limits', () => {
    expect(parseDraft('15', 1, 9, true)).toBe(9);
    expect(parseDraft('0', 1, 9, true)).toBe(1);
    expect(parseDraft('20', 0, 15, false)).toBe(15);
    expect(parseDraft('-3', 0, 5, false)).toBe(0);
  });

  it('lets the user clear the reps field and type 5 (not 9)', () => {
    // The field holds 1. The user clears it: nothing is saved. Then types 5.
    expect(parseDraft('', 1, 9, true)).toBeNull();
    expect(parseDraft('5', 1, 9, true)).toBe(5);
  });
});
