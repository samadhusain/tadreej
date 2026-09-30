/* ============================================================
   Tadreej — mushaf arithmetic: which ayahs, in what order.

   Kept free of DOM and audio so it can be unit-tested in a node
   environment.
   ============================================================ */

import PAGES_JSON from './data/pages.json';
import SURAHS_JSON from './data/surahs.json';

export const TOTAL_PAGES = 604;
export const TOTAL_SURAHS = 114;

/** Page → the surah/ayah runs printed on it, in mushaf order. */
const PAGES: Record<string, { s: number; f: number; t: number }[]> = PAGES_JSON as never;
const SURAHS: Record<string, SurahMeta> = SURAHS_JSON as never;

export interface SurahMeta {
  name: string;
  arabic: string;
  translation: string;
  ayahs: number;
  page: number;
  revelation: string;
}

export type UnitRef = { s: number; a: number };

export const clampPage = (p: number) => Math.min(TOTAL_PAGES, Math.max(1, p | 0));
export const clampSurah = (s: number) => Math.min(TOTAL_SURAHS, Math.max(1, s | 0));

export function surahMeta(s: number): SurahMeta {
  return SURAHS[String(s)] || { name: `Surah ${s}`, arabic: '', translation: '', ayahs: 0, page: 0, revelation: '' };
}

export function pageRangeLabel(page: number): string {
  const segs = PAGES[String(page)] || [];
  if (!segs.length) return '';
  const parts = segs.map((seg) => {
    const m = surahMeta(seg.s);
    return seg.f === seg.t ? `${m.name} ${seg.f}` : `${m.name} ${seg.f}–${seg.t}`;
  });
  return parts.join(' · ');
}

export function expandPage(page: number): UnitRef[] {
  const segs = PAGES[String(page)] || [];
  const out: UnitRef[] = [];
  for (const seg of segs) for (let a = seg.f; a <= seg.t; a++) out.push({ s: seg.s, a });
  return out;
}

export function expandSurah(s: number): UnitRef[] {
  const n = surahMeta(s).ayahs || 0;
  const out: UnitRef[] = [];
  for (let a = 1; a <= n; a++) out.push({ s, a });
  return out;
}

/* ---------- Page ranges ----------
   A range starts at the top of `fromPage` — never mid-page, because
   "start from page 4" has to mean everything printed on page 4 — and
   ends either at the last ayah of the surah that page 4 opens in, or
   at the bottom of a chosen `toPage`.

   The 51 pages that carry more than one surah make the 'surah' end
   ambiguous: page 604 opens with Al-Ikhlas and also holds Al-Falaq and
   An-Nas. The anchor is the surah of the page's *first* ayah, so no
   ayah on the page you picked is ever skipped. The picker previews the
   resolved span, so a short answer is visible before you press play. */

export type RangeEnd = 'surah' | 'page';

export interface PageRange {
  fromPage: number;
  end: RangeEnd;
  toPage: number;   // only read when end === 'page'
}

export interface ResolvedRange {
  ayahs: UnitRef[];
  pages: number[];    // every page the range touches — the text to load
  fromPage: number;
  toPage: number;     // last page actually reached
}

/** Snap a range into bounds: pages clamped, and a page-end never before its start. */
export function normalizeRange(r: PageRange): PageRange {
  const fromPage = clampPage(r.fromPage);
  const end: RangeEnd = r.end === 'page' ? 'page' : 'surah';
  return { fromPage, end, toPage: Math.max(fromPage, clampPage(r.toPage)) };
}

export function resolveRange(range: PageRange): ResolvedRange {
  const r = normalizeRange(range);
  const ayahs: UnitRef[] = [];
  const pages: number[] = [];

  if (r.end === 'page') {
    for (let p = r.fromPage; p <= r.toPage; p++) {
      pages.push(p);
      ayahs.push(...expandPage(p));
    }
    return { ayahs, pages, fromPage: r.fromPage, toPage: r.toPage };
  }

  const first = expandPage(r.fromPage)[0];
  if (!first) return { ayahs, pages, fromPage: r.fromPage, toPage: r.fromPage };
  const anchor = first.s;
  const lastAyah = surahMeta(anchor).ayahs;

  let toPage = r.fromPage;
  for (let p = r.fromPage; p <= TOTAL_PAGES; p++) {
    let touched = false;
    for (const ref of expandPage(p)) {
      if (ref.s !== anchor) break;   // the next surah has started — the range is done
      ayahs.push(ref);
      touched = true;
      if (ref.a >= lastAyah) break;
    }
    if (!touched) break;
    pages.push(p);
    toPage = p;
    if (ayahs.length && ayahs[ayahs.length - 1].a >= lastAyah) break;
  }
  return { ayahs, pages, fromPage: r.fromPage, toPage };
}

/** "Al-Mulk 13–30", or "Al-Kaafiroon 1 – An-Nas 6" when the span crosses surahs. */
export function rangeLabel(ayahs: UnitRef[]): string {
  if (!ayahs.length) return '';
  const a = ayahs[0];
  const z = ayahs[ayahs.length - 1];
  const ma = surahMeta(a.s);
  if (a.s === z.s) return a.a === z.a ? `${ma.name} ${a.a}` : `${ma.name} ${a.a}–${z.a}`;
  return `${ma.name} ${a.a} – ${surahMeta(z.s).name} ${z.a}`;
}

/** What the page pill shows: "4" for one page, "4–7" for several. */
export function rangePillLabel(fromPage: number, toPage: number): string {
  return fromPage === toPage ? String(fromPage) : `${fromPage}–${toPage}`;
}

/** Ayah playbacks one full pass of stepped mode costs: 1 + 2 + … + N, times reps.
 *  Stepped mode is quadratic, so a range picked by page can be far more
 *  recitation than it looks — the picker warns with this number. */
export function steppedPlaybacks(ayahCount: number, reps: number): number {
  return ((ayahCount * (ayahCount + 1)) / 2) * Math.max(1, reps);
}

/* ---------- Surah search normalizer (for the picker UI) ----------
   Forgiving search across transliteration variants: drop punctuation/spacing,
   collapse repeated letters, canonicalise long vowels to short. */
export const normalizeSurahQuery = (s: string) => (s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '')
  .replace(/(.)\1+/g, '$1')
  .replace(/e/g, 'i')
  .replace(/o/g, 'u');
