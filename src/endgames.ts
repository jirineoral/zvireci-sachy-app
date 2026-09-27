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
  { id: 'dama-kral-1', typeId: 'dama-kral', order: 1, title: 'Dáma a král 1/7', hint: 'Mat jedním tahem! Najdi šach dámou, po kterém černý král nemá kam uhnout.', fen: '7k/8/7K/8/8/8/3Q4/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-2', typeId: 'dama-kral', order: 2, title: 'Dáma a král 2/7', hint: 'Mat dvěma tahy: nejdřív přiveď krále blíž (pozor, ať to není pat), pak dáma dá mat.', fen: '5k2/Q7/8/5K2/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-3', typeId: 'dama-kral', order: 3, title: 'Dáma a král 3/7', hint: 'Dáma už drží krále na první řadě. Nech ho tam, přiveď svého krále blíž a pak dej mat. Pozor na pat!', fen: '8/8/8/8/8/8/7Q/3k3K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-4', typeId: 'dama-kral', order: 4, title: 'Dáma a král 4/7', hint: 'Král soupeře je blízko kraje. Dámou mu ber pole (drž se od něj o skok jezdce) a přiveď svého krále. Pozor na pat!', fen: '8/4Q3/6k1/8/8/8/8/5K2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kq', typeId: 'dama-kral', order: 5, title: 'Dáma a král 5/7', hint: 'Zatlač dámou krále na kraj (drž se od něj o skok jezdce), pak přiveď svého krále. Pozor na pat!', fen: '4k3/8/8/8/8/8/8/4K2Q w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-6', typeId: 'dama-kral', order: 6, title: 'Dáma a král 6/7', hint: 'Tvůj král je daleko. Dámou krále soupeře zatlač ke kraji a mezitím přiveď svého krále. Dá to víc tahů.', fen: '8/1Q6/6k1/8/8/8/8/1K6 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-kral-7', typeId: 'dama-kral', order: 7, title: 'Dáma a král 7/7', hint: 'Král soupeře stojí uprostřed. Dámou ho krok po kroku zatlač na kraj, pak přiveď krále a matuj. Pozor na pat!', fen: '8/8/3k4/8/4Q3/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  // Věž a král
  { id: 'vez-kral-1', typeId: 'vez-kral', order: 1, title: 'Věž a král 1/7', hint: 'Mat jedním tahem! Tvůj král hlídá krále soupeře zepředu — dej šach věží po kraji.', fen: '8/8/8/8/8/2R3K1/8/7k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-2', typeId: 'vez-kral', order: 2, title: 'Věž a král 2/7', hint: 'Král soupeře je v rohu. Přiveď svého krále blíž (pozor na pat!) a pak dej mat věží po kraji.', fen: '1k6/3K4/8/8/8/5R2/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-3', typeId: 'vez-kral', order: 3, title: 'Věž a král 3/7', hint: 'Král soupeře je na kraji. Věží mu hlídej cestu ven, přiveď svého krále naproti a pak dej šach po kraji.', fen: '8/8/8/1K6/7R/8/8/1k6 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-4', typeId: 'vez-kral', order: 4, title: 'Věž a král 4/7', hint: 'Věž drží krále na sloupcích a–b. Přiveď svého krále, a když budou králové proti sobě, dej šach věží.', fen: '1k6/8/5K2/8/8/2R5/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kr', typeId: 'vez-kral', order: 5, title: 'Věž a král 5/7', hint: 'Věž odřízne krále na řadě, tvůj král jde naproti; když stojí králové proti sobě, dej šach.', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-6', typeId: 'vez-kral', order: 6, title: 'Věž a král 6/7', hint: 'Král je uprostřed. Věží mu postav „ohrádku“ a zmenšuj ji; tvůj král jde naproti a věž chrání. Dá to víc tahů.', fen: '8/8/8/4k3/8/8/8/R5K1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-kral-7', typeId: 'vez-kral', order: 7, title: 'Věž a král 7/7', hint: 'Král je uprostřed a tvůj král daleko. Věží mu postav „ohrádku“, přiveď krále a ohrádku zmenšuj, až bude na kraji.', fen: '8/8/8/8/3k4/1R6/8/6K1 w - - 0 1', human: 'w', goal: 'win' },
  // Dvě věže
  { id: 'dve-veze-1', typeId: 'dve-veze', order: 1, title: 'Dvě věže 1/6', hint: 'Mat jedním tahem! Jedna věž už hlídá druhou řadu — druhou dej šach po první řadě.', fen: '8/8/5K2/8/4R3/8/1R6/7k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rr', typeId: 'dve-veze', order: 2, title: 'Dvě věže 2/6', hint: 'Věže střídavě berou králi řadu po řadě — jako po žebříku až k matu.', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-3', typeId: 'dve-veze', order: 3, title: 'Dvě věže 3/6', hint: 'Věže berou králi řadu po řadě — jako po žebříku, rovnou k matu.', fen: '8/8/8/3K2R1/8/6R1/4k3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-4', typeId: 'dve-veze', order: 4, title: 'Dvě věže 4/6', hint: 'Věže střídavě berou králi řadu po řadě — jako po žebříku až k matu.', fen: '4K3/4R3/8/5k2/8/8/8/2R5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-5', typeId: 'dve-veze', order: 5, title: 'Dvě věže 5/6', hint: 'Věže střídavě berou králi řadu po řadě. Když se král přiblíží k věži, odtáhni ji na druhý konec řady.', fen: '4R3/8/8/6R1/8/1k6/7K/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dve-veze-6', typeId: 'dve-veze', order: 6, title: 'Dvě věže 6/6', hint: 'Král je dál od kraje — než začneš „žebřík“, zkontroluj, že mu žádná věž nehrozí.', fen: '2K5/8/6R1/8/3k4/8/6R1/8 w - - 0 1', human: 'w', goal: 'win' },
  // Dva střelci
  { id: 'dva-strelci-1', typeId: 'dva-strelci', order: 1, title: 'Dva střelci 1/7', hint: 'Mat jedním tahem! Jeden střelec hlídá pole vedle krále, druhý dá šach po úhlopříčce.', fen: '7k/8/6K1/8/2B2B2/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-2', typeId: 'dva-strelci', order: 2, title: 'Dva střelci 2/7', hint: 'Mat ve třech tazích. Král soupeře je zavřený v rohu — střelci mu seberou poslední volná pole. Pozor, ať to není pat!', fen: '7k/8/6K1/8/8/3B4/8/2B5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-3', typeId: 'dva-strelci', order: 3, title: 'Dva střelci 3/7', hint: 'Král soupeře je v rohu. Přiveď svého krále blíž (ne moc — pozor na pat!) a pak ho střelci zamatuj.', fen: '3B4/8/8/8/3K4/8/8/5B1k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-4', typeId: 'dva-strelci', order: 4, title: 'Dva střelci 4/7', hint: 'Střelci vedle sebe tvoří zeď. Zatlač krále po kraji do rohu, tvůj král pomáhá, a pak dej mat.', fen: '4k3/8/8/2BK4/8/1B6/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-5', typeId: 'dva-strelci', order: 5, title: 'Dva střelci 5/7', hint: 'Král soupeře je v rohu, ale tvůj král je daleko. Střelci ho tam udrž a přiveď krále. Pozor na pat!', fen: '8/8/8/6K1/8/8/1BB5/7k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'bb', typeId: 'dva-strelci', order: 6, title: 'Dva střelci 6/7', hint: 'Střelci vedle sebe tvoří zeď; krále zatlač do rohu a pak přijde tvůj král.', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dva-strelci-7', typeId: 'dva-strelci', order: 7, title: 'Dva střelci 7/7', hint: 'Král je uprostřed a střelci jsou rozházení. Nejdřív je postav vedle sebe do zdi, pak krále zatlač do rohu. Dá to hodně tahů.', fen: '2B5/8/8/8/5k2/B7/8/5K2 w - - 0 1', human: 'w', goal: 'win' },
  // Střelec a jezdec (pro odvážné)
  { id: 'strelec-jezdec-1', typeId: 'strelec-jezdec', order: 1, title: 'Střelec a jezdec (pro odvážné) 1/7', hint: 'Mat jedním tahem! Jezdec hlídá pole vedle krále, střelec dá šach po úhlopříčce.', fen: 'k7/3N4/1K6/8/8/3B4/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-2', typeId: 'strelec-jezdec', order: 2, title: 'Střelec a jezdec (pro odvážné) 2/7', hint: 'Král je blízko správného rohu (a1 — stejná barva jako tvůj střelec). Zažeň ho tam a dej mat.', fen: '8/8/3B4/8/3N4/8/4K3/2k5 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-3', typeId: 'strelec-jezdec', order: 3, title: 'Střelec a jezdec (pro odvážné) 3/7', hint: 'Král je už ve správném rohu (h1 — barva tvého střelce). Přiveď jezdce a krále a dej mat. Pozor na pat!', fen: '2N5/8/8/8/8/8/4B3/3K3k w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-4', typeId: 'strelec-jezdec', order: 4, title: 'Střelec a jezdec (pro odvážné) 4/7', hint: 'Mat jde jen v rohu barvy střelce — tady h8. Zatlač krále po kraji do toho rohu.', fen: '8/8/7k/8/3K4/8/5BN1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-5', typeId: 'strelec-jezdec', order: 5, title: 'Střelec a jezdec (pro odvážné) 5/7', hint: 'Mat jde jen v rohu barvy střelce (h1 nebo a8). Nejdřív přiveď jezdce blíž, pak tlač krále po kraji.', fen: '8/3B4/5K2/7k/8/8/N7/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'strelec-jezdec-6', typeId: 'strelec-jezdec', order: 6, title: 'Střelec a jezdec (pro odvážné) 6/7', hint: 'Mat jde jen v rohu barvy střelce (a1 nebo h8). Krále tlač po první řadě do správného rohu.', fen: '8/8/8/5K2/8/7N/7B/4k3 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kbn', typeId: 'strelec-jezdec', order: 7, title: 'Střelec a jezdec (pro odvážné) 7/7', hint: 'Mat jde jen v rohu barvy střelce. Nejdřív krále na kraj, pak ho tlač po kraji do správného rohu.', fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1', human: 'w', goal: 'win' },
  // Král a pěšec
  { id: 'kral-pesec-1', typeId: 'kral-pesec', order: 1, title: 'Král a pěšec 1/7', hint: 'Tvůj král stojí před pěšcem na šesté řadě — to je vyhrané. Neustupuj s ním dozadu; král jde napřed, pěšec za ním.', fen: '3k4/8/4K3/4P3/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'race', typeId: 'kral-pesec', order: 2, title: 'Král a pěšec 2/7', hint: 'Černý král je mimo čtverec — pěšec ho předběhne. Počítej tempa a nezapomeň: z druhé řady smí pěšec o dvě pole.', fen: '8/6k1/8/8/8/8/P5K1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-win', typeId: 'kral-pesec', order: 3, title: 'Král a pěšec 3/7', hint: 'Král jde napřed, pěšec za ním. Nespěchej s pěšcem.', fen: '4k3/8/3K4/4P3/8/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kral-pesec-4', typeId: 'kral-pesec', order: 4, title: 'Král a pěšec 4/7', hint: 'Pěšec sám neuteče — černý král je ve čtverci. Nejdřív veď svého krále dopředu, před pěšce; pěšec počká.', fen: '8/6k1/8/8/4P3/1K6/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-far', typeId: 'kral-pesec', order: 5, title: 'Král a pěšec 5/7', hint: 'Nejdřív král dopředu, pěšec počká. Opozice rozhoduje.', fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kral-pesec-6', typeId: 'kral-pesec', order: 6, title: 'Král a pěšec 6/7', hint: 'Pěšec je daleko od tvého krále a černý král je ve čtverci. Veď krále přes celou šachovnici k pěšci a dostaň se před něj dřív než soupeř.', fen: '1k6/8/8/8/K7/6P1/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'kp-draw', typeId: 'kral-pesec', order: 7, title: 'Král a pěšec 7/7 (remíza)', hint: 'Drž opozici — stůj proti bílému králi s jedním polem mezi vámi, a když pěšec dojde na sedmou s šachem, je to remíza.', fen: '8/8/8/8/4k3/8/4P3/4K3 b - - 0 1', human: 'b', goal: 'draw' },
  // Pravidlo čtverce
  { id: 'ctverec-1', typeId: 'ctverec', order: 1, title: 'Pravidlo čtverce 1/7', hint: 'Nakresli si čtverec od pěšce až k poslední řadě. Tvůj král v něm stojí, takže pěšce dohoní — běž k němu.', fen: '8/8/8/4k3/8/P7/8/7K b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-2', typeId: 'ctverec', order: 2, title: 'Pravidlo čtverce 2/7', hint: 'Tvůj král je ve čtverci pěšce, ale jen tak tak. Běž hned k pěšci, ne na druhou stranu.', fen: '8/5k2/8/8/2P5/8/8/K7 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-3', typeId: 'ctverec', order: 3, title: 'Pravidlo čtverce 3/7', hint: 'Stojíš těsně pod čtvercem pěšce. Vstup do něj — krokem nahoru na čtvrtou řadu.', fen: '8/8/8/8/7P/4k3/8/3K4 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'square', typeId: 'ctverec', order: 4, title: 'Pravidlo čtverce 4/7', hint: 'Když je tvůj král ve čtverci pěšce, dohoní ho. Běž rovnou za ním.', fen: '8/8/8/8/3k3P/8/8/7K b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-5', typeId: 'ctverec', order: 5, title: 'Pravidlo čtverce 5/7', hint: 'Pozor, pěšec na druhé řadě smí táhnout o dvě pole! Čtverec počítej, jako by už stál o pole výš.', fen: '8/8/8/8/6k1/8/P7/7K b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-6', typeId: 'ctverec', order: 6, title: 'Pravidlo čtverce 6/7', hint: 'Stojíš přesně na hraně čtverce. Jen jeden tah tě v něm udrží: jdi šikmo nahoru, k pěšci.', fen: '8/8/8/P6K/4k3/8/8/8 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'ctverec-7', typeId: 'ctverec', order: 7, title: 'Pravidlo čtverce 7/7', hint: 'Pěšec smí o dvě pole a ty stojíš těsně mimo jeho čtverec. Jen jeden tah tě do něj dostane — najdi ho.', fen: '7K/8/8/8/8/8/P5k1/8 b - - 0 1', human: 'b', goal: 'draw' },
  // Průlom
  { id: 'prulom-1', typeId: 'prulom', order: 1, title: 'Průlom 1/6', hint: 'Obětuj jednoho pěšce: když ho černý sebere, druhý pěšec proběhne až do dámy. Král soupeře je moc daleko.', fen: '7k/1p6/1P6/2P5/8/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-2', typeId: 'prulom', order: 2, title: 'Průlom 2/6', hint: 'Dva pěšci proti jednomu: jednoho obětuj, aby ten druhý mohl proběhnout na osmou řadu.', fen: '7k/1p6/8/P1P5/8/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-3', typeId: 'prulom', order: 3, title: 'Průlom 3/6', hint: 'Tři proti třem: začni prostředním pěšcem! Po braní obětuj dalšího a třetí pěšec proběhne.', fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-4', typeId: 'prulom', order: 4, title: 'Průlom 4/6', hint: 'Stejný trik na druhém křídle. Jiný tah než oběť prostředního pěšce nevyhrává — král se nestihne dostat.', fen: 'k7/5ppp/8/5PPP/8/8/8/K7 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-5', typeId: 'prulom', order: 5, title: 'Průlom 5/6', hint: 'Černý král je blíž — spočítej, že tvůj pěšec doběhne dřív. Začni hned, každé tempo se počítá.', fen: '8/1k3ppp/8/5PPP/8/8/8/1K6 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'prulom-6', typeId: 'prulom', order: 6, title: 'Průlom 6/6', hint: 'Král soupeře je hodně blízko, ale průlom pořád vyjde — jen když začneš hned tím správným pěšcem. Promysli, kterého pěšce černý sebere.', fen: '8/ppp3k1/8/PPP5/8/8/8/6K1 w - - 0 1', human: 'w', goal: 'win' },
  // Lucena
  { id: 'lucena-1', typeId: 'lucena', order: 1, title: 'Lucena 1/7', hint: 'Most je skoro hotový: tvoje věž na čtvrté řadě tě kryje. Zakryj šach věží — pak už pěšec projde.', fen: '8/1P2k3/8/1K6/3R4/8/1r6/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-2', typeId: 'lucena', order: 2, title: 'Lucena 2/7', hint: 'Soupeř tě šachuje. Uhýbej králem dolů k věži na čtvrté řadě — ta ti pak zakryje šach jako most.', fen: '8/1PK1k3/8/8/3R4/8/2r5/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-3', typeId: 'lucena', order: 3, title: 'Lucena 3/7', hint: 'Věž už stojí na čtvrté řadě a hlídá krále soupeře. Vylez králem z rohu vedle pěšce; až tě začnou šachovat, schováš se za most z věže.', fen: '1K6/1P2k3/8/8/3R4/8/r7/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-4', typeId: 'lucena', order: 4, title: 'Lucena 4/7', hint: 'Černý král ti brání vylézt. Nejdřív ho šachem věží odežeň o sloupec dál, pak vylez králem a postav most.', fen: '1k1K4/3P4/8/8/2R5/8/4r3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-5', typeId: 'lucena', order: 5, title: 'Lucena 5/7', hint: 'Černý král stojí moc blízko. Šach věží ho odežene, pak vylez králem a věž na čtvrté řadě ti postaví most.', fen: '2K1k3/2P5/8/8/3R4/8/1r6/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena-6', typeId: 'lucena', order: 6, title: 'Lucena 6/7', hint: 'Než vylezeš králem, připrav most: věž na čtvrtou řadu. Pak králem ven a šachy zakryješ věží.', fen: '1K6/1P2k3/8/8/8/8/r7/3R4 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'lucena', typeId: 'lucena', order: 7, title: 'Lucena 7/7', hint: 'Šach věží, pak věž na čtvrtou řadu — postavíš králi most před šachy.', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', human: 'w', goal: 'win' },
  // Philidor
  { id: 'philidor-1', typeId: 'philidor', order: 1, title: 'Philidor 1/6', hint: 'Postav věž na šestou řadu (třetí od tebe). Bílý král pak nemůže dopředu a pěšec sám neprojde.', fen: '1k6/8/8/1PK5/8/4r3/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor', typeId: 'philidor', order: 2, title: 'Philidor 2/6', hint: 'Věž drž na šesté řadě, dokud pěšec nepostoupí; pak ji pošli dozadu a šachuj krále zezadu.', fen: '4k3/8/r7/3PK3/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-3', typeId: 'philidor', order: 3, title: 'Philidor 3/6', hint: 'Tvoje věž na poslední řadě je pasivní — bílý král by vlezl na šestou řadu a dal mat. Hned s ní na šestou řadu!', fen: '1r2k3/7R/8/3PK3/8/8/8/8 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-4', typeId: 'philidor', order: 4, title: 'Philidor 4/6', hint: 'Pěšec ti napadl věž. Uhni s ní, ale zůstaň na šesté řadě — a ne na pole, kde ji sebere král nebo bílá věž.', fen: '1k6/8/r7/1PK5/8/8/8/7R b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-5', typeId: 'philidor', order: 5, title: 'Philidor 5/6', hint: 'Pěšec vstoupil na šestou řadu, takže se za ním bílý král neschová. Teď pošli věž dozadu a šachuj zezadu.', fen: '4k3/7R/r2P4/4K3/8/8/8/8 b - - 0 1', human: 'b', goal: 'draw' },
  { id: 'philidor-6', typeId: 'philidor', order: 6, title: 'Philidor 6/6', hint: 'Bílý král vlezl na šestou řadu a hrozí mat. Jediná záchrana: hned ho šachuj zezadu a nepřestávej.', fen: '4k3/7R/3PK3/8/8/8/8/r7 b - - 0 1', human: 'b', goal: 'draw' },
  // Věž proti pěšci
  { id: 'rvp', typeId: 'vez-pesec', order: 1, title: 'Věž proti pěšci 1/7', hint: 'Černý král pěšce nekryje — pěšec na sedmé není nic. Seber ho a pak dej mat věží.', fen: '8/8/8/8/3k4/8/3p4/3K1R2 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-2', typeId: 'vez-pesec', order: 2, title: 'Věž proti pěšci 2/7', hint: 'Pěšec je daleko od cíle. Věží odřízni černého krále (nebo se postav za pěšce) a v klidu přiveď svého krále.', fen: '7R/8/1k6/3p4/8/8/6K1/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'rvp2', typeId: 'vez-pesec', order: 3, title: 'Věž proti pěšci 3/7', hint: 'Tvůj král pěšce blokuje. Odtáhni věž daleko od černého krále, šachuj ho zdálky a pěšce pak seber králem.', fen: '8/8/8/8/8/2k5/1p6/1K1R4 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-4', typeId: 'vez-pesec', order: 4, title: 'Věž proti pěšci 4/7', hint: 'Tvůj král je daleko. Postav věž tak, aby oddělila černého krále od tvého (odřízni ho po sloupci) — pak tvůj král dojde k pěšci.', fen: '8/8/6K1/2k5/2p5/8/8/R7 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-5', typeId: 'vez-pesec', order: 5, title: 'Věž proti pěšci 5/7', hint: 'Nejdřív přiveď svého krále blíž k pěšci — věž zatím počká. Každé tempo se počítá.', fen: '8/4p2K/8/6k1/1R6/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-6', typeId: 'vez-pesec', order: 6, title: 'Věž proti pěšci 6/7', hint: 'Tvůj král je hodně daleko: veď ho k pěšci hned teď, každé tempo se počítá. Věž pak postav za pěšce.', fen: '8/8/8/4k3/6p1/K7/8/R7 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'vez-pesec-7', typeId: 'vez-pesec', order: 7, title: 'Věž proti pěšci 7/7', hint: 'Jen jeden tah vyhrává: postav věž za pěšce. Pak ho tvůj král s věží společně seberou.', fen: '3R4/3K4/8/3k4/4p3/8/8/8 w - - 0 1', human: 'w', goal: 'win' },
  // Dáma proti pěšci
  { id: 'qvbp', typeId: 'dama-pesec-typ', order: 1, title: 'Dáma proti pěšci 1/7', hint: 'Tvůj král stojí před pěšcem. Napadni pěšce ještě dámou — dva útoky proti jedné obraně — a pak dej mat.', fen: '8/8/8/8/8/1k6/1p6/1K4Q1 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-2', typeId: 'dama-pesec-typ', order: 2, title: 'Dáma proti pěšci 2/7', hint: 'Pěšec ještě není na sedmé řadě. Postav dámu do jeho cesty a pak v klidu přiveď svého krále.', fen: '8/8/8/5Q2/3k4/1p6/8/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-3', typeId: 'dama-pesec-typ', order: 3, title: 'Dáma proti pěšci 3/7', hint: 'Pěšec je těsně před proměnou, ale tvůj král je blízko. Hlídej dámou pole proměny a králem pomoz pěšce sebrat.', fen: '8/8/8/8/6Q1/3k4/1K1p4/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-4', typeId: 'dama-pesec-typ', order: 4, title: 'Dáma proti pěšci 4/7', hint: 'Nejdřív dámou zastav pěšce (hlídej pole proměny nebo šachuj). Pak šachuj tak, aby se černý král musel postavit před pěšce — a v tu chvíli přiskoč králem.', fen: 'Q7/8/8/6K1/3k4/8/4p3/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvp', typeId: 'dama-pesec-typ', order: 5, title: 'Dáma proti pěšci 5/7', hint: 'Šach, šach, až král musí stoupnout před pěšce — v tu chvíli přiskoč králem o krok blíž. Opakuj.', fen: 'Q7/8/8/8/8/8/3pk3/7K w - - 0 1', human: 'w', goal: 'win' },
  { id: 'dama-pesec-typ-6', typeId: 'dama-pesec-typ', order: 6, title: 'Dáma proti pěšci 6/7', hint: 'Šachuj, dokud se černý král nepostaví před pěšce na b1. Pak máš jedno tempo: přiskoč králem o krok blíž. Opakuj.', fen: '8/8/3Q4/5K2/8/8/1pk5/8 w - - 0 1', human: 'w', goal: 'win' },
  { id: 'qvap', typeId: 'dama-pesec-typ', order: 7, title: 'Dáma proti pěšci 7/7 (remíza)', hint: 'Zůstaň u pěšce a kryj ho. Když tě dáma zažene do rohu a1 před pěšce, bílý nesmí dát pat — krajní pěšec drží remízu.', fen: '8/8/8/8/8/k7/p7/6QK b - - 0 1', human: 'b', goal: 'draw' },
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
