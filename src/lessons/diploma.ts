/**
 * Lessons: the diploma's data (Phase 21b). The child's name is typed on the diploma page
 * and never leaves the browser; it is stored only when the child ticks „Zapamatuj si moje
 * jméno“ (key `skm.diplomaName`), and removed again when the tick is taken away.
 */

export const DIPLOMA_NAME_KEY = 'skm.diplomaName';
export const DIPLOMA_NAME_MAX = 40;

/** Control characters, zero-width and bidi-override characters. */
function invisible(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
}

/** Drops invisible characters, collapses spaces, caps the length. Display is via textContent only. */
export function cleanDiplomaName(raw: string): string {
  const visible = [...raw].filter((ch) => !invisible(ch.codePointAt(0) ?? 0)).join('');
  return [...visible.replace(/\s+/g, ' ').trim()].slice(0, DIPLOMA_NAME_MAX).join('').trim();
}

export function readDiplomaName(storage: Storage | null): string | null {
  try {
    const raw = storage?.getItem(DIPLOMA_NAME_KEY) ?? null;
    if (raw === null) return null;
    const name = cleanDiplomaName(raw);
    return name === '' ? null : name;
  } catch {
    return null;
  }
}

/** Stores the name (`remember`) or forgets any stored one. */
export function writeDiplomaName(storage: Storage | null, name: string, remember: boolean): void {
  try {
    const clean = cleanDiplomaName(name);
    if (remember && clean !== '') storage?.setItem(DIPLOMA_NAME_KEY, clean);
    else storage?.removeItem(DIPLOMA_NAME_KEY);
  } catch (err) {
    console.warn('Could not store the diploma name', err);
  }
}

/** „26. 9. 2026“ — the Czech date on the diploma. */
export function czechDate(d: Date): string {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}
