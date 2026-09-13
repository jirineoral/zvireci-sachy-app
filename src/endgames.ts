/**
 * Endgame training (Phase 13 / R5): textbook positions the player has to win or hold.
 * Every FEN was checked with Stockfish 18 at depth 22 before it went in (see
 * docs/phase-13-plan.md, DoD 3) — a wrong goal here would teach the wrong thing. The
 * engine defends at full strength (`TRAINER`). Progress lives in `localStorage`.
 */
import type { Color } from 'chess.js';
import type { Difficulty } from './difficulty';

export type EndgameGoal = 'win' | 'draw';

export interface Endgame {
  id: string;
  /** Group label: 'základy' | 'střední' | 'těžké'. */
  group: string;
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

export const ENDGAMES: readonly Endgame[] = [
  // základy
  { id: 'kq', group: 'základy', title: 'Dáma a král proti králi', hint: 'Zatlač dámou krále na kraj (drž se od něj o skok jezdce), pak přiveď svého krále. Pozor na pat!', fen: '4k3/8/8/8/8/8/8/4K2Q w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kr', group: 'základy', title: 'Věž a král proti králi', hint: 'Věž odřízne krále na řadě, tvůj král jde naproti; když stojí králové proti sobě, dej šach.', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rr', group: 'základy', title: 'Dvě věže: žebřík', hint: 'Věže střídavě berou králi řadu po řadě — jako po žebříku až k matu.', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-win', group: 'základy', title: 'Pěšcovka: král před pěšcem', hint: 'Král jde napřed, pěšec za ním. Nespěchej s pěšcem.', fen: '4k3/8/3K4/4P3/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-draw', group: 'základy', title: 'Pěšcovka: udrž remízu', hint: 'Drž opozici — stůj proti bílému králi s jedním polem mezi vámi, a když pěšec dojde na sedmou s šachem, je to remíza.', fen: '8/8/8/8/4k3/8/4P3/4K3 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'square', group: 'základy', title: 'Pravidlo čtverce', hint: 'Když je tvůj král ve čtverci pěšce, dohoní ho. Běž rovnou za ním.', fen: '8/8/8/8/3k3P/8/8/7K b - - 0 1', human: 'b', goal: 'draw' },
  // střední
  { id: 'kp-far', group: 'střední', title: 'Pěšcovka: ze základní řady', hint: 'Nejdřív král dopředu, pěšec počká. Opozice rozhoduje.', fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'race', group: 'střední', title: 'Utíkej s pěšcem', hint: 'Černý král je mimo čtverec — pěšec ho předběhne. Počítej tempa.', fen: '8/6k1/8/8/8/8/P5K1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena', group: 'střední', title: 'Lucena: stavba mostu', hint: 'Šach věží, pak věž na čtvrtou řadu — postavíš králi most před šachy.', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'philidor', group: 'střední', title: 'Philidor: věž na šesté řadě', hint: 'Věž drž na šesté řadě, dokud pěšec nepostoupí; pak ji pošli dozadu a šachuj krále zezadu.', fen: '4k3/8/r7/3PK3/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'bb', group: 'střední', title: 'Dva střelci', hint: 'Střelci vedle sebe tvoří zeď; krále zatlač do rohu a pak přijde tvůj král.', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rvp', group: 'střední', title: 'Věž proti pěšci', hint: 'Věž za pěšce, král k němu — pěšec na sedmé není nic, když ho král nekryje.', fen: '8/8/8/8/3k4/8/3p4/3K1R2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvbp', group: 'střední', title: 'Dáma proti pěšci na b2', hint: 'Šachy tak, aby král musel před pěšce — pak má tvůj král čas přijít.', fen: '8/8/8/8/8/1k6/1p6/1K4Q1 w - - 0 1', human: 'w', goal: 'win' },
  // těžké
  { id: 'kbn', group: 'těžké', title: 'Střelec a jezdec (těžké)', hint: 'Mat jde jen v rohu barvy střelce. Nejdřív krále na kraj, pak ho tlač po kraji do správného rohu.', fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvp', group: 'těžké', title: 'Dáma proti pěšci na d2', hint: 'Šach, šach, až král musí stoupnout před pěšce — v tu chvíli přiskoč králem o krok blíž. Opakuj.', fen: 'Q7/8/8/8/8/8/3pk3/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rvp2', group: 'těžké', title: 'Věž proti pěšci II', hint: 'Věž nejdřív za pěšce (šach ze zadu), potom se král přiblíží.', fen: '8/8/8/8/8/2k5/1p6/1K1R4 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvap', group: 'těžké', title: 'Krajní pěšec drží remízu', hint: 'Král do rohu před pěšce — když tě dáma nutí, nech se zahnat do a1: pat.', fen: '8/8/8/8/8/k7/p7/6QK b - - 0 1', human: 'b', goal: 'draw' },
];

export const ENDGAME_GROUPS: readonly string[] = ['základy', 'střední', 'těžké'];

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
