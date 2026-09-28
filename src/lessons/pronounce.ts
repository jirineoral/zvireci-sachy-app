/**
 * TTS-only pronunciation of chess notation for the Czech SAPI voice. Single source of truth
 * for both the browser (voice.ts, "sova čte nahlas") and the lesson-video pipeline
 * (scripts/lesson-video/pronounce.mjs re-exports this file) and the audio-generation script
 * (scripts/lesson-audio/build.mjs) — the same normalisation everywhere means a step's text
 * hashes to the same file whether it was generated on the command line or looked up by the
 * app.
 *   "e4"    -> "é čtyři"            (square)
 *   "Jf3"   -> "jezdec na ef tři"   (Czech SAN: K D V S J)
 *   "Dxh7+" -> "dáma bere há sedm"
 *   "exd5"  -> "é bere dé pět"
 *   "c8D"   -> "cé osm v dámu"      (promotion)
 *   "23.Se7"-> "střelec na é sedm"  (move numbers dropped)
 *   "O-O" / "O-O-O" -> "krátká rošáda" / "dlouhá rošáda" ("nula nula" where the text explains notation)
 *   "sloupec d", "od a do h", "sloupci c ani e", "e-sloupec" -> letter names
 *   "Mat 3. tahem" -> "mat třetím tahem", trailing "II." in titles -> "dva"
 * Check every lesson's result with: node scripts/lesson-video/build.mjs <id> --dry-run
 */

export const LETTER: Record<string, string> = { a: 'á', b: 'bé', c: 'cé', d: 'dé', e: 'é', f: 'ef', g: 'gé', h: 'há' };
export const DIGIT: Record<string, string> = { '0': 'nula', '1': 'jedna', '2': 'dva', '3': 'tři', '4': 'čtyři', '5': 'pět', '6': 'šest', '7': 'sedm', '8': 'osm' };
const PIECE: Record<string, string> = { K: 'král', D: 'dáma', V: 'věž', S: 'střelec', J: 'jezdec' };
const PIECE_ACC: Record<string, string> = { D: 'dámu', V: 'věž', S: 'střelce', J: 'jezdce' };
const ORDINAL_F = [
  '', 'první', 'druhá', 'třetí', 'čtvrtá', 'pátá', 'šestá', 'sedmá', 'osmá', 'devátá', 'desátá',
  'jedenáctá', 'dvanáctá', 'třináctá', 'čtrnáctá', 'patnáctá', 'šestnáctá', 'sedmnáctá', 'osmnáctá', 'devatenáctá', 'dvacátá',
];
const ORDINAL_INS: Record<string, string> = { '1': 'prvním', '2': 'druhým', '3': 'třetím', '4': 'čtvrtým', '5': 'pátým' };
const GEN: Record<string, string> = { '1': 'jedné', '2': 'dvou', '3': 'tří', '4': 'čtyř', '5': 'pěti', '6': 'šesti', '7': 'sedmi', '8': 'osmi' };
const ROMAN: Record<string, string> = { I: 'jedna', II: 'dva', III: 'tři', IV: 'čtyři', V: 'pět' };

export const square = (sq: string): string => `${LETTER[sq[0]]} ${DIGIT[sq[1]]}`;

/** Feminine ordinal for "lekce" ("druhá lekce"); falls back to the numeral. */
export function ordinalF(n: number): string {
  return ORDINAL_F[n] ?? String(n);
}

// Letters that count as part of a word (so "e4" inside a longer token is left alone).
const W = 'A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž0-9';
const B = `(?<![${W}])`;
const E = `(?![${W}])`;
const re = (src: string, flags = 'g'): RegExp => new RegExp(src, flags);

