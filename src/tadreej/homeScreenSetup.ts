/* ============================================================
   Tadreej — the Add to Home Screen page of the setup sheet.
   It is the first page of the first-visit flow, and it opens alone from Settings.
   ============================================================ */

export type SetupPage = 'home' | 'drive';

export const HOME_SCREEN_TITLE = 'Add Tadreej to your Home Screen';

export const HOME_SCREEN_LEAD = 'Tadreej then opens in full screen, like an app.';

export const HOME_SCREEN_STEPS = [
  'In Safari, tap the Share button.',
  'Scroll down and tap Add to Home Screen.',
  'Tap Add.',
];

export const HOME_SCREEN_NOTES = [
  'On Android, open the Chrome menu and tap Add to Home screen.',
  'On iPhone, the Home Screen app and Safari each keep their own page and settings. The drive link opens Safari.',
];

/**
 * True when the app already runs from the Home Screen.
 * `displayModeStandalone` is `matchMedia('(display-mode: standalone)').matches`.
 * `iosStandalone` is the iOS-only `navigator.standalone`.
 */
export function runsFromHomeScreen(displayModeStandalone: boolean, iosStandalone: boolean | undefined): boolean {
  return displayModeStandalone || iosStandalone === true;
}

/** The pages of the first-visit flow. The Home Screen page drops out when the app already runs from there. */
export function firstVisitPages(alreadyOnHomeScreen: boolean): SetupPage[] {
  return alreadyOnHomeScreen ? ['drive'] : ['home', 'drive'];
}

/** The top-right dismiss button: Skip while more pages follow in the sheet, Close on a one-page sheet. */
export function dismissLabel(pageCount: number): 'Skip' | 'Close' {
  return pageCount > 1 ? 'Skip' : 'Close';
}

/** The bottom button: Next on every page but the last, Got it on the last. */
export function primaryLabel(last: boolean): 'Next' | 'Got it' {
  return last ? 'Got it' : 'Next';
}
