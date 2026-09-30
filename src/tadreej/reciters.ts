/* ============================================================
   Tadreej — which reciters a build offers, and where their audio lives.

   Pure: no DOM and no import.meta.env, so vite.config.ts and the
   unit tests can import it. engine.ts applies it to the build's
   VITE_EXTRA_AUDIO_BASE.
   ============================================================ */

export interface Reciter {
  /** The audio folder: <base>/<id>/SSSAAA.mp3 */
  id: string;
  name: string;
  /** Where the folder lives. Unset means everyayah.com. */
  base?: string;
}

export const EVERYAYAH_BASE = 'https://everyayah.com/data';
export const DEFAULT_RECITER = 'Alafasy_128kbps';

const EVERYAYAH_RECITERS: Reciter[] = [
  { id: 'Alafasy_128kbps', name: 'Mishari Al-Afasy' },
  { id: 'Abdul_Basit_Murattal_192kbps', name: 'Abdul Basit (Murattal)' },
  { id: 'Husary_128kbps', name: 'Mahmoud Al-Husary' },
  { id: 'Hudhaify_128kbps', name: 'Ali Al-Hudhaify' },
  { id: 'MaherAlMuaiqly128kbps', name: "Maher Al-Mu'aiqly" },
  { id: 'Minshawy_Murattal_128kbps', name: 'Al-Minshawi (Murattal)' },
  { id: 'Hani_Rifai_192kbps', name: 'Hani Ar-Rifai' },
];

/** Reciters everyayah.com lacks. Their ayah files are cut by
 *  scripts/build_audio.py and served from the address in VITE_EXTRA_AUDIO_BASE. */
const EXTRA_RECITERS: Reciter[] = [
  { id: 'abdurrashid_sufi', name: 'Abdirashid Ali Sufi' },
  // Every complete recording of this reciter is ad-Duri 'an Abi 'Amr,
  // not the Hafs text on screen.
  { id: 'noreen_siddiq', name: 'Noreen Muhammad Siddique (ad-Duri)' },
];

/** Blank means unset. Trailing slashes go, so audio URLs get exactly one. */
export function normalizeBase(base: string | undefined): string | undefined {
  const trimmed = (base ?? '').trim().replace(/\/+$/, '');
  return trimmed || undefined;
}

export function buildReciters(extraBase: string | undefined): Reciter[] {
  const base = normalizeBase(extraBase);
  if (!base) return [...EVERYAYAH_RECITERS];
  return [...EVERYAYAH_RECITERS, ...EXTRA_RECITERS.map((r) => ({ ...r, base }))];
}

/** A reciter saved on a build that offered it, but missing from this one,
 *  falls back to the default instead of failing on every ayah. */
export function resolveReciterId(id: string | undefined, reciters: Reciter[]): string {
  return id && reciters.some((r) => r.id === id) ? id : DEFAULT_RECITER;
}

/** URLs the service worker caches whole, never as Range requests, which stall
 *  audio on iOS: everyayah.com, plus the extra base when set. An absolute base
 *  matches from the start of the URL; a same-origin path base matches as a path. */
export function audioCachePattern(extraBase: string | undefined): RegExp {
  const parts = ['^https://everyayah\\.com/'];
  const base = normalizeBase(extraBase);
  if (base) {
    const escaped = base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\/';
    parts.push(/^https?:\/\//.test(base) ? `^${escaped}` : escaped);
  }
  return new RegExp(parts.join('|'));
}
