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

describe('shouldShowDriveSetup', () => {
  it('shows on a first visit', () => {
    expect(shouldShowDriveSetup(memory(), q(''))).toBe(true);
  });
  it('stays hidden after the listener closes it', () => {
    const storage = memory();
    markDriveSetupSeen(storage);
    expect(shouldShowDriveSetup(storage, q(''))).toBe(false);
  });
  it('stays hidden on the drive link, so it never covers playback', () => {
    expect(shouldShowDriveSetup(memory(), q('autoplay=1'))).toBe(false);
    expect(shouldShowDriveSetup(memory(), q('play=1'))).toBe(false);
  });
  it('shows when autoplay is not 1', () => {
    expect(shouldShowDriveSetup(memory(), q('autoplay=0'))).toBe(true);
  });
  it('stays hidden when storage throws', () => {
    expect(shouldShowDriveSetup(broken, q(''))).toBe(false);
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
