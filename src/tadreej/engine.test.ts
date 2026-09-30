import { describe, expect, it } from 'vitest';
import { stepLabel } from './engine';

describe('stepLabel', () => {
  it('says Loading until the page, range or surah is expanded', () => {
    expect(stepLabel(0, 'stepped', 0, -1)).toBe('Loading…');
  });

  it('says Ready, with the ayah count, before anything plays', () => {
    expect(stepLabel(7, 'stepped', 0, -1)).toBe('Ready · 7 ayahs');
    expect(stepLabel(7, 'loop', 0, -1)).toBe('Ready · 7 ayahs');
    expect(stepLabel(1, 'stepped', 0, -1)).toBe('Ready · 1 ayah');
  });

  it('shows the step and the ayah sounding now while playing', () => {
    expect(stepLabel(7, 'stepped', 3, 1)).toBe('Step 3 / 7 · ayah 2');
    expect(stepLabel(7, 'loop', 5, 4)).toBe('Ayah 5 / 7 · loop');
  });
});
