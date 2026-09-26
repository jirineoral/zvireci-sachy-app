/**
 * Czech piece letters for the child's eyes (K král, D dáma, V věž, S střelec, J jezdec).
 * Display only: SAN, PGN and everything stored stay English (chess.js speaks nothing else).
 */

const TO_CZECH: Record<string, string> = { N: 'J', B: 'S', R: 'V', Q: 'D', K: 'K' };
const TO_ENGLISH: Record<string, string> = { J: 'N', S: 'B', V: 'R', D: 'Q', K: 'K' };

/** "Nxd4" → "Jxd4", "exd8=Q+" → "exd8=D+", "O-O" → "0-0" (Czech usage, as the lessons teach). */
export function czechSan(san: string): string {
  if (san.startsWith('O-O')) return san.replace(/O/g, '0');
  return san.replace(/^[NBRQK]/, (p) => TO_CZECH[p]).replace(/=([NBRQ])/, (_, p: string) => `=${TO_CZECH[p]}`);
}

/**
 * A move token written with Czech letters ("Jf3", "Sxe5+", "e8=D", "12.Vd1") in English;
 * anything else is returned as is. Files are lower case, so "d4" / "Dd4" cannot be confused.
 */
const CZECH_TOKEN = /^(\d+\.(?:\.\.)?)?([JSVDK])([a-h]?[1-8]?x?[a-h][1-8](?:=[JSVDNBRQ])?[+#]?[!?]*)$/;
const CZECH_PAWN_PROMOTION = /^(\d+\.(?:\.\.)?)?([a-h](?:x[a-h])?[18])=([JSVD])([+#]?[!?]*)$/;

function tokenToEnglish(token: string): string {
  const castle = /^(\d+\.(?:\.\.)?)?0-0(-0)?([+#]?[!?]*)$/.exec(token);
  if (castle) return `${castle[1] ?? ''}O-O${castle[2] ? '-O' : ''}${castle[3]}`;
  const piece = CZECH_TOKEN.exec(token);
  if (piece) {
    const rest = piece[3].replace(/=([JSVD])/, (_, p: string) => `=${TO_ENGLISH[p]}`);
    return `${piece[1] ?? ''}${TO_ENGLISH[piece[2]]}${rest}`;
  }
  const promo = CZECH_PAWN_PROMOTION.exec(token);
  if (promo) return `${promo[1] ?? ''}${promo[2]}=${TO_ENGLISH[promo[3]]}${promo[4]}`;
  return token;
}

/**
 * Pasted PGN with Czech piece letters → English SAN. Header tags (`[...]`) and comments
 * (`{...}`, `; …`) are left alone; only whole move tokens are rewritten.
 */
export function pgnFromCzech(text: string): string {
  // Split off header tags and comments so their text is kept verbatim; even indices are movetext.
  return text
    .split(/(\[[^\]]*\]|\{[^}]*\}|;[^\n]*)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\S+/g, tokenToEnglish)))
    .join('');
}
