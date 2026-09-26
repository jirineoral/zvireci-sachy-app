/** Small helpers for correct Czech in UI texts. */

/**
 * Czech plural form for a count: `one` for 1, `few` for 2–4, `many` for 0 and 5+
 * (e.g. `plural(n, 'tah', 'tahy', 'tahů')`). The caller picks the case the sentence needs.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}

/** `n` followed by its noun in the right plural form: `count(3, 'tah', 'tahy', 'tahů')` → "3 tahy". */
export function count(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}

/** A number with a Czech decimal comma ("3,5"). */
export function decimal(x: number, digits: number): string {
  return x.toFixed(digits).replace('.', ',');
}
