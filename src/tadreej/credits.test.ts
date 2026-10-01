import { describe, expect, it } from 'vitest';
import { footerCredits } from './credits';

const hrefs = (extra: boolean) => footerCredits(extra).flatMap((line) => line.links.map((l) => l.href));

describe('footerCredits', () => {
  it('always names the Tanzil Project and links tanzil.net', () => {
    for (const extra of [false, true]) {
      const text = footerCredits(extra).find((line) => line.label === 'Text:');
      expect(text?.links[0]).toEqual({ text: 'Tanzil Project', href: 'https://tanzil.net' });
    }
  });

  it('credits QuranicAudio and QUD only when the extra reciters are on', () => {
    expect(hrefs(false)).not.toContain('https://quranicaudio.com');
    expect(hrefs(true)).toContain('https://quranicaudio.com');
    expect(hrefs(true)).toContain('https://github.com/QUD-Technologies/quranic-universal-audio');
  });

  it('always calls the code open source and links the repo', () => {
    for (const extra of [false, true]) {
      const code = footerCredits(extra).find((line) => line.label === 'Code:');
      expect(code?.links).toEqual([
        { text: 'open source on GitHub', href: 'https://github.com/samadhusain/tadreej' },
      ]);
    }
  });

  it('credits Samad, linked to his GitHub profile, from Datstra Analytics', () => {
    for (const extra of [false, true]) {
      const by = footerCredits(extra).find((line) => line.label === 'Built with love by');
      expect(by?.joiner).toBe(' from ');
      expect(by?.links).toEqual([
        { text: 'Samad', href: 'https://github.com/samadhusain' },
        { text: 'Datstra Analytics', href: 'https://datstraanalytics.com' },
      ]);
    }
  });

  it('always credits EveryAyah.com, AlQuran Cloud and Datstra Analytics', () => {
    for (const extra of [false, true]) {
      expect(hrefs(extra)).toEqual(
        expect.arrayContaining(['https://everyayah.com', 'https://alquran.cloud', 'https://datstraanalytics.com']),
      );
    }
  });
});
