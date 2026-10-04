// Parses what the user has typed in a number field. Returns null while the
// draft is empty or not yet a number ('', '-', '.'), so nothing gets saved yet.
export function parseDraft(text: string, min: number, max: number, integer: boolean): number | null {
  const n = integer ? parseInt(text, 10) : parseFloat(text);
  if (Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// `expect` is the saved value this draft leaves behind.
export type Draft = { text: string; expect: number };

// One keystroke: the new draft, and the number to save (null saves nothing).
export function typeDraft(text: string, saved: number, min: number, max: number, integer: boolean) {
  const commit = parseDraft(text, min, max, integer);
  return { draft: { text, expect: commit ?? saved }, commit };
}

// The saved value changed from outside (the − / + buttons), so the draft is old.
export function isStale(draft: Draft, saved: number): boolean {
  return saved !== draft.expect;
}