export function pronounce(text: string): string {
  let t = text;
  const explainsNotation = /píše|zápis|znamená/i.test(t);
  t = t.replace(re(`${B}[O0]-[O0]-[O0]${E}`), explainsNotation ? 'nula nula nula' : 'dlouhá rošáda');
  t = t.replace(re(`${B}[O0]-[O0]${E}`), explainsNotation ? 'nula nula' : 'krátká rošáda');
  // Move numbers glued to a move: "23.Se7", "16.Dxh5"
  t = t.replace(re(`${B}\\d+\\.(?=[KDVSJa-h])`), '');
  // Piece moves: Jf3, Jxf3, Dh7+, Vd1#
  t = t.replace(re(`${B}([KDVSJ])(x?)([a-h][1-8])[+#]?${E}`), (_m, p: string, x: string, sq: string) => `${PIECE[p]} ${x ? 'bere' : 'na'} ${square(sq)}`);
  // Pawn captures: exd5 (optionally with promotion: exd8D)
  t = t.replace(re(`${B}([a-h])x([a-h][1-8])([DVSJ])?[+#]?${E}`), (_m, f: string, sq: string, pr?: string) => `${LETTER[f]} bere ${square(sq)}${pr ? ` v ${PIECE_ACC[pr]}` : ''}`);
  // Promotion: c8D
  t = t.replace(re(`${B}([a-h][18])([DVSJ])[+#]?${E}`), (_m, sq: string, pr: string) => `${square(sq)} v ${PIECE_ACC[pr]}`);
  // Squares
  t = t.replace(re(`${B}([a-h][1-8])${E}`), (_m, sq: string) => square(sq));
  // "e-sloupec"
  t = t.replace(re(`${B}([a-h])-(sloup)`), (_m, f: string, w: string) => `${LETTER[f]} ${w}`);
  // Lone file letters after words that name a file ("sloupec d", "od a do h", "sloupci c ani e").
  t = t.replace(
    re(`${B}(sloupec|sloupce|sloupci|sloupcem|sloupcích|písmeno|písmena|od|do)\\s+([a-h])(?:\\s+(ani|nebo|a|i)\\s+([a-h]))?${E}`, 'gi'),
    (_m, w: string, f: string, conj?: string, g?: string) => `${w} ${LETTER[f.toLowerCase()]}${conj ? ` ${conj} ${LETTER[(g ?? '').toLowerCase()]}` : ''}`,
  );
  // "od 1 do 8" -> "od jedné do osmi"
  t = t.replace(/\bod ([1-8]) do ([1-8])\b/g, (_m, a: string, b: string) => `od ${GEN[a]} do ${GEN[b]}`);
  // "Mat 3. tahem"
  t = t.replace(/(\d)\.\s+tahem/g, (m, n: string) => ORDINAL_INS[n] ? `${ORDINAL_INS[n]} tahem` : m);
  // Roman numeral at the end of a title: "Matové obrazce II."
  t = t.replace(/\s(I|II|III|IV|V)\.$/, (_m, r: string) => ` ${ROMAN[r]}.`);
  // Annotation symbols and notation signs standing alone
  t = t.replace(re(`(^|\\s)[?!]{1,2}(?=\\s|$)`), '$1');
  t = t.replace(/(^|\s)\+(?=[\s.,]|$)/g, '$1plus');
  t = t.replace(/(^|\s)#(?=[\s.,]|$)/g, '$1křížek');
  // Emphasis in capitals ("král JE v šachu", "NENÍ"): SAPI would spell it letter by letter.
  t = t.replace(/(?<![\p{L}])(\p{Lu}{2,})(?![\p{L}])/gu, (w) => w.toLowerCase());
  return t.replace(/\s{2,}/g, ' ').trim();
}

/** Spoken list of answer options: short labels with commas, long ones as sentences. */
export function spokenOptions(labels: readonly string[]): string {
  const long = labels.some((l) => l.includes(',') || l.split(/\s+/).length > 3);
  if (labels.length === 1) return `${labels[0]}.`;
  if (!long) return `${labels.slice(0, -1).join(', ')}, nebo ${labels.at(-1)}.`;
  const last = labels.at(-1) ?? '';
  return `${labels.slice(0, -1).map((l) => `${l}.`).join(' ')} Nebo ${last[0]?.toLowerCase()}${last.slice(1)}.`;
}
