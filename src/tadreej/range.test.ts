import { describe, expect, it } from 'vitest';
import {
  expandPage,
  normalizeRange,
  rangeLabel,
  rangePillLabel,
  resolveRange,
  steppedPlaybacks,
} from './range';

/* Fixtures, all real mushaf pages:
   562 = Al-Mulk 1–12 · 563 = Al-Mulk 13–26 · 564 = Al-Mulk 27–30 then Al-Qalam 1–15
   49  = Al-Baqara 283–286 (the surah's last page) · 50 = Aal-i-Imraan 1–9
   604 = Al-Ikhlas 1–4, Al-Falaq 1–5, An-Nas 1–6 (three surahs on one page) */

describe('resolveRange — to the end of the surah', () => {
  it('runs from the top of the start page to the surah\'s last ayah', () => {
    const r = resolveRange({ fromPage: 563, end: 'surah', toPage: 563 });
    expect(r.ayahs[0]).toEqual({ s: 67, a: 13 });
    expect(r.ayahs[r.ayahs.length - 1]).toEqual({ s: 67, a: 30 });
    expect(r.ayahs).toHaveLength(18);
  });

  it('crosses page boundaries and reports every page it touched', () => {
    expect(resolveRange({ fromPage: 563, end: 'surah', toPage: 563 }).pages).toEqual([563, 564]);
    expect(resolveRange({ fromPage: 562, end: 'surah', toPage: 562 }).pages).toEqual([562, 563, 564]);
  });

  it('stops before the next surah that shares the closing page', () => {
    const r = resolveRange({ fromPage: 563, end: 'surah', toPage: 563 });
    expect(r.ayahs.some((x) => x.s === 68)).toBe(false);
    expect(r.toPage).toBe(564);
  });

  it('handles a start page that is already the surah\'s last', () => {
    const r = resolveRange({ fromPage: 49, end: 'surah', toPage: 49 });
    expect(r.ayahs).toEqual([
      { s: 2, a: 283 }, { s: 2, a: 284 }, { s: 2, a: 285 }, { s: 2, a: 286 },
    ]);
    expect(r.pages).toEqual([49]);
  });

  it('anchors on the surah the page opens in when the page carries several', () => {
    // Page 604 holds three surahs; the range is the one it starts with, so no
    // ayah printed above the start point is ever skipped.
    const r = resolveRange({ fromPage: 604, end: 'surah', toPage: 604 });
    expect(r.ayahs).toHaveLength(4);
    expect(r.ayahs.every((x) => x.s === 112)).toBe(true);
  });

  it('ignores toPage entirely', () => {
    const a = resolveRange({ fromPage: 563, end: 'surah', toPage: 563 });
    const b = resolveRange({ fromPage: 563, end: 'surah', toPage: 600 });
    expect(b.ayahs).toEqual(a.ayahs);
  });
});

describe('resolveRange — to a chosen page', () => {
  it('is the concatenation of the pages, inclusive of both ends', () => {
    const r = resolveRange({ fromPage: 562, end: 'page', toPage: 563 });
    expect(r.ayahs).toEqual([...expandPage(562), ...expandPage(563)]);
    expect(r.ayahs).toHaveLength(26);
    expect(r.pages).toEqual([562, 563]);
  });

  it('may span surahs — a page span is not clipped to one', () => {
    const r = resolveRange({ fromPage: 49, end: 'page', toPage: 50 });
    expect(r.ayahs[0]).toEqual({ s: 2, a: 283 });
    expect(r.ayahs[r.ayahs.length - 1]).toEqual({ s: 3, a: 9 });
  });

  it('degenerates to a single page, matching the page unit exactly', () => {
    const r = resolveRange({ fromPage: 4, end: 'page', toPage: 4 });
    expect(r.ayahs).toEqual(expandPage(4));
  });
});

describe('normalizeRange', () => {
  it('clamps pages into the mushaf', () => {
    expect(normalizeRange({ fromPage: 0, end: 'page', toPage: 900 }))
      .toEqual({ fromPage: 1, end: 'page', toPage: 604 });
  });

  it('never lets the end fall before the start', () => {
    expect(normalizeRange({ fromPage: 40, end: 'page', toPage: 10 }).toPage).toBe(40);
  });

  it('treats an unknown end mode as the surah end', () => {
    expect(normalizeRange({ fromPage: 5, end: 'nonsense' as never, toPage: 5 }).end).toBe('surah');
  });
});

describe('labels', () => {
  it('names one surah with its ayah span', () => {
    expect(rangeLabel(resolveRange({ fromPage: 563, end: 'surah', toPage: 563 }).ayahs))
      .toBe('Al-Mulk 13–30');
  });

  it('names both ends when the span crosses surahs', () => {
    expect(rangeLabel(resolveRange({ fromPage: 49, end: 'page', toPage: 50 }).ayahs))
      .toBe('Al-Baqara 283 – Aal-i-Imraan 9');
  });

  it('collapses the pill to one number when the range is one page', () => {
    expect(rangePillLabel(4, 4)).toBe('4');
    expect(rangePillLabel(4, 7)).toBe('4–7');
  });
});

describe('steppedPlaybacks', () => {
  it('is triangular in the ayah count and linear in reps', () => {
    expect(steppedPlaybacks(3, 1)).toBe(6);     // 1 + 2 + 3
    expect(steppedPlaybacks(3, 2)).toBe(12);
  });

  it('shows why a whole long surah is not a session: Al-Baqara from page 4', () => {
    const r = resolveRange({ fromPage: 4, end: 'surah', toPage: 4 });
    expect(r.ayahs).toHaveLength(270);
    expect(steppedPlaybacks(r.ayahs.length, 1)).toBe(36585);
  });
});
