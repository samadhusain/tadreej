import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECITER,
  DEFAULT_EXTRA_AUDIO_BASE,
  EVERYAYAH_BASE,
  audioCachePattern,
  buildReciters,
  extraAudioBase,
  normalizeBase,
  resolveReciterId,
} from './reciters';

describe('buildReciters', () => {
  it('offers only the seven everyayah.com reciters when no extra base is set', () => {
    const list = buildReciters(undefined);
    expect(list).toHaveLength(7);
    expect(list.every((r) => r.base === undefined)).toBe(true);
  });

  it('treats an empty or blank base as unset', () => {
    expect(buildReciters('')).toHaveLength(7);
    expect(buildReciters('   ')).toHaveLength(7);
  });

  it('adds Sufi and Noreen on the extra base', () => {
    const list = buildReciters('https://audio.example.com');
    expect(list).toHaveLength(9);
    expect(list.slice(7).map((r) => r.id)).toEqual(['abdurrashid_sufi', 'noreen_siddiq']);
    expect(list.slice(7).every((r) => r.base === 'https://audio.example.com')).toBe(true);
  });

  it('drops trailing slashes so audio URLs get exactly one', () => {
    expect(buildReciters('/tadreej-audio/')[8].base).toBe('/tadreej-audio');
    expect(normalizeBase('https://audio.example.com//')).toBe('https://audio.example.com');
  });
});

describe('extraAudioBase', () => {
  it('uses the public host when the variable is not set', () => {
    expect(extraAudioBase(undefined)).toBe(DEFAULT_EXTRA_AUDIO_BASE);
    expect(DEFAULT_EXTRA_AUDIO_BASE).toBe('https://tadreej-audio.samad.sh');
  });

  it('uses a set value, normalised', () => {
    expect(extraAudioBase('https://audio.example.com//')).toBe('https://audio.example.com');
  });

  it('turns the extra reciters off for a blank value', () => {
    expect(extraAudioBase('')).toBeUndefined();
    expect(extraAudioBase('   ')).toBeUndefined();
  });
});

describe('resolveReciterId', () => {
  const publicList = buildReciters(undefined);

  it('keeps a reciter this build offers', () => {
    expect(resolveReciterId('Husary_128kbps', publicList)).toBe('Husary_128kbps');
  });

  it('falls back to the default for a reciter this build does not offer', () => {
    expect(resolveReciterId('noreen_siddiq', publicList)).toBe(DEFAULT_RECITER);
    expect(resolveReciterId(undefined, publicList)).toBe(DEFAULT_RECITER);
  });
});

describe('audioCachePattern', () => {
  it('matches only everyayah.com when no extra base is set', () => {
    const re = audioCachePattern(undefined);
    expect(re.test(`${EVERYAYAH_BASE}/Alafasy_128kbps/001001.mp3`)).toBe(true);
    expect(re.test('https://audio.example.com/noreen_siddiq/001001.mp3')).toBe(false);
  });

  it('matches an absolute extra base only from the start of the URL', () => {
    const re = audioCachePattern('https://audio.example.com/');
    expect(re.test('https://audio.example.com/noreen_siddiq/001001.mp3')).toBe(true);
    expect(re.test('https://other.example/?u=https://audio.example.com/x')).toBe(false);
  });

  it('matches a same-origin path base as a path', () => {
    const re = audioCachePattern('/tadreej-audio');
    expect(re.test('https://host.example/tadreej-audio/abdurrashid_sufi/001001.mp3')).toBe(true);
  });
});
