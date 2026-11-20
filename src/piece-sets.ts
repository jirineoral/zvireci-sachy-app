/**
 * Piece sets as data. Reads `public/piece-sets/sets.json` and, for the "Hlavy" style,
 * the character library `public/piece-sets/animals/animals.json`. Pure view state: nothing
 * here touches the game, the board bridge or the engine.
 *
 * Two kinds of style ("family", the "Figurky" selector):
 *  - a *library* family: the player picks a character, an opponent (or random) and a
 *    colour (or random); the white side shows the white character's `light/` pieces and
 *    the black side the black character's `dark/` pieces. Each character's stylesheet is
 *    scoped by classes on <html> (`skm-white-<id>`, `skm-black-<id>`), so the board, the
 *    promotion dialog and the spectators follow automatically.
 *  - a *pair* family (Phase 5A): one folder per "which animal is white"; the set is
 *    resolved from (family, animal, colour). `cburnett` is the built-in pair.
 *  - a *user* family (MVP M1/M2): twelve optional blobs uploaded by the player, styled
 *    through a constructed stylesheet (CSSOM, so `style-src 'self'` is not involved) with
 *    the same `<html>`-class scoping; missing pieces show the built-in classic ones.
 *
 * Fallbacks: a missing/invalid manifest or a stylesheet that fails to load leaves the
 * bundled cburnett styling (src/styles/pieces.css) in place, so the board stays playable.
 */
import type { Color } from 'chess.js';
import { PIECE_CODES, type PieceCode, type UserSet } from './user-sets';

/** A character of the library (id, Czech names, noises, difficulty labels). */
export interface Animal {
  id: string;
  /** Nominative plural ("kůzlata", "hadi"). */
  name: string;
  /** Accusative after "Hraju za …" ("kůzlata", "hady"). */
  za: string;
  /** The king's own noise in the review bubbles. */
  sound: string;
  /** The noise when one of their pieces is captured. */
  hurt: string;
  /** Six difficulty labels, weakest first; null = the default (frog) ladder names. */
  levels: string[] | null;
  /** Seasonal character: offered only between these days (inclusive, "MM-DD"); null = always. */
  season: Season | null;
}

/** A yearly window of days, "MM-DD" each; `from` after `to` wraps over the new year. */
export interface Season {
  from: string;
  to: string;
}

const SEASON_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

/** Characters a random opponent draw never picks (still choosable by hand). */
const NOT_RANDOM_OPPONENTS: ReadonlySet<string> = new Set(['jezulatka']);

/** True when `date` (local time) falls inside the yearly window, both ends included. */
export function inSeason(season: Season, date: Date): boolean {
  const day = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return season.from <= season.to ? day >= season.from && day <= season.to : day >= season.from || day <= season.to;
}

export interface AnimalLibrary {
  board: { light: string; dark: string };
  animals: readonly Animal[];
}

/** The legacy pair sets keep the 5A animal ids. */
export type PairAnimal = 'kuzlata' | 'zabky';

export interface PieceSet {
  id: string;
  name: string;
  family: string;
  /** Pair sets: which animal the white pieces are; null for sets without animals. */
  whiteAnimal: PairAnimal | null;
  pair: string;
  board: { light: string; dark: string };
  /** Absolute stylesheet URL, or null for the built-in bundled styling. */
  stylesheet: string | null;
  /** Library folder name (e.g. "animals") when this entry is a character library. */
  library: string | null;
}

export interface PieceFamily {
  id: string;
  name: string;
  sets: readonly PieceSet[];
  /** Non-null when the family is a character library (and it loaded). */
  library: AnimalLibrary | null;
  /** Non-null for a family made of the player's own uploaded pieces. */
  userSet: UserSet | null;
}

export const USER_FAMILY_PREFIX = 'user-';
const USER_BOARD = { light: '#dce6f0', dark: '#8fa3bd' };

/** 'two' = two players at one board (B7): white below, no engine. */
export type ColorPreference = 'random' | Color | 'two';
/** 'random' or a character id. */
export type OpponentPreference = string;
/** Character theme: ordinary animals + the normal board, or only the seasonal characters + the fir-green board. */
export type Theme = 'standard' | 'christmas';

