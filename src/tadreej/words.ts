/* ============================================================
   Tadreej — word-by-word translation, and which word is sounding.

   The translations and the word timings come from the Quran.com API,
   one request per mushaf page. The Arabic stays the Tanzil text the
   app already shows: it is split on spaces and paired with the
   translations by position.

   Pure: no DOM and no fetch, so the unit tests can import it.
   ============================================================ */

const WORDS_API = 'https://api.quran.com/api/v4/verses/by_page';

/** Quran.com recitation ids whose word timings fit the EveryAyah files:
 *  both sites serve the same recordings, so the timings carry over.
 *  A reciter missing here gets translations but no highlight. */
const RECITATION_IDS: Record<string, number> = {
  Abdul_Basit_Murattal_192kbps: 2,
  Hani_Rifai_192kbps: 5,
  Husary_128kbps: 6,
  Alafasy_128kbps: 7,
  Minshawy_Murattal_128kbps: 9,
};

/** The text API puts the Bismillah in front of ayah 1 of every surah but
 *  Al-Fatihah, where it is the ayah, and At-Tawbah, which has none. */
const BISMILLAH = ['In (the) name', '(of) Allah', 'the Most Gracious', 'the Most Merciful'];

/** One timing: [word, start ms, end ms]. Words count from 1. */
export type Segment = [number, number, number];

export interface AyahWords { tr: string[]; segs: Segment[] }

/** A word as shown. `pos` is the word's number in the timings, or 0 for a
 *  word the recording does not hold. */
export interface WordView { ar: string; tr: string; pos: number }

export const hasTimings = (reciter: string) => reciter in RECITATION_IDS;

export function wordsUrl(page: number, reciter: string): string {
  const id = RECITATION_IDS[reciter];
  return `${WORDS_API}/${page}?words=true&per_page=50${id ? `&audio=${id}` : ''}`;
}

const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

/** Split an ayah into words. A pause mark stands alone in the text, so it
 *  joins the word before it; a mark that opens the ayah joins the word after. */
export function splitWords(text: string): string[] {
  const out: string[] = [];
  let lead = '';
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    if (ARABIC_LETTER.test(tok)) { out.push(lead + tok); lead = ''; }
    else if (out.length) out[out.length - 1] += ` ${tok}`;
    else lead += `${tok} `;
  }
  return out;
}

/** Pair the words of an ayah with their translations, or null when the two
 *  sources count the words differently. */
export function alignWords(text: string, tr: string[], ayah: number): WordView[] | null {
  const ar = splitWords(text);
  if (!tr.length) return null;
  const lead = ar.length - tr.length;
  if (lead !== 0 && !(lead === BISMILLAH.length && ayah === 1)) return null;
  return ar.map((word, i) => (i < lead
    ? { ar: word, tr: BISMILLAH[i], pos: 0 }
    : { ar: word, tr: tr[i - lead], pos: i - lead + 1 }));
}

/** Read one page of the Quran.com response into ayah key → words. */
export function parseWordsPage(data: unknown): Record<string, AyahWords> {
  const out: Record<string, AyahWords> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (data as any)?.verses ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tr = (v.words ?? []).filter((w: any) => w.char_type_name === 'word').map((w: any) => String(w.translation?.text ?? ''));
    // A timing is [index, word, start, end]; a few lack the index.
    const segs = ((v.audio?.segments ?? []) as unknown[][])
      .map((s) => s.slice(-3))
      .filter((s): s is Segment => s.length === 3 && s.every((n) => typeof n === 'number'));
    out[v.verse_key] = { tr, segs };
  }
  return out;
}

/** The word sounding at `ms` into the ayah: the last one to have started.
 *  0 means none has. */
export function activeWord(segs: Segment[], ms: number): number {
  let pos = 0;
  for (const [word, start] of segs) {
    if (start > ms) break;
    pos = word;
  }
  return pos;
}
