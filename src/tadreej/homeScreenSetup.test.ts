import { describe, expect, it } from 'vitest';
import {
  HOME_SCREEN_NOTES,
  HOME_SCREEN_STEPS,
  HOME_SCREEN_TITLE,
  dismissLabel,
  firstVisitPages,
  primaryLabel,
  runsFromHomeScreen,
} from './homeScreenSetup';

describe('runsFromHomeScreen', () => {
  it('is true when the display mode is standalone', () => {
    expect(runsFromHomeScreen(true, undefined)).toBe(true);
  });
  it('is true when iOS reports standalone', () => {
    expect(runsFromHomeScreen(false, true)).toBe(true);
  });
  it('is false in a normal browser tab', () => {
    expect(runsFromHomeScreen(false, false)).toBe(false);
    expect(runsFromHomeScreen(false, undefined)).toBe(false);
  });
});

describe('firstVisitPages', () => {
  it('shows both pages in a browser', () => {
    expect(firstVisitPages(false)).toEqual(['home', 'drive']);
  });
  it('shows only the drive page from the Home Screen', () => {
    expect(firstVisitPages(true)).toEqual(['drive']);
  });
});

describe('home screen copy', () => {
  it('has the title, three steps and two notes', () => {
    expect(HOME_SCREEN_TITLE).toBe('Add Tadreej to your Home Screen');
    expect(HOME_SCREEN_STEPS).toEqual([
      'In Safari, tap the Share button.',
      'Scroll down and tap Add to Home Screen.',
      'Tap Add.',
    ]);
    expect(HOME_SCREEN_NOTES).toHaveLength(2);
  });
});

describe('dismissLabel', () => {
  it('says Skip when the sheet has more than one page', () => {
    expect(dismissLabel(2)).toBe('Skip');
  });
  it('says Close when the sheet has one page', () => {
    expect(dismissLabel(1)).toBe('Close');
  });
});

describe('primaryLabel', () => {
  it('says Next on a page that is not the last', () => {
    expect(primaryLabel(false)).toBe('Next');
  });
  it('says Got it on the last page', () => {
    expect(primaryLabel(true)).toBe('Got it');
  });
});