export interface PieceSetManager {
  readonly families: readonly PieceFamily[];
  readonly familyId: string | null;
  /** True when the current family is a loaded character library. */
  readonly isLibrary: boolean;
  readonly animals: readonly Animal[];
  /** Every character of the library regardless of the theme (campaign ladder, lookups); [] outside a library. */
  readonly allAnimals: readonly Animal[];
  /** True when the library has seasonal characters available now (the theme switch is shown). */
  readonly hasSeasonal: boolean;
  /**
   * The effective theme: 'christmas' only while the stored choice (default Christmas) is on AND
   * seasonal characters are available (season or dev site); otherwise always 'standard'.
   */
  readonly theme: Theme;
  /**
   * `gameRunning`: the characters of the running game stay as they are, the theme applies to
   * the next game (the board palette changes at once). No-op without seasonal characters.
   */
  setTheme(theme: Theme, gameRunning?: boolean): void;
  /** The player's character id (library) / pair animal (pair families). */
  readonly animal: string;
  /**
   * The character the player has in the campaign: always the standard-theme choice (the campaign
   * ladder has ordinary characters only), whatever the theme is. Equals `animal` in the standard theme.
   */
  readonly campaignPlayer: string;
  readonly opponentPreference: OpponentPreference;
  readonly colorPreference: ColorPreference;
  /** The colour the human plays in the current game. */
  readonly humanColor: Color;
  /** The character of a colour in the current game; null outside a library family. */
  animalOf(color: Color): Animal | null;
  setFamily(id: string): void;
  setAnimal(id: string): void;
  setOpponentPreference(pref: OpponentPreference): void;
  setColorPreference(pref: ColorPreference): void;
  /** Draws the colour of the next game from the preference (the controller asks for it). */
  drawColor(): Color;
  /** A new game starts with this colour: re-draws a random opponent, re-applies the styling. */
  startGame(color: Color): void;
  /**
   * Campaign (Phase 11): the next games are against this character regardless of the
   * stored preference; null lifts it. Not persisted. Applies to the view at once.
   * `gameRunning` (when lifting): the running game keeps its characters until the next game starts.
   */
  forceOpponent(id: string | null, gameRunning?: boolean): void;
  /** Same-origin URL of a character's piece image (library families only). */
  characterImage(id: string, variant: 'light' | 'dark', role: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'): string | null;
  /** Adds or replaces the player's own set as a family and selects it. */
  useUserSet(set: UserSet): void;
  /** Removes a user family; falls back to the first family when it was selected. */
  removeUserSet(id: string): void;
}

export interface PieceSetOptions {
  baseUrl: string;
  /** The chessground wrapper (`.cg-wrap`) that carries --board-light / --board-dark. */
  boardEl: HTMLElement;
  storage: Storage | null;
  /** The player's own sets, already read from storage. */
  userSets?: readonly UserSet[];
}

export const FAMILY_STORAGE_KEY = 'skm.pieceFamily';
export const ANIMAL_STORAGE_KEY = 'skm.animal';
export const OPPONENT_STORAGE_KEY = 'skm.opponent';
export const COLOR_STORAGE_KEY = 'skm.color';
/** 'on' = Vánoční theme (default), 'off' = Standardní. Key kept from the earlier on/off switch. */
export const CHRISTMAS_STORAGE_KEY = 'skm.christmas';
/** The Christmas theme remembers its own player and opponent choice (the standard keys above stay the standard theme's). */
export const CHRISTMAS_ANIMAL_STORAGE_KEY = 'skm.animal.xmas';
export const CHRISTMAS_OPPONENT_STORAGE_KEY = 'skm.opponent.xmas';
/** <html> class that switches the board to the fir-green Christmas palette (see board.css). */
export const CHRISTMAS_BOARD_CLASS = 'skm-xmas-board';
/** Pre-5A key; migrated to the family key once and removed. */
const LEGACY_SET_STORAGE_KEY = 'skm.pieceSetId';
const LINK_ATTR = 'data-piece-set';
const ID_PATTERN = /^[a-z0-9-]+$/;
const PAIR_ANIMALS: readonly PairAnimal[] = ['kuzlata', 'zabky'];
const DEFAULT_ANIMAL = 'kuzlata';
const DEFAULT_CHRISTMAS_ANIMAL = 'kapri';
const HTML_CLASS_PREFIX = 'skm-';

export function otherPairAnimal(animal: PairAnimal): PairAnimal {
  return animal === 'kuzlata' ? 'zabky' : 'kuzlata';
}

/** Pair families: the set whose white pieces are the right animal, else the first entry. */
export function resolvePair(family: PieceFamily, animal: string, color: Color): PieceSet {
  if (!isPairAnimal(animal)) return family.sets[0];
  const wantedWhite = color === 'w' ? animal : otherPairAnimal(animal);
  return family.sets.find((s) => s.whiteAnimal === wantedWhite) ?? family.sets[0];
}

export async function initPieceSets(opts: PieceSetOptions): Promise<PieceSetManager> {
  const families: PieceFamily[] = await loadFamilies(opts.baseUrl);
  for (const set of opts.userSets ?? []) families.push(userFamily(set));
  let familyId: string | null = null;
  let animal = DEFAULT_ANIMAL; // the effective player character (derived from the preference on each apply)
  // Player and opponent preferences are kept per theme, so switching back and forth restores each one.
  const preferredAnimal: Record<Theme, string> = { standard: DEFAULT_ANIMAL, christmas: DEFAULT_CHRISTMAS_ANIMAL };
  const preferredOpponent: Record<Theme, OpponentPreference> = { standard: 'random', christmas: 'random' };
  let deferCharacters = false; // the theme was changed mid-game: keep the running game's characters until startGame
  let colorPreference: ColorPreference = 'random';
  let humanColor: Color = 'w';
  let opponent: string | null = null; // the drawn/chosen opponent of the current game
  let forcedOpponent: string | null = null; // campaign: overrides the preference while set
  let appliedPairSet: PieceSet | null = null;
  let christmas = readStoredRaw(opts.storage, CHRISTMAS_STORAGE_KEY) !== 'off'; // stored choice, default Christmas

  const family = (): PieceFamily | null => families.find((f) => f.id === familyId) ?? null;
  const library = (): AnimalLibrary | null => family()?.library ?? null;
  // `library().animals` holds every character available today; the theme only decides which of
  // them are offered (pickers, random draws), never what is rendered.
  const hasSeasonal = (): boolean => families.some((f) => f.library?.animals.some((a) => a.season !== null));
  const theme = (): Theme => (christmas && hasSeasonal() ? 'christmas' : 'standard');
  // Pair and user families know no themes: they use the standard slot.
  const slot = (): Theme => (library() !== null ? theme() : 'standard');
  const inTheme = (a: Animal): boolean => (theme() === 'christmas' ? a.season !== null : a.season === null);
  const choosable = (): readonly Animal[] => (library()?.animals ?? []).filter(inTheme);
  const findAnimal = (id: string | null): Animal | null => choosable().find((a) => a.id === id) ?? null;
  // Rendering never depends on the theme.
  const findAny = (id: string | null): Animal | null => library()?.animals.find((a) => a.id === id) ?? null;
  // The campaign's character: the standard-theme choice (the ladder has ordinary characters only).
  const standardPlayer = (lib: AnimalLibrary): Animal => {
    const ordinary = lib.animals.filter((a) => a.season === null);
    return ordinary.find((a) => a.id === preferredAnimal.standard) ?? ordinary.find((a) => a.id === DEFAULT_ANIMAL) ?? ordinary[0] ?? lib.animals[0];
  };
  const resolvePlayer = (lib: AnimalLibrary): Animal => {
    if (deferCharacters) {
      const keep = findAny(animal); // a running game keeps its characters
      if (keep) return keep;
    }
    if (forcedOpponent !== null) return standardPlayer(lib);
    const t = theme();
    const fallback = t === 'christmas' ? DEFAULT_CHRISTMAS_ANIMAL : DEFAULT_ANIMAL;
    return findAnimal(preferredAnimal[t]) ?? findAnimal(fallback) ?? choosable()[0] ?? lib.animals[0];
  };
  // Is this character fine as the current opponent? A running game and the campaign keep theirs
  // whatever the theme offers.
  const opponentFits = (id: string | null): boolean => (deferCharacters || forcedOpponent !== null ? findAny(id) : findAnimal(id)) !== null;
  // The fir-green board belongs to the library (animal characters) family only; user and pair sets keep their own.
  const xmasBoard = (): boolean => theme() === 'christmas' && library() !== null;
  const htmlClasses = (classes: string[]): void => setHtmlClasses(xmasBoard() ? [...classes, CHRISTMAS_BOARD_CLASS] : classes);

  const pickOpponent = (): string | null => {
    if (!library()) return null;
    if (forcedOpponent !== null && forcedOpponent !== animal && findAny(forcedOpponent)) return forcedOpponent; // campaign: ordinary characters, whatever the theme
    const pref = preferredOpponent[slot()];
    if (pref !== 'random' && findAnimal(pref)) return pref;
    // The baby Jesus set is never drawn as a random opponent; children pick it on purpose only.
    const pool0 = choosable();
    const drawable = pool0.filter((a) => !NOT_RANDOM_OPPONENTS.has(a.id));
    const others = drawable.filter((a) => a.id !== animal);
    // Only the player's own character left: mirror it rather than draw outside the theme or a never-random one.
    const pool = others.length > 0 ? others : drawable.length > 0 ? drawable : pool0;
    return pool[Math.floor(Math.random() * pool.length)].id;
  };

  const applyBoard = (board: { light: string; dark: string }): void => {
    if (xmasBoard()) {
      // Inline values would beat the stylesheet: let `html.skm-xmas-board .cg-wrap` colour the board.
      opts.boardEl.style.removeProperty('--board-light');
      opts.boardEl.style.removeProperty('--board-dark');
      return;
    }
    opts.boardEl.style.setProperty('--board-light', board.light);
    opts.boardEl.style.setProperty('--board-dark', board.dark);
  };

  const apply = (): void => {
    const f = family();
    if (!f) return;
    if (f.userSet) {
      removePairLinks();
      appliedPairSet = null;
      userStyles.ensure(f.userSet);
      htmlClasses([`${HTML_CLASS_PREFIX}user-${f.userSet.id}`]);
      applyBoard(USER_BOARD);
      return;
    }
    if (f.library) {
      const librarySet = f.sets.find((s) => s.library !== null) ?? f.sets[0];
      const player = resolvePlayer(f.library);
      animal = player.id;
      if (!opponentFits(opponent)) opponent = pickOpponent();
      const white = humanColor === 'w' ? player.id : (opponent ?? player.id);
      const black = humanColor === 'w' ? (opponent ?? player.id) : player.id;
      removePairLinks();
      appliedPairSet = null;
      ensureAnimalLink(opts.baseUrl, librarySet.library ?? 'animals', white);
      if (black !== white) ensureAnimalLink(opts.baseUrl, librarySet.library ?? 'animals', black);
      htmlClasses([`${HTML_CLASS_PREFIX}white-${white}`, `${HTML_CLASS_PREFIX}black-${black}`]);
      applyBoard(f.library.board);
      return;
    }
    htmlClasses([]);
    animal = preferredAnimal.standard;
    const set = resolvePair(f, animal, humanColor);
    if (set === appliedPairSet) return;
    appliedPairSet = set;
    applyPairStylesheet(set);
    applyBoard(set.board);
  };

  if (families.length > 0) {
    const stored = readFamily(opts.storage, families);
    familyId = stored.familyId ?? families[0].id;
    readThemePreferences(opts.storage, families, stored.legacyAnimal, preferredAnimal, preferredOpponent);
    animal = preferredAnimal.standard;
    colorPreference = readColor(opts.storage);
    apply();
  }

  return {
    get families() {
      return families;
    },
    get familyId() {
      return familyId;
    },
    get isLibrary() {
      return library() !== null;
    },
    get animals() {
      return choosable();
    },
    get allAnimals() {
      return library()?.animals ?? [];
    },
    get hasSeasonal() {
      return hasSeasonal();
    },
    get theme() {
      return theme();
    },
    setTheme(next: Theme, gameRunning = false): void {
      if (!hasSeasonal()) return;
      christmas = next === 'christmas';
      writeStored(opts.storage, CHRISTMAS_STORAGE_KEY, christmas ? 'on' : 'off');
      appliedPairSet = null; // force the board colours to be re-applied
      deferCharacters = gameRunning;
      apply();
    },
    get animal() {
      return animal;
    },
    get campaignPlayer() {
      const lib = library();
      return lib ? standardPlayer(lib).id : animal;
    },
    get opponentPreference() {
      return preferredOpponent[slot()];
    },
    get colorPreference() {
      return colorPreference;
    },
    get humanColor() {
      return humanColor;
    },
    animalOf(color: Color): Animal | null {
      if (!library()) return null;
      return color === humanColor ? findAny(animal) : findAny(opponent);
    },
    setFamily(id: string): void {
      if (!families.some((f) => f.id === id)) {
        console.warn(`Unknown piece-set family "${id}"`);
        return;
      }
      familyId = id;
      apply();
      writeStored(opts.storage, FAMILY_STORAGE_KEY, id);
    },
    setAnimal(id: string): void {
      const lib = library();
      const valid = lib ? findAnimal(id) !== null : isPairAnimal(id);
      if (!valid) {
        console.warn(`Unknown animal "${id}"`);
        return;
      }
      const t = slot();
      preferredAnimal[t] = id;
      animal = id;
      if (opponent === id && preferredOpponent[t] === 'random') opponent = pickOpponent(); // never mirror by accident
      apply();
      writeStored(opts.storage, t === 'christmas' ? CHRISTMAS_ANIMAL_STORAGE_KEY : ANIMAL_STORAGE_KEY, id);
    },
    setOpponentPreference(pref: OpponentPreference): void {
      if (pref !== 'random' && !findAnimal(pref)) {
        console.warn(`Unknown opponent "${pref}"`);
        return;
      }
      const t = slot();
      preferredOpponent[t] = pref;
      if (pref !== 'random') opponent = pref; // an explicit choice applies at once (view-only)
      apply();
      writeStored(opts.storage, t === 'christmas' ? CHRISTMAS_OPPONENT_STORAGE_KEY : OPPONENT_STORAGE_KEY, pref);
    },
    setColorPreference(pref: ColorPreference): void {
      colorPreference = pref;
      writeStored(opts.storage, COLOR_STORAGE_KEY, pref);
    },
    drawColor(): Color {
      if (colorPreference === 'random') return Math.random() < 0.5 ? 'w' : 'b';
      return colorPreference === 'two' ? 'w' : colorPreference;
    },
    startGame(color: Color): void {
      humanColor = color;
      deferCharacters = false;
      const lib = library();
      if (lib) animal = resolvePlayer(lib).id; // the theme may have changed since the last game
      if (preferredOpponent[slot()] === 'random' || forcedOpponent !== null) opponent = pickOpponent();
      apply();
    },
    forceOpponent(id: string | null, gameRunning = false): void {
      if (id !== null && !findAny(id)) {
        console.warn(`Unknown campaign opponent "${id}"`);
        return;
      }
      forcedOpponent = id;
      deferCharacters = gameRunning;
      const lib = library();
      if (lib) animal = resolvePlayer(lib).id; // the campaign plays with the standard-theme character
      if (!deferCharacters) opponent = pickOpponent(); // deferred: the running game keeps its opponent
      apply();
    },
    characterImage(id, variant, role): string | null {
      const f = family();
      if (!f?.library || !findAny(id)) return null;
      const folder = f.sets.find((s) => s.library !== null)?.library ?? 'animals';
      return `${opts.baseUrl}piece-sets/${folder}/${id}/${variant}/${role}.png`;
    },
    useUserSet(set: UserSet): void {
      const fam = userFamily(set);
      const at = families.findIndex((f) => f.id === fam.id);
      if (at >= 0) families[at] = fam;
      else families.push(fam);
      userStyles.drop(set.id); // a replaced set gets a fresh stylesheet and fresh object URLs
      familyId = fam.id;
      apply();
      writeStored(opts.storage, FAMILY_STORAGE_KEY, fam.id);
    },
    removeUserSet(id: string): void {
      const famId = USER_FAMILY_PREFIX + id;
      const at = families.findIndex((f) => f.id === famId);
      if (at < 0) return;
      families.splice(at, 1);
      userStyles.drop(id);
      if (familyId === famId) {
        familyId = families[0]?.id ?? null;
        if (familyId) writeStored(opts.storage, FAMILY_STORAGE_KEY, familyId);
        apply();
      }
    },
  };
}

function userFamily(set: UserSet): PieceFamily {
  const pseudo: PieceSet = {
    id: USER_FAMILY_PREFIX + set.id,
    name: `Moje: ${set.name}`,
    family: USER_FAMILY_PREFIX + set.id,
    whiteAnimal: null,
    pair: 'user',
    board: USER_BOARD,
    stylesheet: null,
    library: null,
  };
  return { id: pseudo.id, name: pseudo.name, sets: [pseudo], library: null, userSet: set };
}

// ---- user sets: constructed stylesheets ------------------------------------------------
const ROLE_NAME: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

/** One constructed stylesheet per user set, rules only for the pieces it has. */
const userStyles = {
  sheets: new Map<string, { sheet: CSSStyleSheet; urls: string[] }>(),
  ensure(set: UserSet): void {
    if (this.sheets.has(set.id)) return;
    const sheet = new CSSStyleSheet();
    const urls: string[] = [];
    const scope = `html.${HTML_CLASS_PREFIX}user-${set.id} .cg-wrap piece`;
    for (const code of PIECE_CODES) {
      const blob = set.pieces[code as PieceCode];
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const color = code[0] === 'w' ? 'white' : 'black';
      sheet.insertRule(
        `${scope}.${ROLE_NAME[code[1]]}.${color} { background-image: url("${url}"); background-size: contain; background-position: center; background-repeat: no-repeat; }`,
      );
    }
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    this.sheets.set(set.id, { sheet, urls });
  },
  drop(id: string): void {
    const entry = this.sheets.get(id);
    if (!entry) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== entry.sheet);
    for (const url of entry.urls) URL.revokeObjectURL(url);
    this.sheets.delete(id);
  },
};

