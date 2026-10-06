import { describe, expect, it } from 'vitest';
import { mergeSettings, stepLabel, type TadreejSettings } from './engine';

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

  it('limits a stepPause above the range to the top', () => {
    expect(mergeSettings({ stepPause: 60 }).stepPause).toBe(15);
  });

  it('limits a stepPause below the range to the bottom', () => {
    expect(mergeSettings({ stepPause: -3 }).stepPause).toBe(0);
  });

  it('limits an ayahGap above the range to the top', () => {
    expect(mergeSettings({ ayahGap: 9 }).ayahGap).toBe(5);
  });

  it('limits reps below the range to the bottom', () => {
    expect(mergeSettings({ reps: 0 }).reps).toBe(1);
  });

  it('limits reps above the range to the top', () => {
    expect(mergeSettings({ reps: 500 }).reps).toBe(9);
  });

  it('drops the fraction of reps', () => {
    expect(mergeSettings({ reps: 2.5 }).reps).toBe(2);
  });

  it('loads a default for a value that is not a number', () => {
    const merged = mergeSettings({ reps: '5', stepPause: 'abc', ayahGap: null } as unknown as Partial<TadreejSettings>);
    expect(merged.reps).toBe(1);
    expect(merged.stepPause).toBe(1);
    expect(merged.ayahGap).toBe(0.4);
  });

  it('loads a default for NaN', () => {
    expect(mergeSettings({ stepPause: NaN }).stepPause).toBe(1);
  });

  it('loads a default for Infinity', () => {
    expect(mergeSettings({ reps: Infinity }).reps).toBe(1);
    expect(mergeSettings({ ayahGap: -Infinity }).ayahGap).toBe(0.4);
  });

  it('keeps an in-range value, with its fraction for stepPause and ayahGap', () => {
    const merged = mergeSettings({ reps: 4, stepPause: 0.5, ayahGap: 0.1 });
    expect(merged.reps).toBe(4);
    expect(merged.stepPause).toBe(0.5);
    expect(merged.ayahGap).toBe(0.1);
  });
});
