import { describe, expect, it } from 'vitest';
import { mergeSettings, stepLabel } from './engine';

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

describe('mergeSettings', () => {
  it('turns the highlight on when nothing is saved', () => {
    expect(mergeSettings({}).highlight).toBe(true);
  });

  it('turns the highlight on for settings saved before the key existed', () => {
    const merged = mergeSettings({ wordByWord: false, reps: 3 });
    expect(merged.highlight).toBe(true);
    expect(merged.wordByWord).toBe(false);
    expect(merged.reps).toBe(3);
  });

  it('keeps a saved highlight choice', () => {
    expect(mergeSettings({ highlight: false }).highlight).toBe(false);
  });
});