function isPairAnimal(value: unknown): value is PairAnimal {
  return typeof value === 'string' && (PAIR_ANIMALS as readonly string[]).includes(value);
}

// ---- manifests --------------------------------------------------------------------------
async function loadFamilies(baseUrl: string): Promise<PieceFamily[]> {
  const sets = await loadSets(baseUrl);
  const byId = new Map<string, PieceSet[]>();
  for (const set of sets) {
    const list = byId.get(set.family) ?? [];
    list.push(set);
    byId.set(set.family, list);
  }
  const families: PieceFamily[] = [];
  for (const [id, members] of byId) {
    const libraryEntry = members.find((s) => s.library !== null);
    const library = libraryEntry ? await loadLibrary(baseUrl, libraryEntry.library as string) : null;
    if (libraryEntry && !library) continue; // unusable library: the family disappears, fallback styling stays
    families.push({ id, name: members[0].name, sets: members, library, userSet: null });
  }
  return families;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`${url} could not be loaded`, err);
    return null;
  }
}

async function loadSets(baseUrl: string): Promise<PieceSet[]> {
  const raw = await fetchJson(`${baseUrl}piece-sets/sets.json`);
  if (raw === null) {
    console.error('Piece-set manifest missing; using built-in pieces');
    return [];
  }
  if (!Array.isArray(raw)) {
    console.error('Piece-set manifest is not an array; using built-in pieces');
    return [];
  }
  const sets: PieceSet[] = [];
  for (const entry of raw) {
    const set = validateSet(entry, baseUrl);
    if (set) sets.push(set);
    else console.warn('Ignoring invalid piece-set entry', entry);
  }
  if (sets.length === 0) console.error('Piece-set manifest has no valid entries; using built-in pieces');
  return sets;
}

