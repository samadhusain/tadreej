// Parses what the user has typed in a number field. Returns null while the
// draft is empty or half-typed ('', '-', '.'), so nothing gets saved yet.
export function parseDraft(text: string, min: number, max: number, integer: boolean): number | null {
  const n = integer ? parseInt(text, 10) : parseFloat(text);
  if (Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}
