/**
 * Lessons: Czech piece names and the teacher-text placeholders. A lesson names every
 * piece by its chess name *and* by how it looks in the child's animal set (plan,
 * decision 7), so the knowledge transfers to a club board:
 *   `{věž}` → „věž (u tebe kůzle s hradem na hlavě)“ with the "Hlavy" set and kůzlata,
 *   `{věž}` → „věž“ with the classic pieces.
 * Every piece of a character is the same animal wearing the role's marker
 * (docs/PROMPTS.md), so the marker is what the child looks for.
 */
import type { PieceType } from './types';

export interface PieceName {
  /** Nominative („věž“). */
  nom: string;
  /** Accusative („věž“, „jezdce“). */
  acc: string;
  /** Grammatical gender, for past-tense agreement („vzal“ / „vzala“). */
  fem: boolean;
  /** How the piece looks in the "Hlavy" sets („s hradem na hlavě“). */
  marker: string;
}

export const PIECE_NAMES: Record<PieceType, PieceName> = {
  p: { nom: 'pěšec', acc: 'pěšce', fem: false, marker: 'bez čepice' },
  n: { nom: 'jezdec', acc: 'jezdce', fem: false, marker: 's helmou s chocholem' },
  b: { nom: 'střelec', acc: 'střelce', fem: false, marker: 's vysokou špičatou čepicí' },
  r: { nom: 'věž', acc: 'věž', fem: true, marker: 's hradem na hlavě' },
  q: { nom: 'dáma', acc: 'dámu', fem: true, marker: 's korunou' },
  k: { nom: 'král', acc: 'krále', fem: false, marker: 's korunou s křížkem a žezlem' },
};

/** Singular of each library character (animals.json has the plural only). */
const ANIMAL_SINGULAR: Record<string, string> = {
  kuzlata: 'kůzle',
  zabky: 'žabka',
  clovek: 'člověk',
  had: 'had',
  jezevcici: 'jezevčík',
  kocky: 'kočka',
  kravky: 'kravka',
  mravenci: 'mravenec',
  mysky: 'myška',
  oslici: 'oslík',
  slepice: 'slepice',
  tucnaci: 'tučňák',
  zraloci: 'žralok',
  mouchy: 'moucha',
  vosy: 'vosa',
  lamy: 'lama',
  pstrosi: 'pštros',
  veverky: 'veverka',
  zizaly: 'žížala',
};

/** The child's piece set as far as texts care: a library character, or none (classic / own set). */
export interface TextContext {
  /** Library character id (e.g. 'kuzlata'), or null for sets without animals. */
  animalId: string | null;
}

export function animalSingular(id: string): string {
  return ANIMAL_SINGULAR[id] ?? 'zvířátko';
}

const PLACEHOLDER = /\{(pěšec|jezdec|střelec|věž|dáma|král|Pěšec|Jezdec|Střelec|Věž|Dáma|Král)\}/g;

export const PLACEHOLDER_NAMES: readonly string[] = ['pěšec', 'jezdec', 'střelec', 'věž', 'dáma', 'král'];

function typeOfName(name: string): PieceType {
  const lower = name.toLowerCase();
  const found = (Object.keys(PIECE_NAMES) as PieceType[]).find((t) => PIECE_NAMES[t].nom === lower);
  if (!found) throw new Error(`Unknown piece placeholder {${name}}`);
  return found;
}

/**
 * Expands the piece placeholders. The first mention of each piece in the text gets the
 * animal explanation; later mentions are the plain chess name.
 */
export function resolveText(text: string, ctx: TextContext): string {
  const seen = new Set<PieceType>();
  return text.replace(PLACEHOLDER, (_m, name: string) => {
    const type = typeOfName(name);
    const capital = name[0] !== name[0].toLowerCase();
    const nom = PIECE_NAMES[type].nom;
    const word = capital ? nom[0].toUpperCase() + nom.slice(1) : nom;
    if (ctx.animalId === null || seen.has(type)) return word;
    seen.add(type);
    return `${word} (u tebe ${animalSingular(ctx.animalId)} ${PIECE_NAMES[type].marker})`;
  });
}

/** Placeholders a text uses (lower-case names); for the checker. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1].toLowerCase());
}

/** „vzal“ / „vzala“ for a piece as the subject. */
export function tookVerb(type: PieceType): string {
  return PIECE_NAMES[type].fem ? 'vzala' : 'vzal';
}