function validateSet(entry: unknown, baseUrl: string): PieceSet | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== 'string' || !ID_PATTERN.test(e.id)) return null;
  if (typeof e.name !== 'string' || e.name.length === 0) return null;
  if ('stylesheet' in e && e.stylesheet !== null) return null; // only `null` (built-in) or absent
  if ('family' in e && (typeof e.family !== 'string' || !ID_PATTERN.test(e.family))) return null;
  if ('whiteAnimal' in e && !isPairAnimal(e.whiteAnimal)) return null;
  if ('library' in e && (typeof e.library !== 'string' || !ID_PATTERN.test(e.library))) return null;
  const library = typeof e.library === 'string' ? e.library : null;
  const board = e.board as Record<string, unknown> | undefined;
  const hasBoard = !!board && typeof board.light === 'string' && typeof board.dark === 'string';
  if (!hasBoard && !library) return null; // a library brings its own palette
  return {
    id: e.id,
    name: e.name,
    family: typeof e.family === 'string' ? e.family : e.id,
    whiteAnimal: isPairAnimal(e.whiteAnimal) ? e.whiteAnimal : null,
    pair: typeof e.pair === 'string' ? e.pair : '',
    board: hasBoard ? { light: board.light as string, dark: board.dark as string } : { light: '#dce6f0', dark: '#8fa3bd' },
    stylesheet: 'stylesheet' in e || library ? null : `${baseUrl}piece-sets/${e.id}/pieces.css`,
    library,
  };
}

