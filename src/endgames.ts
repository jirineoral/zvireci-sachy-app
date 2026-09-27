/**
 * Endgame training (Phase 13 / R5, restructured Phase 23): textbook positions the player
 * has to win or hold, grouped category → type → ~7 positions of increasing difficulty.
 * Every FEN was checked at authoring time (Stockfish 18 or the Lichess tablebase, see
 * docs/phase-13-plan.md and docs/phase-23-plan.md, `scripts/check-endgames.mjs`) — a wrong
 * goal here would teach the wrong thing. The engine defends at full strength (`TRAINER`).
 * Progress lives in `localStorage`.
 *
 * `typeId`/`order` replace the old flat `group`; ids are unchanged from Phase 13 so
 * existing `skm.endgames` progress and lesson `practice: [{ kind: 'endgame', id }]`
 * pointers keep working.
 */
import type { Color } from 'chess.js';
import type { Difficulty } from './difficulty';

export type EndgameGoal = 'win' | 'draw';

export interface EndgameCategory {
  id: string;
  title: string;
}

export interface EndgameType {
  id: string;
  categoryId: string;
  title: string;
}

export interface Endgame {
  id: string;
  typeId: string;
  /** Position of this FEN within its type, 1 = easiest (increasing difficulty). */
  order: number;
  title: string;
  hint: string;
  fen: string;
  human: Color;
  goal: EndgameGoal;
}

export interface EndgameProgress {
  done: Record<string, true>;
}

export const ENDGAMES_STORAGE_KEY = 'skm.endgames';

/** Full-strength defence: sloppy technique must not be rewarded. */
export const TRAINER: Difficulty = {
  level: 6,
  label: 'Trenér',
  options: { skillLevel: 20 },
  limits: { depth: 12, movetimeMs: 700 },
  topMoves: 1,
  topWindowCp: 0,
};

export const ENDGAME_CATEGORIES: readonly EndgameCategory[] = [
  { id: 'maty', title: 'Maty' },
  { id: 'pesce', title: 'Pěšcové koncovky' },
  { id: 'veze', title: 'Věžové koncovky' },
  { id: 'dama-pesec', title: 'Dáma proti pěšci' },
];

export const ENDGAME_TYPES: readonly EndgameType[] = [
  { id: 'dama-kral', categoryId: 'maty', title: 'Dáma a král' },
  { id: 'vez-kral', categoryId: 'maty', title: 'Věž a král' },
  { id: 'dve-veze', categoryId: 'maty', title: 'Dvě věže' },
  { id: 'dva-strelci', categoryId: 'maty', title: 'Dva střelci' },
  { id: 'strelec-jezdec', categoryId: 'maty', title: 'Střelec a jezdec (pro odvážné)' },
  { id: 'kral-pesec', categoryId: 'pesce', title: 'Král a pěšec' },
  { id: 'ctverec', categoryId: 'pesce', title: 'Pravidlo čtverce' },
  { id: 'prulom', categoryId: 'pesce', title: 'Průlom' },
  { id: 'lucena', categoryId: 'veze', title: 'Lucena' },
  { id: 'philidor', categoryId: 'veze', title: 'Philidor' },
  { id: 'vez-pesec', categoryId: 'veze', title: 'Věž proti pěšci' },
  { id: 'dama-pesec-typ', categoryId: 'dama-pesec', title: 'Dáma proti pěšci' },
];

