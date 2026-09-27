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
  // Dáma a král
  { id: 'dama-kral-1', typeId: 'dama-kral', order: 1, title: 'Dáma a král 1/7', hint: 'Král soupeře je už na kraji — dej mu šach dámou tak, aby nemohl uhnout, a přiveď svého krále blíž.', fen: '7k/8/7K/8/8/8/3Q4/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-2', typeId: 'dama-kral', order: 2, title: 'Dáma a král 2/7', hint: 'Král soupeře je už na kraji — dej mu šach dámou tak, aby nemohl uhnout, a přiveď svého krále blíž.', fen: '5k2/Q7/8/5K2/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-3', typeId: 'dama-kral', order: 3, title: 'Dáma a král 3/7', hint: 'Král soupeře je už na kraji — dej mu šach dámou tak, aby nemohl uhnout, a přiveď svého krále blíž.', fen: '8/8/8/8/8/8/7Q/3k3K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-4', typeId: 'dama-kral', order: 4, title: 'Dáma a král 4/7', hint: 'Zatlač dámou krále na kraj (drž se od něj o skok jezdce), pak přiveď svého krále. Pozor na pat!', fen: '8/4Q3/6k1/8/8/8/8/5K2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kq', typeId: 'dama-kral', order: 5, title: 'Dáma a král 5/7', hint: 'Zatlač dámou krále na kraj (drž se od něj o skok jezdce), pak přiveď svého krále. Pozor na pat!', fen: '4k3/8/8/8/8/8/8/4K2Q w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-6', typeId: 'dama-kral', order: 6, title: 'Dáma a král 6/7', hint: 'Král soupeře je uprostřed — nejdřív ho zatlač k okraji, teprve pak ho matuj. Bude to trvat víc tahů.', fen: '8/1Q6/6k1/8/8/8/8/1K6 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-7', typeId: 'dama-kral', order: 7, title: 'Dáma a král 7/7', hint: 'Král soupeře je uprostřed — nejdřív ho zatlač k okraji, teprve pak ho matuj. Bude to trvat víc tahů.', fen: '8/8/3k4/8/4Q3/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  // Věž a král
  { id: 'vez-kral-1', typeId: 'vez-kral', order: 1, title: 'Věž a král 1/7', hint: 'Král soupeře je skoro v rohu — odřízni ho věží a dej mat králem a věží společně.', fen: '8/8/8/8/8/2R3K1/8/7k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-2', typeId: 'vez-kral', order: 2, title: 'Věž a král 2/7', hint: 'Král soupeře je skoro v rohu — odřízni ho věží a dej mat králem a věží společně.', fen: '1k6/3K4/8/8/8/5R2/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-3', typeId: 'vez-kral', order: 3, title: 'Věž a král 3/7', hint: 'Král soupeře je skoro v rohu — odřízni ho věží a dej mat králem a věží společně.', fen: '8/8/8/1K6/7R/8/8/1k6 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-4', typeId: 'vez-kral', order: 4, title: 'Věž a král 4/7', hint: 'Věž odřízne krále na řadě, tvůj král jde naproti; když stojí králové proti sobě, dej šach.', fen: '1k6/8/5K2/8/8/2R5/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-5', typeId: 'vez-kral', order: 5, title: 'Věž a král 5/7', hint: 'Věž odřízne krále na řadě, tvůj král jde naproti; když stojí králové proti sobě, dej šach.', fen: '8/8/8/8/2K5/6k1/8/2R5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kr', typeId: 'vez-kral', order: 6, title: 'Věž a král 6/7', hint: 'Král je uprostřed — nejdřív ho věží zatlač na kraj, pak teprve přiveď svého krále na mat.', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-7', typeId: 'vez-kral', order: 7, title: 'Věž a král 7/7', hint: 'Král je uprostřed — nejdřív ho věží zatlač na kraj, pak teprve přiveď svého krále na mat.', fen: '8/8/8/8/3k4/1R6/8/6K1 w - - 0 1', human: 'w', goal: 'win' },
  // Dvě věže
  { id: 'dve-veze-1', typeId: 'dve-veze', order: 1, title: 'Dvě věže 1/6', hint: 'Věže berou králi řadu po řadě — jako po žebříku, rovnou k matu.', fen: '8/8/5K2/8/4R3/8/1R6/7k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rr', typeId: 'dve-veze', order: 2, title: 'Dvě věže 2/6', hint: 'Věže berou králi řadu po řadě — jako po žebříku, rovnou k matu.', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-3', typeId: 'dve-veze', order: 3, title: 'Dvě věže 3/6', hint: 'Věže berou králi řadu po řadě — jako po žebříku, rovnou k matu.', fen: '8/8/8/3K2R1/8/6R1/4k3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-4', typeId: 'dve-veze', order: 4, title: 'Dvě věže 4/6', hint: 'Věže střídavě berou králi řadu po řadě — jako po žebříku až k matu.', fen: '4K3/4R3/8/5k2/8/8/8/2R5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-5', typeId: 'dve-veze', order: 5, title: 'Dvě věže 5/6', hint: 'Věže střídavě berou králi řadu po řadě — jako po žebříku až k matu.', fen: '4R3/8/8/6R1/8/1k6/7K/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-6', typeId: 'dve-veze', order: 6, title: 'Dvě věže 6/6', hint: 'Král je dál od kraje — než začneš „žebřík“, zkontroluj, že mu žádná věž nehrozí.', fen: '2K5/8/6R1/8/3k4/8/6R1/8 w - - 0 1', human: 'w', goal: 'win' },
  // Dva střelci
  { id: 'dva-strelci-1', typeId: 'dva-strelci', order: 1, title: 'Dva střelci 1/7', hint: 'Střelci vedle sebe už krále tlačí do rohu — doveď svého krále a dej mat.', fen: '3B4/8/8/8/3K4/8/8/5B1k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-2', typeId: 'dva-strelci', order: 2, title: 'Dva střelci 2/7', hint: 'Střelci vedle sebe už krále tlačí do rohu — doveď svého krále a dej mat.', fen: '4k3/8/8/2BK4/8/1B6/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-3', typeId: 'dva-strelci', order: 3, title: 'Dva střelci 3/7', hint: 'Střelci vedle sebe už krále tlačí do rohu — doveď svého krále a dej mat.', fen: '8/8/8/6K1/8/8/1BB5/7k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-4', typeId: 'dva-strelci', order: 4, title: 'Dva střelci 4/7', hint: 'Střelci vedle sebe tvoří zeď; krále zatlač do rohu a pak přijde tvůj král.', fen: '7k/8/8/8/1B6/7K/8/7B w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-5', typeId: 'dva-strelci', order: 5, title: 'Dva střelci 5/7', hint: 'Střelci vedle sebe tvoří zeď; krále zatlač do rohu a pak přijde tvůj král.', fen: '8/K7/5B2/1k6/8/7B/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'bb', typeId: 'dva-strelci', order: 6, title: 'Dva střelci 6/7', hint: 'Král je uprostřed — nejdřív ho zeď ze střelců zatlačí do rohu, pak přijde tvůj král. Dá to víc tahů.', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-7', typeId: 'dva-strelci', order: 7, title: 'Dva střelci 7/7', hint: 'Král je uprostřed — nejdřív ho zeď ze střelců zatlačí do rohu, pak přijde tvůj král. Dá to víc tahů.', fen: '2B5/8/8/8/5k2/B7/8/5K2 w - - 0 1', human: 'w', goal: 'win' },
  // Střelec a jezdec (pro odvážné)
  { id: 'strelec-jezdec-1', typeId: 'strelec-jezdec', order: 1, title: 'Střelec a jezdec (pro odvážné) 1/7', hint: 'Král je už skoro ve správném rohu — dokonči mat střelcem a jezdcem.', fen: '8/8/3B4/8/3N4/8/4K3/2k5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-2', typeId: 'strelec-jezdec', order: 2, title: 'Střelec a jezdec (pro odvážné) 2/7', hint: 'Král je už skoro ve správném rohu — dokonči mat střelcem a jezdcem.', fen: '2N5/8/8/8/8/8/4B3/3K3k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-3', typeId: 'strelec-jezdec', order: 3, title: 'Střelec a jezdec (pro odvážné) 3/7', hint: 'Král je už skoro ve správném rohu — dokonči mat střelcem a jezdcem.', fen: '8/8/7k/8/3K4/8/5BN1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-4', typeId: 'strelec-jezdec', order: 4, title: 'Střelec a jezdec (pro odvážné) 4/7', hint: 'Mat jde jen v rohu barvy střelce. Nejdřív krále na kraj, pak ho tlač po kraji do správného rohu.', fen: '8/3B4/5K2/7k/8/8/N7/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-5', typeId: 'strelec-jezdec', order: 5, title: 'Střelec a jezdec (pro odvážné) 5/7', hint: 'Mat jde jen v rohu barvy střelce. Nejdřív krále na kraj, pak ho tlač po kraji do správného rohu.', fen: '8/8/8/5K2/8/7N/7B/4k3 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kbn', typeId: 'strelec-jezdec', order: 6, title: 'Střelec a jezdec (pro odvážné) 6/7', hint: 'Pro odvážné: král je daleko od správného rohu, budeš ho muset převést přes celou šachovnici.', fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-7', typeId: 'strelec-jezdec', order: 7, title: 'Střelec a jezdec (pro odvážné) 7/7', hint: 'Pro odvážné: král je daleko od správného rohu, budeš ho muset převést přes celou šachovnici.', fen: '7N/8/8/7K/8/8/3k4/5B2 w - - 0 1', human: 'w', goal: 'win' },
  // Král a pěšec
  { id: 'kral-pesec-1', typeId: 'kral-pesec', order: 1, title: 'Král a pěšec 1/7', hint: 'Král jde napřed, pěšec za ním. Nespěchej s pěšcem.', fen: '8/8/5P2/3K4/8/8/2k5/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-win', typeId: 'kral-pesec', order: 2, title: 'Král a pěšec 2/7', hint: 'Král jde napřed, pěšec za ním. Nespěchej s pěšcem.', fen: '4k3/8/3K4/4P3/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'race', typeId: 'kral-pesec', order: 3, title: 'Král a pěšec 3/7', hint: 'Král jde napřed, pěšec za ním. Nespěchej s pěšcem.', fen: '8/6k1/8/8/8/8/P5K1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kral-pesec-4', typeId: 'kral-pesec', order: 4, title: 'Král a pěšec 4/7', hint: 'Nejdřív král dopředu, pěšec počká. Opozice rozhoduje.', fen: '8/6k1/8/8/4P3/1K6/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-far', typeId: 'kral-pesec', order: 5, title: 'Král a pěšec 5/7', hint: 'Nejdřív král dopředu, pěšec počká. Opozice rozhoduje.', fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kral-pesec-6', typeId: 'kral-pesec', order: 6, title: 'Král a pěšec 6/7', hint: 'Král soupeře je blízko — spočítej si opozici přesně, jinak pěšce neochráníš.', fen: '1k6/8/8/8/K7/6P1/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-draw', typeId: 'kral-pesec', order: 7, title: 'Král a pěšec 7/7 (remíza)', hint: 'Drž opozici — stůj proti bílému králi s jedním polem mezi vámi, a když pěšec dojde na sedmou s šachem, je to remíza.', fen: '8/8/8/8/4k3/8/4P3/4K3 b - - 0 1', human: 'b', goal: 'draw' },
  // Pravidlo čtverce
  { id: 'ctverec-1', typeId: 'ctverec', order: 1, title: 'Pravidlo čtverce 1/6', hint: 'Král je jasně ve čtverci pěšce — běž rovnou k němu, dohoníš ho snadno.', fen: '7k/8/7P/8/8/4K3/8/8 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-2', typeId: 'ctverec', order: 2, title: 'Pravidlo čtverce 2/6', hint: 'Král je jasně ve čtverci pěšce — běž rovnou k němu, dohoníš ho snadno.', fen: '8/8/8/8/P1k5/8/1K6/8 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-3', typeId: 'ctverec', order: 3, title: 'Pravidlo čtverce 3/6', hint: 'Král je jasně ve čtverci pěšce — běž rovnou k němu, dohoníš ho snadno.', fen: '6k1/8/5K1P/8/8/8/8/8 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-4', typeId: 'ctverec', order: 4, title: 'Pravidlo čtverce 4/6', hint: 'Když je tvůj král ve čtverci pěšce, dohoní ho. Běž rovnou za ním.', fen: '8/8/8/8/7P/4k3/8/3K4 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'square', typeId: 'ctverec', order: 5, title: 'Pravidlo čtverce 5/6', hint: 'Když je tvůj král ve čtverci pěšce, dohoní ho. Běž rovnou za ním.', fen: '8/8/8/8/3k3P/8/8/7K b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-6', typeId: 'ctverec', order: 6, title: 'Pravidlo čtverce 6/6', hint: 'Král je těsně na hraně čtverce — jediná cesta k pěšci je přímá, jinak ho nechytíš.', fen: '8/8/8/P6K/4k3/8/8/8 b - - 0 1', human: 'b', goal: 'draw' },
  // Lucena
  { id: 'lucena-1', typeId: 'lucena', order: 1, title: 'Lucena 1/6', hint: 'Pěšec je skoro v cíli. Postav věží most před šachy a král ho dovede na osmou řadu.', fen: 'k1K5/2P5/8/8/8/3R4/1r6/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-2', typeId: 'lucena', order: 2, title: 'Lucena 2/6', hint: 'Pěšec je skoro v cíli. Postav věží most před šachy a král ho dovede na osmou řadu.', fen: '1k1K4/3P4/8/8/8/8/2r1R3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-3', typeId: 'lucena', order: 3, title: 'Lucena 3/6', hint: 'Pěšec je skoro v cíli. Postav věží most před šachy a král ho dovede na osmou řadu.', fen: '3K1k2/3P4/8/8/8/8/4r3/2R5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-4', typeId: 'lucena', order: 4, title: 'Lucena 4/6', hint: 'Šach věží, pak věž na čtvrtou řadu — postavíš králi most před šachy.', fen: '1k1K4/3P4/8/8/2R5/8/4r3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-5', typeId: 'lucena', order: 5, title: 'Lucena 5/6', hint: 'Šach věží, pak věž na čtvrtou řadu — postavíš králi most před šachy.', fen: '2K1k3/2P5/8/8/3R4/8/1r6/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena', typeId: 'lucena', order: 6, title: 'Lucena 6/6', hint: 'Král soupeře je aktivnější — nejdřív ho odežeň šachy, teprve pak stavěj most.', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', human: 'w', goal: 'win' },
  // Philidor
  { id: 'philidor-1', typeId: 'philidor', order: 1, title: 'Philidor 1/6', hint: 'Věž drž na šesté řadě — pěšec se přes ni nedostane. Klidná remíza.', fen: '1k6/8/8/2PK4/8/5r2/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-2', typeId: 'philidor', order: 2, title: 'Philidor 2/6', hint: 'Věž drž na šesté řadě — pěšec se přes ni nedostane. Klidná remíza.', fen: '1k6/8/8/1PK5/8/4r3/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-3', typeId: 'philidor', order: 3, title: 'Philidor 3/6', hint: 'Věž drž na šesté řadě — pěšec se přes ni nedostane. Klidná remíza.', fen: 'k7/8/2r5/KP6/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor', typeId: 'philidor', order: 4, title: 'Philidor 4/6', hint: 'Věž drž na šesté řadě, dokud pěšec nepostoupí; pak ji pošli dozadu a šachuj krále zezadu.', fen: '4k3/8/r7/3PK3/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-5', typeId: 'philidor', order: 5, title: 'Philidor 5/6', hint: 'Věž drž na šesté řadě, dokud pěšec nepostoupí; pak ji pošli dozadu a šachuj krále zezadu.', fen: '2k5/8/1r6/2PK4/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-6', typeId: 'philidor', order: 6, title: 'Philidor 6/6', hint: 'Jen jeden tah drží remízu — věž musí zůstat přesně na šesté řadě, jinak prohraješ.', fen: '1k6/8/r7/1PK5/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  // Věž proti pěšci
  { id: 'vez-pesec-1', typeId: 'vez-pesec', order: 1, title: 'Věž proti pěšci 1/6', hint: 'Pěšec je ještě daleko od cíle — věž ho snadno zastaví, pak ho seber králem.', fen: '8/8/8/3K4/p5R1/8/k7/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-2', typeId: 'vez-pesec', order: 2, title: 'Věž proti pěšci 2/6', hint: 'Pěšec je ještě daleko od cíle — věž ho snadno zastaví, pak ho seber králem.', fen: '1k6/p7/8/5K2/6R1/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rvp2', typeId: 'vez-pesec', order: 3, title: 'Věž proti pěšci 3/6', hint: 'Pěšec je ještě daleko od cíle — věž ho snadno zastaví, pak ho seber králem.', fen: '8/8/8/8/8/2k5/1p6/1K1R4 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rvp', typeId: 'vez-pesec', order: 4, title: 'Věž proti pěšci 4/6', hint: 'Věž za pěšce, král k němu — pěšec na sedmé není nic, když ho král nekryje.', fen: '8/8/8/8/3k4/8/3p4/3K1R2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-5', typeId: 'vez-pesec', order: 5, title: 'Věž proti pěšci 5/6', hint: 'Věž za pěšce, král k němu — pěšec na sedmé není nic, když ho král nekryje.', fen: '8/4p2K/8/6k1/1R6/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-6', typeId: 'vez-pesec', order: 6, title: 'Věž proti pěšci 6/6', hint: 'Pěšec je kryt králem těsně před cílem — odtáhni věž daleko, šachuj zdálky a teprve pak ho seber.', fen: '8/8/8/4k3/6p1/K7/8/R7 w - - 0 1', human: 'w', goal: 'win' },
  // Dáma proti pěšci
  { id: 'dama-pesec-typ-1', typeId: 'dama-pesec-typ', order: 1, title: 'Dáma proti pěšci 1/7', hint: 'Šachuj dámou, dokud král nemusí před pěšec — pak máš čas přivést svého krále.', fen: '3Q4/5p2/8/8/8/k1K5/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-2', typeId: 'dama-pesec-typ', order: 2, title: 'Dáma proti pěšci 2/7', hint: 'Šachuj dámou, dokud král nemusí před pěšec — pak máš čas přivést svého krále.', fen: '3Q4/8/8/8/p7/8/1k1K4/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvbp', typeId: 'dama-pesec-typ', order: 3, title: 'Dáma proti pěšci 3/7', hint: 'Šachuj dámou, dokud král nemusí před pěšec — pak máš čas přivést svého krále.', fen: '8/8/8/8/8/1k6/1p6/1K4Q1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-4', typeId: 'dama-pesec-typ', order: 4, title: 'Dáma proti pěšci 4/7', hint: 'Šach, šach, až král musí stoupnout před pěšce — v tu chvíli přiskoč králem o krok blíž. Opakuj.', fen: '3K4/8/8/6p1/8/8/k7/6Q1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-5', typeId: 'dama-pesec-typ', order: 5, title: 'Dáma proti pěšci 5/7', hint: 'Šach, šach, až král musí stoupnout před pěšce — v tu chvíli přiskoč králem o krok blíž. Opakuj.', fen: 'K7/8/8/8/2p3k1/3Q4/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvp', typeId: 'dama-pesec-typ', order: 6, title: 'Dáma proti pěšci 6/7', hint: 'Pěšec je blízko proměny — najdi šach, který krále donutí přesně před pěšce, jinak uteče.', fen: 'Q7/8/8/8/8/8/3pk3/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvap', typeId: 'dama-pesec-typ', order: 7, title: 'Dáma proti pěšci 7/7 (remíza)', hint: 'Král do rohu před pěšce — když tě dáma nutí, nech se zahnat do a1: pat.', fen: '8/8/8/8/8/k7/p7/6QK b - - 0 1', human: 'b', goal: 'draw' },
  // Průlom
  { id: 'prulom-1', typeId: 'prulom', order: 1, title: 'Průlom 1/6', hint: 'Obětuj pěšce, aby jeden z těch zbylých doběhl až na konec — král na to nestihne dojít.', fen: '7k/8/8/3ppp2/3PPP2/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-2', typeId: 'prulom', order: 2, title: 'Průlom 2/6', hint: 'Obětuj pěšce, aby jeden z těch zbylých doběhl až na konec — král na to nestihne dojít.', fen: '8/8/7k/4ppp1/4PPP1/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-3', typeId: 'prulom', order: 3, title: 'Průlom 3/6', hint: 'Obětuj pěšce, aby jeden z těch zbylých doběhl až na konec — král na to nestihne dojít.', fen: '7k/8/8/2ppp3/2PPP3/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-4', typeId: 'prulom', order: 4, title: 'Průlom 4/6', hint: 'Stejná oběť, ale král soupeře je blíž — spočítej, čí pěšec doběhne první.', fen: '8/8/8/2ppp3/2PPP2k/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-5', typeId: 'prulom', order: 5, title: 'Průlom 5/6', hint: 'Stejná oběť, ale král soupeře je blíž — spočítej, čí pěšec doběhne první.', fen: '8/8/8/3ppp2/3PPP1k/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-6', typeId: 'prulom', order: 6, title: 'Průlom 6/6', hint: 'Král soupeře je hodně blízko — najdi přesné pořadí tahů, jinak tě předběhne.', fen: '8/8/8/1ppp4/1PPP3k/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
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