async function loadLibrary(baseUrl: string, folder: string): Promise<AnimalLibrary | null> {
  const raw = await fetchJson(`${baseUrl}piece-sets/${folder}/animals.json`);
  if (raw === null || typeof raw !== 'object') {
    console.error(`Character library "${folder}" could not be loaded; its style is unavailable`);
    return null;
  }
  const r = raw as Record<string, unknown>;
  const board = r.board as Record<string, unknown> | undefined;
  if (!board || typeof board.light !== 'string' || typeof board.dark !== 'string' || !Array.isArray(r.animals)) {
    console.error(`Character library "${folder}" is malformed; its style is unavailable`);
    return null;
  }
  const animals: Animal[] = [];
  const today = new Date();
  for (const entry of r.animals) {
    const animal = validateAnimal(entry);
    if (!animal) console.warn('Ignoring invalid character entry', entry);
    // The dev site (dev.zvirecisachy.cz) shows seasonal characters all year, for previews.
    else if (animal.season === null || __DEV_SITE__ || inSeason(animal.season, today)) animals.push(animal);
  }
  if (animals.length === 0) {
    console.error(`Character library "${folder}" has no valid characters; its style is unavailable`);
    return null;
  }
  return { board: { light: board.light, dark: board.dark }, animals };
}

function validateAnimal(entry: unknown): Animal | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== 'string' || !ID_PATTERN.test(e.id)) return null;
  for (const key of ['name', 'za', 'sound', 'hurt']) {
    if (typeof e[key] !== 'string' || (e[key] as string).length === 0) return null;
  }
  let levels: string[] | null = null;
  if ('levels' in e) {
    if (!Array.isArray(e.levels) || e.levels.length !== 6 || !e.levels.every((l) => typeof l === 'string' && l.length > 0)) return null;
    levels = e.levels as string[];
  }
  let season: Season | null = null;
  if ('season' in e) {
    const sn = e.season as Record<string, unknown> | null;
    if (typeof sn !== 'object' || sn === null || typeof sn.from !== 'string' || typeof sn.to !== 'string') return null;
    if (!SEASON_DAY.test(sn.from) || !SEASON_DAY.test(sn.to)) return null;
    season = { from: sn.from, to: sn.to };
  }
  return { id: e.id, name: e.name as string, za: e.za as string, sound: e.sound as string, hurt: e.hurt as string, levels, season };
}

