import { describe, expect, it } from 'vitest';
import { DRIVE_SETUP_NOTES, DRIVE_SETUP_STEPS, driveSetupLink, markDriveSetupSeen, shouldShowDriveSetup } from './driveSetup';

const q = (s: string) => new URLSearchParams(s);
const memory = (data: Record<string, string> = {}) => ({
  getItem: (k: string) => data[k] ?? null,
  setItem: (k: string, v: string) => { data[k] = v; },
});
const broken = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
};

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// Modern iPads report as a Mac.
const IPAD = MAC_SAFARI;

describe('shouldShowDriveSetup', () => {
  it('shows on a first visit', () => {
    expect(shouldShowDriveSetup(memory(), q(''), IPHONE)).toBe(true);
  });
  it('stays hidden after the listener closes it', () => {
    const storage = memory();
    markDriveSetupSeen(storage);
    expect(shouldShowDriveSetup(storage, q(''), IPHONE)).toBe(false);
  });
  it('stays hidden on the drive link, so it never covers playback', () => {
    expect(shouldShowDriveSetup(memory(), q('autoplay=1'), IPHONE)).toBe(false);
    expect(shouldShowDriveSetup(memory(), q('play=1'), IPHONE)).toBe(false);
  });
  it('shows when autoplay is not 1', () => {
    expect(shouldShowDriveSetup(memory(), q('autoplay=0'), IPHONE)).toBe(true);
  });
  it('stays hidden when storage throws', () => {
    expect(shouldShowDriveSetup(broken, q(''), IPHONE)).toBe(false);
  });
  it('shows on an iPhone', () => {
    expect(shouldShowDriveSetup(memory(), q(''), IPHONE)).toBe(true);
  });
  it('shows on an Android phone', () => {
    expect(shouldShowDriveSetup(memory(), q(''), ANDROID_PHONE)).toBe(true);
  });
  it('stays hidden on a Mac desktop', () => {
    expect(shouldShowDriveSetup(memory(), q(''), MAC_SAFARI)).toBe(false);
  });
  it('stays hidden on a Windows desktop', () => {
    expect(shouldShowDriveSetup(memory(), q(''), WINDOWS_CHROME)).toBe(false);
  });
  it('stays hidden on an iPad', () => {
    expect(shouldShowDriveSetup(memory(), q(''), IPAD)).toBe(false);
  });
  it('stays hidden on an Android tablet', () => {
    expect(shouldShowDriveSetup(memory(), q(''), ANDROID_TABLET)).toBe(false);
  });
  it('stays hidden on the drive link from a phone', () => {
    expect(shouldShowDriveSetup(memory(), q('autoplay=1'), ANDROID_PHONE)).toBe(false);
  });
});

describe('markDriveSetupSeen', () => {
  it('swallows a storage error', () => {
    expect(() => markDriveSetupSeen(broken)).not.toThrow();
  });
});

describe('driveSetupLink', () => {
  it('keeps only the address and adds autoplay', () => {
    expect(driveSetupLink('https://tadreej.samad.sh/?page=50#x')).toBe('https://tadreej.samad.sh/?autoplay=1');
  });
  it('keeps a subpath', () => {
    expect(driveSetupLink('https://example.com/tadreej/')).toBe('https://example.com/tadreej/?autoplay=1');
  });
});

describe('DRIVE_SETUP_STEPS', () => {
  it('has six steps, and the fifth asks for the link', () => {
    expect(DRIVE_SETUP_STEPS).toHaveLength(6);
    expect(DRIVE_SETUP_STEPS[4]).toBe('Add the Open URLs action and paste this link:');
  });
});

describe('DRIVE_SETUP_NOTES', () => {
  it('says that a locked iPhone waits for the unlock', () => {
    expect(DRIVE_SETUP_NOTES[0]).toContain('A locked iPhone waits until you unlock it.');
  });
});
