/* ============================================================
   Tadreej — the drive setup screen.
   It gives the steps that make Tadreej play when the phone connects
   to the vehicle. It opens by itself on the first visit, once.
   ============================================================ */

const LS_DRIVE_SETUP_SEEN = 'tadreej.driveSetupSeen';

export const DRIVE_SETUP_TITLE = 'Play when you start driving';

export const DRIVE_SETUP_LEAD =
  'Set this up once on your iPhone. Then Tadreej opens each time your phone connects to your vehicle\'s Bluetooth.';

/** The six steps. The fifth ends with the link, which the sheet shows below it. */
export const DRIVE_SETUP_STEPS = [
  'Open the Shortcuts app and tap Automation.',
  'Tap +, then choose Bluetooth. If you use CarPlay, choose CarPlay instead.',
  'Pick your vehicle, then choose Run Immediately.',
  'Tap Next, then New Blank Automation.',
  'Add the Open URLs action and paste this link:',
  'Tap Done.',
];

export const DRIVE_SETUP_NOTES = [
  'The link opens Tadreej in Safari, on the page you last played there. iPhone blocks sound until you touch the screen, so tap once to start.',
  'On Android, an automation app such as MacroDroid can open the same link when Bluetooth connects.',
];

/** False on the drive link itself, and when storage cannot remember the answer. */
export function shouldShowDriveSetup(storage: Pick<Storage, 'getItem'>, query: URLSearchParams): boolean {
  if (query.get('autoplay') === '1' || query.get('play') === '1') return false;
  try {
    return !storage.getItem(LS_DRIVE_SETUP_SEEN);
  } catch {
    return false;
  }
}

export function markDriveSetupSeen(storage: Pick<Storage, 'setItem'>): void {
  try { storage.setItem(LS_DRIVE_SETUP_SEEN, '1'); } catch { /* noop */ }
}

/** The app's own address with `?autoplay=1`. It drops any other query and the hash. */
export function driveSetupLink(appUrl: string): string {
  const url = new URL(appUrl);
  url.search = '?autoplay=1';
  url.hash = '';
  return url.toString();
}