// ---- styling ----------------------------------------------------------------------------
function setHtmlClasses(classes: string[]): void {
  const root = document.documentElement;
  for (const c of Array.from(root.classList)) if (c.startsWith(HTML_CLASS_PREFIX)) root.classList.remove(c);
  for (const c of classes) root.classList.add(c);
}

/** Loads a character's scoped stylesheet once; the <html> classes decide what applies. */
function ensureAnimalLink(baseUrl: string, folder: string, id: string): void {
  const key = `animal:${id}`;
  if (document.head.querySelector(`link[${LINK_ATTR}="${key}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${baseUrl}piece-sets/${folder}/${id}/pieces.css`;
  link.setAttribute(LINK_ATTR, key);
  link.addEventListener('error', () => {
    console.error(`Character stylesheet ${link.href} failed to load; that side shows the built-in pieces`);
    link.remove();
  });
  document.head.appendChild(link);
}

function removePairLinks(): void {
  for (const link of document.head.querySelectorAll<HTMLLinkElement>(`link[${LINK_ATTR}]`)) {
    if (!(link.getAttribute(LINK_ATTR) ?? '').startsWith('animal:')) link.remove();
  }
}

function applyPairStylesheet(set: PieceSet): void {
  const previous = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[${LINK_ATTR}]`)).filter(
    (l) => !(l.getAttribute(LINK_ATTR) ?? '').startsWith('animal:'),
  );
  if (set.stylesheet === null) {
    for (const link of previous) link.remove(); // built-in styling shows through
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = set.stylesheet;
  link.setAttribute(LINK_ATTR, set.id);
  link.addEventListener('load', () => {
    // Swap only once the new sheet is in, so pieces never flash to "missing".
    for (const old of previous) old.remove();
  });
  link.addEventListener('error', () => {
    console.error(`Piece-set stylesheet ${set.stylesheet} failed to load; keeping previous styling`);
    link.remove();
  });
  document.head.appendChild(link);
}

// ---- storage ----------------------------------------------------------------------------
function readFamily(storage: Storage | null, families: readonly PieceFamily[]): { familyId: string | null; legacyAnimal: string | null } {
  const stored = readStoredRaw(storage, FAMILY_STORAGE_KEY);
  if (stored !== null) {
    if (families.some((f) => f.id === stored)) return { familyId: stored, legacyAnimal: null };
    console.warn(`Stored piece-set family "${stored.slice(0, 40)}" is not available; using "${families[0].id}"`);
    return { familyId: null, legacyAnimal: null };
  }
  const legacyId = readStoredRaw(storage, LEGACY_SET_STORAGE_KEY);
  if (legacyId === null) return { familyId: null, legacyAnimal: null };
  removeStored(storage, LEGACY_SET_STORAGE_KEY);
  for (const family of families) {
    const set = family.sets.find((s) => s.id === legacyId);
    if (set) {
      writeStored(storage, FAMILY_STORAGE_KEY, family.id);
      return { familyId: family.id, legacyAnimal: set.whiteAnimal };
    }
  }
  return { familyId: null, legacyAnimal: null };
}

/**
 * Fills the per-theme preferences from storage. The standard slot (`skm.animal`, `skm.opponent`)
 * stays the standard theme's; the Christmas theme has its own keys. A seasonal character found in a
 * standard key comes from the earlier on/off switch (it was the Christmas choice): it moves to the
 * Christmas slot unless that is already set, and the standard slot falls back to its default.
 * Unknown ids (e.g. a seasonal one out of season) fall back to the defaults in memory only; storage is untouched.
 */
function readThemePreferences(
  storage: Storage | null,
  families: readonly PieceFamily[],
  legacyAnimal: string | null,
  animals: Record<Theme, string>,
  opponents: Record<Theme, OpponentPreference>,
): void {
  const known = new Set<string>(PAIR_ANIMALS);
  const seasonal = new Set<string>();
  for (const f of families) {
    for (const a of f.library?.animals ?? []) {
      known.add(a.id);
      if (a.season !== null) seasonal.add(a.id);
    }
  }
  const read = (key: string): string | null => {
    const v = readStoredRaw(storage, key);
    if (v === null) return null;
    if (v === 'random' || known.has(v)) return v;
    console.warn(`Stored value "${v.slice(0, 40)}" in ${key} is unknown; using the default`);
    return null;
  };
  const stdAnimal = read(ANIMAL_STORAGE_KEY) ?? legacyAnimal;
  const xmasAnimal = read(CHRISTMAS_ANIMAL_STORAGE_KEY);
  if (stdAnimal !== null && stdAnimal !== 'random' && !seasonal.has(stdAnimal)) animals.standard = stdAnimal;
  else if (stdAnimal !== null && seasonal.has(stdAnimal) && xmasAnimal === null) {
    animals.christmas = stdAnimal;
    writeStored(storage, CHRISTMAS_ANIMAL_STORAGE_KEY, stdAnimal);
  }
  if (xmasAnimal !== null && seasonal.has(xmasAnimal)) animals.christmas = xmasAnimal;

  const stdOpp = read(OPPONENT_STORAGE_KEY);
  const xmasOpp = read(CHRISTMAS_OPPONENT_STORAGE_KEY);
  if (stdOpp !== null && !seasonal.has(stdOpp)) opponents.standard = stdOpp;
  else if (stdOpp !== null && xmasOpp === null) {
    opponents.christmas = stdOpp;
    writeStored(storage, CHRISTMAS_OPPONENT_STORAGE_KEY, stdOpp);
  }
  if (xmasOpp !== null && (xmasOpp === 'random' || seasonal.has(xmasOpp))) opponents.christmas = xmasOpp;
}

function readColor(storage: Storage | null): ColorPreference {
  const stored = readStoredRaw(storage, COLOR_STORAGE_KEY);
  if (stored === null || stored === 'random') return 'random';
  if (stored === 'w' || stored === 'b' || stored === 'two') return stored;
  console.warn(`Stored colour "${stored.slice(0, 40)}" is unknown; using "random"`);
  return 'random';
}

function readStoredRaw(storage: Storage | null, key: string): string | null {
  try {
    const value = storage?.getItem(key) ?? null;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch (err) {
    console.warn(`Could not persist ${key}`, err);
  }
}

function removeStored(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // nothing to do: the legacy key simply stays behind
  }
}