export const ENDGAMES: readonly Endgame[] = [
  // Maty
  { id: 'kq', typeId: 'dama-kral', order: 1, title: 'Dáma a král proti králi', hint: 'Zatlač dámou krále na kraj (drž se od něj o skok jezdce), pak přiveď svého krále. Pozor na pat!', fen: '4k3/8/8/8/8/8/8/4K2Q w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kr', typeId: 'vez-kral', order: 1, title: 'Věž a král proti králi', hint: 'Věž odřízne krále na řadě, tvůj král jde naproti; když stojí králové proti sobě, dej šach.', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rr', typeId: 'dve-veze', order: 1, title: 'Dvě věže: žebřík', hint: 'Věže střídavě berou králi řadu po řadě — jako po žebříku až k matu.', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', human: 'w', goal: 'win' },
  { id: 'bb', typeId: 'dva-strelci', order: 1, title: 'Dva střelci', hint: 'Střelci vedle sebe tvoří zeď; krále zatlač do rohu a pak přijde tvůj král.', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kbn', typeId: 'strelec-jezdec', order: 1, title: 'Střelec a jezdec (těžké)', hint: 'Mat jde jen v rohu barvy střelce. Nejdřív krále na kraj, pak ho tlač po kraji do správného rohu.', fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1', human: 'w', goal: 'win' },
  // Pěšcové koncovky
  { id: 'kp-win', typeId: 'kral-pesec', order: 1, title: 'Král před pěšcem', hint: 'Král jde napřed, pěšec za ním. Nespěchej s pěšcem.', fen: '4k3/8/3K4/4P3/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-far', typeId: 'kral-pesec', order: 2, title: 'Ze základní řady', hint: 'Nejdřív král dopředu, pěšec počká. Opozice rozhoduje.', fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'race', typeId: 'kral-pesec', order: 3, title: 'Utíkej s pěšcem', hint: 'Černý král je mimo čtverec — pěšec ho předběhne. Počítej tempa.', fen: '8/6k1/8/8/8/8/P5K1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-draw', typeId: 'kral-pesec', order: 4, title: 'Udrž remízu', hint: 'Drž opozici — stůj proti bílému králi s jedním polem mezi vámi, a když pěšec dojde na sedmou s šachem, je to remíza.', fen: '8/8/8/8/4k3/8/4P3/4K3 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'square', typeId: 'ctverec', order: 1, title: 'Pravidlo čtverce', hint: 'Když je tvůj král ve čtverci pěšce, dohoní ho. Běž rovnou za ním.', fen: '8/8/8/8/3k3P/8/8/7K b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'prulom-1', typeId: 'prulom', order: 1, title: 'Průlom: volná cesta', hint: 'Obětuj pěšce, aby jeden z těch zbylých doběhl až na konec — král na to nestihne dojít.', fen: '7k/8/8/1ppp4/1PPP4/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-2', typeId: 'prulom', order: 2, title: 'Průlom: král je blízko', hint: 'Stejná oběť, ale černý král je blíž — spočítej, čí pěšec doběhne první.', fen: '8/8/8/1ppp4/1PPP4/7k/8/6K1 w - - 0 1', human: 'w', goal: 'win' },
  // Věžové koncovky
  { id: 'lucena', typeId: 'lucena', order: 1, title: 'Lucena: stavba mostu', hint: 'Šach věží, pak věž na čtvrtou řadu — postavíš králi most před šachy.', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'philidor', typeId: 'philidor', order: 1, title: 'Philidor: věž na šesté řadě', hint: 'Věž drž na šesté řadě, dokud pěšec nepostoupí; pak ji pošli dozadu a šachuj krále zezadu.', fen: '4k3/8/r7/3PK3/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'rvp', typeId: 'vez-pesec', order: 1, title: 'Věž proti pěšci', hint: 'Věž za pěšce, král k němu — pěšec na sedmé není nic, když ho král nekryje.', fen: '8/8/8/8/3k4/8/3p4/3K1R2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rvp2', typeId: 'vez-pesec', order: 2, title: 'Věž proti pěšci II', hint: 'Tvůj král pěšce blokuje. Odtáhni věž daleko od černého krále, šachuj ho zdálky a pěšce pak seber králem.', fen: '8/8/8/8/8/2k5/1p6/1K1R4 w - - 0 1', human: 'w', goal: 'win' },
  // Dáma proti pěšci
  { id: 'qvbp', typeId: 'dama-pesec-typ', order: 1, title: 'Dáma proti pěšci na b2', hint: 'Šachy tak, aby král musel před pěšce — pak má tvůj král čas přijít.', fen: '8/8/8/8/8/1k6/1p6/1K4Q1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvp', typeId: 'dama-pesec-typ', order: 2, title: 'Dáma proti pěšci na d2', hint: 'Šach, šach, až král musí stoupnout před pěšce — v tu chvíli přiskoč králem o krok blíž. Opakuj.', fen: 'Q7/8/8/8/8/8/3pk3/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvap', typeId: 'dama-pesec-typ', order: 3, title: 'Krajní pěšec drží remízu', hint: 'Král do rohu před pěšce — když tě dáma nutí, nech se zahnat do a1: pat.', fen: '8/8/8/8/8/k7/p7/6QK b - - 0 1', human: 'b', goal: 'draw' },
];

export function endgameType(typeId: string): EndgameType | undefined {
  return ENDGAME_TYPES.find((t) => t.id === typeId);
}

export function endgamesOfType(typeId: string): Endgame[] {
  return ENDGAMES.filter((e) => e.typeId === typeId).slice().sort((a, b) => a.order - b.order);
}

export function typesOfCategory(categoryId: string): EndgameType[] {
  return ENDGAME_TYPES.filter((t) => t.categoryId === categoryId);
}

export function readEndgameProgress(storage: Storage | null): EndgameProgress {
  const fallback: EndgameProgress = { done: {} };
  let raw: string | null = null;
  try {
    raw = storage?.getItem(ENDGAMES_STORAGE_KEY) ?? null;
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) throw new Error('not an object');
    const o = v as Record<string, unknown>;
    const done: Record<string, true> = {};
    if (typeof o.done === 'object' && o.done !== null) {
      for (const id of Object.keys(o.done as Record<string, unknown>)) if (ENDGAMES.some((e) => e.id === id)) done[id] = true;
    }
    return { done };
  } catch {
    console.warn('Stored endgame progress is unreadable; starting over');
    return fallback;
  }
}

export function writeEndgameProgress(storage: Storage | null, progress: EndgameProgress): void {
  try {
    storage?.setItem(ENDGAMES_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Could not persist endgame progress', err);
  }
}

/** Whether a finished game (result from White's point of view) met the goal. */
export function goalMet(endgame: Endgame, result: '1-0' | '0-1' | '1/2-1/2' | '*'): boolean {
  const won = (result === '1-0' && endgame.human === 'w') || (result === '0-1' && endgame.human === 'b');
  if (endgame.goal === 'win') return won;
  return won || result === '1/2-1/2';
}
