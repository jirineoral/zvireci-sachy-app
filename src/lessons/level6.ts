/**
 * Level 6 — Expert: the plan's twelve lessons (docs/phase-22-plan.md, curriculum; the coach
 * review of session 2026-09-26) plus the owner's key-squares follow-up (lesson 3: pawns on the
 * 5th/6th rank and the rook pawn, decision 2026-09-28), and the level test (14).
 *
 * How every chess claim is checked (`npm run check:lessons`):
 *  - Tactics (mat 4. tahem, poslední řada, obranný tah, chycená figurka, the test) are Lichess
 *    puzzles (CC0; the id is noted, the FEN is the position after the opponent's first move),
 *    each step `best` (Stockfish, no other move within the margin) or `mate` (all mates).
 *  - Endgames with at most 7 pieces (klíčová pole, Réti, Saavedra, Vančura, lehká figura proti
 *    pěšci, mat střelcem a jezdcem, vzájemná nevýhoda tahu) against the Lichess tablebase:
 *    `tablebase` completeness, the `outcome` / `tbmoves` choose facts and the audit of every
 *    other result-keeping move. The key-square choose steps use the new `keysquares` fact: an
 *    exact K+P vs K bitbase (scripts/kpk.mjs) computes the pawn's key squares.
 *  - Lasker–Reichhelm has nine pieces: `best` at depth 24 (at the default depth 18 Stockfish
 *    cannot tell 1.Kb1 from the draws; at depth 24–34 Kb1 is +10 and more, everything else 0.00).
 *
 * Sources for the names and years (Wikipedia, checked 2026-09-28): Réti's study 1921; the
 * Saavedra position 1895 (Georges Barbier's study, Fernando Saavedra found 6.c8=V!); the
 * Vančura position — Josef Vančura (1898–1921), published 1924; Lasker–Reichhelm 1901 (article
 * "Corresponding squares": 1.Kb1 Kb7 2.Kc1 Kc7 3.Kd1 …, every white move the only win).
 */
import type { Lesson } from './types';

// ---- Lesson 1: Mat 4. tahem — Lichess puzzles EXtqO (black) and 7DNoH ----------------------
const EX_1 = 'r2qk2r/1pp2pp1/p1p5/2b1N3/4R1p1/2N5/PPPP1PP1/R1BQ2K1 b kq - 0 11';
const EX_2 = 'r2qk3/1pp2pp1/p1p5/2b1N3/4R1p1/2N5/PPPP1PP1/R1BQ3K b q - 0 12';
const EX_3 = 'r3k3/1pp2pp1/p1p5/2b1N3/4R1pq/2N5/PPPP1PP1/R1BQ2K1 b q - 2 13';
const EX_4 = 'r3k3/1pp2pp1/p1p5/2b1N3/4R1p1/2N5/PPPP1qPK/R1BQ4 b q - 1 14';
const QB_1 = '2k4r/pp3R2/2p5/3p4/3qp3/P7/1PP5/1K3Q2 w - - 2 35';
const QB_2 = '1k5r/pp3R2/2p5/3p1Q2/3qp3/P7/1PP5/1K6 w - - 4 36';
const QB_3 = 'k6r/pp3R2/2p5/3p4/3qpQ2/P7/1PP5/1K6 w - - 6 37';

// ---- Lesson 2: Poslední řada a přetížení — Lichess puzzles 0NL4m and BWB2K -----------------
const BR_1 = '1r3rk1/1R3ppp/p1p5/3nP3/8/P4Q1B/2q2PPP/5RK1 w - - 1 21';
const BR_2 = '1r4k1/1R3rpp/p1p5/3nP3/8/P6B/2q2PPP/5RK1 w - - 0 22';
const BR_3 = '1R3rk1/6pp/p1p5/3nP3/8/P6B/2q2PPP/5RK1 w - - 1 23';
const BR_4 = '1R3r1k/6pp/p1p1B3/3nP3/8/P7/2q2PPP/5RK1 w - - 3 24';
const OV_1 = '3Rnrk1/1p3ppp/2p5/5NQ1/2b5/6P1/5P1P/4qBK1 w - - 6 29';
const OV_2 = '3R1rk1/1p3pnp/2p5/5N2/2b5/6P1/5P1P/4qBK1 w - - 0 30';

// ---- Lesson 4: Rétiho studie (1921) — tablebase: every white move below is the only draw ----
const RETI_START = '7K/8/k1P5/7p/8/8/8/8 w - - 0 1';
const RETI_H4 = '8/6K1/k1P5/8/7p/8/8/8 w - - 0 2';
const RETI_KB6 = '8/8/1kP2K2/8/7p/8/8/8 w - - 2 3';
const RETI_KE5 = '8/8/1kP5/4K3/7p/8/8/8 b - - 3 3';
const RETI_H3 = '8/8/1kP5/4K3/8/7p/8/8 w - - 0 4';

// ---- Lesson 5: Lasker–Reichhelm (1901) — nine pieces, Stockfish depth 24 -------------------
const LR_START = '8/k7/3p4/p2P1p2/P2P1P2/8/8/K7 w - - 0 1';
const LR_KB7 = '8/1k6/3p4/p2P1p2/P2P1P2/8/8/1K6 w - - 2 2';

// ---- Lesson 6: Saavedrova pozice — tablebase ------------------------------------------------
// 1.c7 Vd6+ 2.Kb5 Vd5+ 3.Kb4 Vd4+ 4.Kb3 Vd3+ 5.Kc2 Vd4 6.c8V Va4 7.Kb3. At move 6 Kb3 and Kc3
// win too (slower); the task restricts the move to the pawn. c8D draws (Vc4+ Dxc4 pat),
// c8S / c8J lose (Vc4+ skewers the king and the new piece).
const SAAV_START = '8/8/1KP5/3r4/8/8/8/k7 w - - 0 1';
const SAAV_CHECK = '8/2P5/1K1r4/8/8/8/8/k7 w - - 1 2';
const SAAV_KC2 = '8/2P5/8/8/8/1K1r4/8/k7 w - - 7 5';
const SAAV_RD4 = '8/2P5/8/8/3r4/8/2K5/k7 w - - 9 6';
const SAAV_STALEMATE = '8/8/8/8/2Q5/8/2K5/k7 b - - 0 2';
const SAAV_RA4 = '2R5/8/8/8/r7/8/2K5/k7 w - - 1 7';

// ---- Lesson 7: Vančurova pozice — tablebase ------------------------------------------------
/** The Wikipedia diagram (white to move): every white move draws. */
const VANCURA = 'R7/6k1/P4r2/8/2K5/8/8/8 w - - 0 1';
/** Black to move: only Vf6 and Vf4+ draw; Va1 (behind the pawn) loses here. */
const VANCURA_BUILD = 'R7/6k1/P7/8/1K6/8/8/5r2 b - - 0 1';
/** The white king came to b5: only Vf5+ draws. */
const VANCURA_KB5 = 'R7/6k1/P4r2/1K6/8/8/8/8 b - - 0 1';
/** The pawn on a7, the black rook behind it: draw. */
const VANCURA_A7 = 'R7/P5k1/8/8/8/2K5/8/r7 w - - 0 1';

// ---- Lesson 8: Jezdec a střelec proti pěšci — tablebase -------------------------------------
/** Every bishop move draws; only Sd3 guards b1 at once. */
const BISHOP_PAWN = '7K/8/8/8/8/kp6/8/5B2 w - - 0 1';
/** Black wins: the knight cannot reach a square that guards a1 in time. */
const KNIGHT_TOO_LATE = '7K/8/8/8/8/8/pk6/5N2 w - - 0 1';
/** Only Jd2 and Je3 draw (everything else, the king moves too, loses). */
const KNIGHT_IN_TIME = '7K/8/8/8/8/p7/8/5N1k w - - 0 1';

// ---- Lesson 12: Vzájemná nevýhoda tahu — the trébuchet, tablebase ---------------------------
const TREBUCHET_W = '8/8/8/2Kp4/3Pk3/8/8/8 w - - 0 1';
const TREBUCHET_B = '8/8/8/2Kp4/3Pk3/8/8/8 b - - 0 1';
/** Only Kc5 wins (it reaches the trébuchet with black to move); every other move loses. */
const TREBUCHET_REACH = '8/8/2K5/3p4/3Pk3/8/8/8 w - - 0 1';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LEVEL6: readonly Lesson[] = [
  // plan lesson 1: Propočet: mat 4. tahem
  {
    id: 'l6-mat4',
    level: 6,
    number: 1,
    title: 'Mat 4. tahem',
    steps: [
      {
        // Lichess puzzle EXtqO, after 11.Vxe4.
        id: 'idea',
        kind: 'show',
        fen: EX_1,
        orientation: 'black',
        text: 'Mat 4. tahem se nedá uhodnout. Prober kandidátní tahy: šachy, braní, hrozby. Každý propočítej až do konce.',
      },
      {
        id: 'ex1',
        kind: 'move',
        fen: EX_1,
        orientation: 'black',
        accept: ['h8h1'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé a dáš mat 4. tahem. Obětuj věž na h1 se šachem. Vlákej bílého krále na otevřený sloupec h.',
        success: 'Výborně! Oběť věže. Bílý musí vzít: Kxh1.',
        wrongDefault: 'Tohle mat nedá. Hledej šach, po kterém se bílý král dostane na otevřený sloupec h.',
      },
      {
        id: 'ex2',
        kind: 'move',
        fen: EX_2,
        orientation: 'black',
        accept: ['d8h4'],
        completeness: { kind: 'best' },
        text: 'Král vzal věž. Pokračuj dalším šachem.',
        success: 'Šach! Král musí zpátky na g1.',
        wrongDefault: 'Bez šachu bílý utíká. Šachuj dámou po sloupci h.',
      },
      {
        id: 'ex3',
        kind: 'move',
        fen: EX_3,
        orientation: 'black',
        accept: ['h4f2'],
        completeness: { kind: 'best' },
        text: 'Král ustoupil na g1. Najdi další šach, který něco bere.',
        success: 'Výborně! Král ustoupil na h2.',
        wrongDefault: 'Hledej šach dámou, který zároveň bere pěšce.',
      },
      {
        id: 'ex4',
        kind: 'move',
        fen: EX_4,
        orientation: 'black',
        accept: ['f2h4'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Mat 4. tahem! Pole g1 hlídá střelec c5.',
        wrongDefault: 'Tohle mat není. Kam dáma dosáhne, aby král neměl kam?',
      },
      {
        // Lichess puzzle 7DNoH, after 34...Kc8.
        id: 'queen-1',
        kind: 'move',
        fen: QB_1,
        accept: ['f1f5'],
        completeness: { kind: 'best' },
        text: 'Teď hraješ za bílé. Mat 4. tahem, začni šachem dámou.',
        success: 'Šach! Černý král ustoupil na b8.',
        wrongDefault: 'Tohle nevyjde. Prober šachy dámou. Který nepustí krále pryč?',
      },
      {
        id: 'queen-2',
        kind: 'move',
        fen: QB_2,
        accept: ['f5f4'],
        completeness: { kind: 'best' },
        text: 'Šachuj dál.',
        success: 'Šach po úhlopříčce! Černý král ustoupil do rohu a8.',
        wrongDefault: 'Hledej šach dámou po úhlopříčce k b8.',
      },
      {
        id: 'queen-3',
        kind: 'move',
        fen: QB_3,
        accept: ['f7f8'],
        completeness: { kind: 'best' },
        text: 'Král je v rohu. Obětuj věž.',
        success: 'Výborně! Po Vxf8 dá dáma mat na f8.',
        wrongDefault: 'Věž f7 se obětuje na f8. Po Vxf8 dáma vezme a dá mat.',
      },
    ],
    outro: 'U matu 4. tahem prober všechny šachy a každý propočítej do konce. Oběť často otevře cestu.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'mateIn4', count: 5, label: 'Úlohy: mat 4. tahem' }],
  },

  // plan lesson 2: Kombinace na poslední řadu a přetížení (pokročilé)
  {
    id: 'l6-posledni-rada',
    level: 6,
    number: 2,
    title: 'Poslední řada a přetížení',
    steps: [
      {
        // Lichess puzzle 0NL4m, after 20...Vab8.
        id: 'idea',
        kind: 'show',
        fen: BR_1,
        shapes: [
          { from: 'f8', to: 'b8', brush: 'red' },
          { from: 'f8', to: 'f7', brush: 'red' },
        ],
        text: 'Věž f8 má dva úkoly. Kryje věž b8 a pěšce f7. Obojí najednou nezvládne.',
      },
      {
        id: 'br1',
        kind: 'move',
        fen: BR_1,
        accept: ['f3f7'],
        completeness: { kind: 'best' },
        text: 'Odlákej věž f8 od věže b8. Obětuj dámu.',
        success: 'Výborně! Černý musí vzít Vxf7. Věž b8 zůstala bez obrany.',
        wrongDefault: 'Dáma se obětuje na f7 se šachem. Věž f8 ji musí vzít.',
      },
      {
        id: 'br2',
        kind: 'move',
        fen: BR_2,
        accept: ['b7b8'],
        completeness: { kind: 'best' },
        text: 'Věž b8 už nikdo nekryje.',
        success: 'Šach! Černý se kryje věží: Vf8.',
        wrongDefault: 'Vezmi věž b8 se šachem.',
      },
      {
        id: 'br3',
        kind: 'move',
        fen: BR_3,
        accept: ['h3e6'],
        completeness: { kind: 'best' },
        text: 'Věž f8 je vázaná ke králi. Dej šach střelcem.',
        success: 'Šach! Věž na f7 zakrýt nesmí. Král musí do rohu.',
        wrongDefault: 'Střelec h3 může šachovat po úhlopříčce k g8.',
      },
      {
        id: 'br4',
        kind: 'move',
        fen: BR_4,
        accept: ['b8f8'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Mat na poslední řadě! Pole g8 hlídá střelec e6.',
        wrongDefault: 'Tohle mat není. Věž f8 je pořád vázaná. Vezmi ji.',
      },
      {
        // Lichess puzzle BWB2K, after black's 28th move (Sb3-c4).
        id: 'overload',
        kind: 'show',
        fen: OV_1,
        shapes: [
          { from: 'e8', to: 'g7', brush: 'red' },
          { from: 'd8', to: 'f8', brush: 'blue' },
        ],
        text: 'Jezdec e8 hlídá pole g7. Zároveň zavírá věži d8 cestu po poslední řadě.',
      },
      {
        id: 'ov1',
        kind: 'move',
        fen: OV_1,
        accept: ['g5g7'],
        completeness: { kind: 'best' },
        text: 'Přetiž jezdce e8. Obětuj dámu.',
        success: 'Výborně! Jezdec vzal na g7 a poslední řada je otevřená.',
        wrongDefault: 'Dáma se obětuje na g7. Jezdec ji musí vzít a opustí e8.',
      },
      {
        id: 'ov2',
        kind: 'move',
        fen: OV_2,
        accept: ['f5h6'],
        completeness: { kind: 'best' },
        text: 'Teď šach jezdcem. Pak mat na poslední řadě.',
        success: 'Výborně! Po Kh8 přijde Vxf8 mat.',
        wrongDefault: 'Šachuj jezdcem z h6. Král musí do rohu a pak věž dá mat.',
      },
    ],
    outro: 'Hledej obránce s dvěma úkoly. Obětí ho odlákej a poslední řada se otevře.',
    practice: [
      { kind: 'puzzles', band: 'tezsi', theme: 'backRankMate', count: 5, label: 'Úlohy: mat na poslední řadě' },
      { kind: 'puzzles', band: 'tezsi', theme: 'deflection', count: 5, label: 'Úlohy: odlákání' },
    ],
  },

  // Owner's follow-up (2026-09-28): key squares of 5th/6th-rank pawns and of the rook pawn.
  // Key squares below are computed by scripts/kpk.mjs (`keysquares`) and the move tasks by the
  // tablebase: e5 → d6 e6 f6 d7 e7 f7; d6 → c7 d7 e7 c8 d8 e8; the b- and g-pawn on the
  // 6th rank have only four (b6 → a7 b7 a8 b8: with the king on c7/c8 a stalemate saves black).
  {
    id: 'l6-klicova-pole',
    level: 6,
    number: 3,
    title: 'Klíčová pole II: pokročilý a krajní pěšec',
    steps: [
      {
        id: 'fifth',
        kind: 'show',
        fen: '7k/8/8/4P3/8/8/8/K7 w - - 0 1',
        shapes: [
          { from: 'd6', brush: 'green' },
          { from: 'e6', brush: 'green' },
          { from: 'f6', brush: 'green' },
          { from: 'd7', brush: 'green' },
          { from: 'e7', brush: 'green' },
          { from: 'f7', brush: 'green' },
        ],
        text: 'Pěšec na páté řadě má klíčových polí šest. Tři hned před sebou a tři o řadu dál.',
      },
      {
        id: 'which-fifth',
        kind: 'choose',
        fen: '7k/8/8/3P4/8/8/8/K7 w - - 0 1',
        text: 'Které z těch polí je klíčové pro pěšce d5?',
        options: [
          { id: 'c7', square: 'c7' },
          { id: 'c4', square: 'c4' },
          { id: 'd8', square: 'd8' },
        ],
        correct: ['c7'],
        explain: 'Ano! Pěšec d5 má klíčová pole c6, d6, e6 a c7, d7, e7.',
        wrongExplain: {
          c4: 'To je za pěšcem. Klíčová pole leží před ním.',
          d8: 'To je moc daleko. Klíčová pole jsou na šesté a sedmé řadě.',
        },
        wrongDefault: 'Klíčová pole leží na dvou řadách před pěšcem.',
        verify: { kind: 'keysquares' },
      },
      {
        // Tablebase: only Kd6 and Ke6 win.
        id: 'step-in',
        kind: 'move',
        fen: '4k3/8/8/3KP3/8/8/8/8 w - - 0 1',
        accept: ['d5d6', 'd5e6'],
        completeness: { kind: 'tablebase' },
        text: 'Postav krále na klíčové pole. Vyhraješ.',
        success: 'Výborně! Tvůj král stojí na klíčovém poli. Černý ho odtud nevyžene.',
        wrong: { e5e6: 'Pěšec spěchá a král zůstal pozadu. To je jen remíza.' },
        wrongDefault: 'Tenhle tah výhru pustí. Klíčová pole jsou d6, e6, f6, d7, e7 a f7.',
      },
      {
        // Tablebase: white to move wins (Kd6 / Kf6).
        id: 'no-opposition',
        kind: 'choose',
        fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
        text: 'Opozici tu má černý a na tahu jsi ty. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['bily'],
        explain: 'Bílý vyhraje. Král stojí na klíčovém poli e6, a tak na opozici nezáleží.',
        wrongDefault: 'Pole e6 je klíčové pole pěšce e5. Král na něm vyhraje, i když je na tahu.',
        verify: { kind: 'outcome' },
      },
      {
        id: 'sixth',
        kind: 'show',
        fen: '7k/8/3P4/8/8/8/8/K7 w - - 0 1',
        shapes: [
          { from: 'c7', brush: 'green' },
          { from: 'd7', brush: 'green' },
          { from: 'e7', brush: 'green' },
          { from: 'c8', brush: 'green' },
          { from: 'd8', brush: 'green' },
          { from: 'e8', brush: 'green' },
        ],
        text: 'Pěšec na šesté řadě má klíčová pole na sedmé a osmé řadě. U pěšce b6 jsou jen čtyři: a7, b7, a8, b8. Z c7 nebo c8 by po Ka8 byl pat.',
      },
      {
        // Tablebase: only Ke7 wins; d7+ Kd8 is a draw.
        id: 'sixth-move',
        kind: 'move',
        fen: '2k5/8/3PK3/8/8/8/8/8 w - - 0 1',
        accept: ['e6e7'],
        completeness: { kind: 'tablebase' },
        text: 'Pěšec stojí na d6. Najdi jediný vyhrávající tah.',
        success: 'Výborně! Král na e7 stojí na klíčovém poli. Pěšec teď dojde až do dámy.',
        wrong: { d6d7: 'Po d7+ se černý král postaví před pěšce. To je jen remíza.' },
        wrongDefault: 'Tenhle tah výhru pustí. Vstup králem na klíčové pole.',
      },
      {
        // Tablebase: draw with white to move.
        id: 'rook-pawn-draw',
        kind: 'choose',
        fen: 'k7/8/1K6/P7/8/8/8/8 w - - 0 1',
        text: 'Krajní pěšec je výjimka. Černý král stojí v rohu před pěšcem. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['remiza'],
        explain: 'Remíza. Černého krále z rohu nevyženeš a pěšec neprojde bez patu.',
        wrongDefault: 'Černý král z rohu neodejde. Pěšec neprojde, aniž by byl černý v patu.',
        verify: { kind: 'outcome' },
      },
      {
        // Tablebase: only Kb7 wins.
        id: 'rook-pawn-key',
        kind: 'move',
        fen: '8/3k4/K7/P7/8/8/8/8 w - - 0 1',
        accept: ['a6b7'],
        completeness: { kind: 'tablebase' },
        text: 'Klíčová pole krajního pěšce a jsou b7 a b8. Platí to, když černý král pěšce nesebere ani nestojí před ním. Zavři ho dřív, než doběhne do rohu.',
        success: 'Výborně! Černý král už k rohu nesmí. Pěšec dojde do dámy.',
        wrong: { a6b6: 'Černý král doběhne na c8 a pole b7 a b8 ti zavře. Remíza.' },
        wrongDefault: 'Tenhle tah výhru pustí. Tvůj král musí hned na b7.',
      },
    ],
    outro: 'Pěšec na páté a šesté řadě má šest klíčových polí. Pěšec b nebo g na šesté řadě jen čtyři. Krajní pěšec je výjimka. Pěšec a má klíčová pole b7 a b8, pěšec h pole g7 a g8.',
    practice: [
      { kind: 'endgame', id: 'kral-pesec-1', label: 'Koncovky: král a pěšec 1/7' },
      { kind: 'endgame', id: 'kp-win', label: 'Koncovky: král a pěšec 3/7' },
    ],
  },

  // plan lesson 3: Rétiho studie (1921)
  {
    id: 'l6-reti',
    level: 6,
    number: 4,
    title: 'Rétiho studie',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: RETI_START,
        text: 'Slavná studie Richarda Rétiho z roku 1921. Zdá se, že bílý král nestihne pěšce h5 ani pomoct pěšci c6. Přesto bílý udrží remízu.',
      },
      {
        id: 'diagonal',
        kind: 'move',
        fen: RETI_START,
        accept: ['h8g7'],
        completeness: { kind: 'tablebase' },
        text: 'Tah králem může jít za dvěma cíli najednou. Najdi jediný tah, který remízu drží.',
        success: 'Výborně! Král jde po úhlopříčce. Blíží se k pěšci h5 i ke svému pěšci c6.',
        wrongDefault: 'Tenhle tah prohrává. Hledej krok, který krále přiblíží k oběma pěšcům.',
      },
      {
        id: 'f6',
        kind: 'move',
        fen: RETI_H4,
        accept: ['g7f6'],
        completeness: { kind: 'tablebase' },
        text: 'Černý pěšec utíká na h4. Pokračuj.',
        success: 'Výborně! Král zůstal na úhlopříčce.',
        wrongDefault: 'Tenhle tah prohrává. Jdi dál po úhlopříčce ke středu.',
      },
      {
        id: 'e5',
        kind: 'move',
        fen: RETI_KB6,
        accept: ['f6e5'],
        completeness: { kind: 'tablebase' },
        text: 'Černý král jde po pěšci c6. Najdi jediný tah, který remízu drží.',
        success: 'Výborně! Z pole e5 dosáhneš na obě strany.',
        wrongDefault: 'Tenhle tah prohrává. Z úhlopříčky nesmíš sejít.',
      },
      {
        id: 'choice',
        kind: 'show',
        fen: RETI_KE5,
        shapes: [
          { from: 'e5', to: 'f4', brush: 'blue' },
          { from: 'e5', to: 'd6', brush: 'blue' },
        ],
        text: 'Když černý vezme Kxc6, chytí tvůj král pěšce: Kf4. Když pěšec postoupí, podpoříš svého pěšce.',
      },
      {
        id: 'd6',
        kind: 'move',
        fen: RETI_H3,
        accept: ['e5d6'],
        completeness: { kind: 'tablebase' },
        text: 'Černý zahrál h3. Podpoř svého pěšce.',
        success: 'Výborně! Po h2 c7 Kb7 Kd7 se promění oba pěšci. Remíza.',
        wrongDefault: 'Pěšce h už nechytíš. Postav krále vedle pěšce c6, ať se promění.',
      },
    ],
    outro: 'Rétiho studie: jeden tah králem může sloužit dvěma cílům. Po úhlopříčce dojde král stejně rychle jako rovně.',
    practice: [{ kind: 'endgame', id: 'ctverec-6', label: 'Koncovky: pravidlo čtverce 6/7' }],
  },

  // plan lesson 4: Lasker–Reichhelm 1901 (korespondující pole)
  {
    id: 'l6-korespondujici-pole',
    level: 6,
    number: 5,
    title: 'Korespondující pole',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: LR_START,
        text: 'Emanuel Lasker a Gustavus Reichhelm, 1901. Všichni pěšci jsou zablokovaní. Rozhodují jen králové.',
      },
      {
        id: 'plan',
        kind: 'show',
        fen: LR_START,
        shapes: [
          { from: 'a5', brush: 'red' },
          { from: 'f5', brush: 'red' },
          { from: 'c4', to: 'b5', brush: 'blue' },
        ],
        text: 'Bílý král chce k pěšci a5 přes c4 a b5. Nebo na druhé křídlo k pěšci f5. Černý král musí hlídat obě cesty.',
      },
      {
        id: 'kb1',
        kind: 'move',
        fen: LR_START,
        accept: ['a1b1'],
        completeness: { kind: 'best', marginCp: 100, depth: 24 },
        text: 'Jen jeden tah vyhraje, ostatní vedou k remíze. Najdi ho.',
        success: 'Výborně! Kb1 je jediný vyhrávající tah. Černý odpověděl Kb7.',
        wrongDefault: 'Tohle je jen remíza. Tady rozhoduje přesné pole. Zkus krok po první řadě doprava.',
      },
      {
        id: 'kc1',
        kind: 'move',
        fen: LR_KB7,
        accept: ['b1c1'],
        completeness: { kind: 'best', marginCp: 100, depth: 24 },
        text: 'Černý král stojí na b7. Zase vyhraje jen jeden tah.',
        success: 'Výborně! Na b7 černého patří bílý král na c1.',
        wrongDefault: 'Tohle je jen remíza. Postup o jedno pole doprava.',
      },
      {
        id: 'pairs',
        kind: 'show',
        fen: LR_KB7,
        text: 'Každému poli černého krále odpovídá správné pole bílého krále. Tomu se říká korespondující pole.',
      },
      {
        id: 'why',
        kind: 'show',
        fen: LR_KB7,
        text: 'Bílý vždy vstoupí na pole, které odpovídá černému. Černý tak nakonec musí táhnout jinam, než chce. Je to jako u trojúhelníku v úrovni 4. Pak pustí bílého krále k pěšci.',
      },
    ],
    outro: 'Korespondující pole: na každý tah černého krále má bílý jedno správné pole. Opozice je jejich nejjednodušší případ.',
    practice: [{ kind: 'endgame', id: 'kral-pesec-6', label: 'Koncovky: král a pěšec 6/7' }],
  },

  // plan lesson 5: Saavedrova pozice (podproměna)
  {
    id: 'l6-saavedra',
    level: 6,
    number: 6,
    title: 'Saavedrova pozice',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: SAAV_START,
        text: 'Nejslavnější studie s podproměnou. Španělský kněz Fernando Saavedra v ní roku 1895 našel výhru.',
      },
      {
        id: 'c7',
        kind: 'move',
        fen: SAAV_START,
        accept: ['c6c7'],
        completeness: { kind: 'tablebase' },
        text: 'Najdi jediný vyhrávající tah.',
        success: 'Výborně! Pěšec hrozí proměnou. Černá věž začne šachovat.',
        wrongDefault: 'Tenhle tah vede jen k remíze. Pěšec musí hned dopředu.',
      },
      {
        id: 'checks',
        kind: 'show',
        fen: SAAV_CHECK,
        shapes: [{ from: 'b6', to: 'b3', brush: 'blue' }],
        text: 'Černý šachuje: Vd6+. Bílý král jde po sloupci b dolů: Kb5, Kb4 a Kb3.',
      },
      {
        id: 'kc2',
        kind: 'move',
        fen: SAAV_KC2,
        accept: ['b3c2'],
        completeness: { kind: 'tablebase' },
        text: 'Po Vd3+ vyhraje jen jeden tah. Najdi ho.',
        success: 'Výborně! Král se přiblížil a napadá věž d3.',
        wrongDefault: 'Tenhle tah vede jen k remíze. Přibliž se králem k věži.',
      },
      {
        id: 'trick',
        kind: 'choose',
        fen: SAAV_STALEMATE,
        text: 'Černý zahrál Vd4! Po proměně v dámu přijde Vc4+ a Dxc4. Co je to za pozici?',
        options: [
          { id: 'sach', label: 'Šach' },
          { id: 'mat', label: 'Mat' },
          { id: 'pat', label: 'Pat' },
          { id: 'nic', label: 'Nic z toho' },
        ],
        correct: ['pat'],
        explain: 'Pat! Černý král nemá žádný tah. S dámou je to jen remíza.',
        wrongDefault: 'Černý král není v šachu. Má ale vůbec nějaký tah?',
        verify: { kind: 'state' },
      },
      {
        id: 'rook',
        kind: 'move',
        fen: SAAV_RD4,
        movable: ['c7'],
        accept: ['c7c8r'],
        completeness: { kind: 'promote', from: 'c7', to: 'c8', piece: 'r' },
        text: 'Pěšec se teď promění. Vyber figuru, se kterou vyhraješ.',
        success: 'Věž! Hrozí Va8 mat. A pat po Vc4+ už nehrozí.',
        wrong: {
          c7c8q: 'Po Vc4+ Dxc4 je pat. Dáma dá jen remízu.',
          c7c8b: 'Po Vc4+ věž sebere střelce na c8. To prohrává.',
          c7c8n: 'Po Vc4+ věž sebere jezdce na c8. To prohrává.',
        },
        wrongDefault: 'Proměň pěšce ve věž. Dáma by po Vc4+ Dxc4 dala pat.',
        tbNarrow: 'Only the pawn may move (Kb3 and Kc3 win too, more slowly).',
      },
      {
        id: 'ra4',
        kind: 'show',
        fen: SAAV_RA4,
        shapes: [{ from: 'c8', to: 'a8', brush: 'red' }],
        text: 'Černý se před matem Va8 kryje: Va4. Teď přijde poslední tah.',
      },
      {
        id: 'kb3',
        kind: 'move',
        fen: SAAV_RA4,
        accept: ['c2b3'],
        completeness: { kind: 'tablebase' },
        text: 'Najdi jediný vyhrávající tah.',
        success: 'Výborně! Napadáš věž a hrozíš Vc1 mat. Černý přijde o věž, nebo dostane mat.',
        wrongDefault: 'Tenhle tah vede jen k remíze. Napadni králem věž a4.',
      },
    ],
    outro: 'Podproměna: někdy je věž lepší než dáma. Než proměníš, zkontroluj, jestli nehrozí pat.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'promotion', count: 2, label: 'Úlohy: proměna' }],
  },

  // plan lesson 6: Vančurova pozice (Czech heritage)
  {
    id: 'l6-vancura',
    level: 6,
    number: 7,
    title: 'Vančurova pozice',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: VANCURA,
        text: 'Věž a krajní pěšec proti věži. Bílá věž stojí před pěšcem na a8. Bílý má pěšce navíc.',
      },
      {
        id: 'outcome',
        kind: 'choose',
        fen: VANCURA,
        text: 'Na tahu je bílý. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['remiza'],
        explain: 'Remíza! Černý se ubrání, i když má o pěšce méně.',
        wrongDefault: 'Bílý pěšce navíc má, ale nevyhraje. Podívej se, co dělá černá věž.',
        verify: { kind: 'outcome' },
      },
      {
        id: 'why',
        kind: 'show',
        fen: VANCURA,
        shapes: [
          { from: 'f6', to: 'a6', brush: 'red' },
          { from: 'a8', brush: 'blue' },
        ],
        text: 'Černá věž napadá pěšce ze strany. Bílá věž ho musí krýt a z a8 neodejde. Když se přiblíží bílý král, černá věž ho šachuje.',
      },
      {
        id: 'name',
        kind: 'show',
        fen: VANCURA,
        text: 'Tomu se říká Vančurova pozice. Objevil ji český skladatel šachových studií Josef Vančura. Vyšla v roce 1924.',
      },
      {
        // Tablebase: Vf6 and Vf4+ draw; everything else, Va1 too, loses.
        id: 'build',
        kind: 'move',
        fen: VANCURA_BUILD,
        orientation: 'black',
        movable: ['f1'],
        accept: ['f1f6'],
        completeness: { kind: 'lands', square: 'f6', from: 'f1' },
        text: 'Hraješ za černé. Postav věž do Vančurovy pozice.',
        success: 'Výborně! Věž napadá pěšce a6 ze strany.',
        wrong: {
          f1f4: 'I šach drží remízu, ale věž patří na šestou řadu. Zkus f6.',
          f1a1: 'Tady věž za pěšcem nestačí. Pěšec je teprve na a6 a bílý král mu dojde pomoct. U krajního pěšce má Tarraschovo pravidlo výjimku.',
        },
        wrongDefault: 'Věž má napadnout pěšce a6 ze strany, po šesté řadě.',
      },
      {
        // Tablebase: only Vf5+ draws.
        id: 'check',
        kind: 'move',
        fen: VANCURA_KB5,
        orientation: 'black',
        accept: ['f6f5'],
        completeness: { kind: 'tablebase' },
        text: 'Bílý král se přiblížil na b5. Jen jeden tah drží remízu.',
        success: 'Šach ze strany! Když bílý král uteče k věži, vezmeš pěšce a6.',
        wrong: { f6b6: 'Po Vb6+ vezme král věž: Kxb6.' },
        wrongDefault: 'Tenhle tah prohrává. Šachuj bílého krále ze strany.',
      },
      {
        id: 'pawn-a7',
        kind: 'show',
        fen: VANCURA_A7,
        shapes: [{ from: 'a1', to: 'a7', brush: 'red' }],
        text: 'Když pěšec dojde na a7, jde černá věž za něj na sloupec a. Černý král musí zůstat na g7 nebo h7. Z f7 by přišel trik Vh8 a po Vxa7 šach Vh7+.',
      },
    ],
    outro: 'Vančurova pozice: věž napadá krajního pěšce ze strany a šachuje krále, když se přiblíží.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'rookEndgame', count: 5, label: 'Úlohy: věžová koncovka' }],
  },

  // plan lesson 7: Jezdec a střelec proti pěšci
  {
    id: 'l6-lehka-figura-pesec',
    level: 6,
    number: 8,
    title: 'Jezdec nebo střelec proti pěšci',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: BISHOP_PAWN,
        text: 'Jezdec nebo střelec sám mat nedá. Když ale zastaví pěšce, je to remíza.',
      },
      {
        // Tablebase: every bishop move draws; the task asks to guard b1 now.
        id: 'bishop',
        kind: 'move',
        fen: BISHOP_PAWN,
        movable: ['f1'],
        accept: ['f1d3'],
        completeness: { kind: 'lands', square: 'd3', from: 'f1' },
        text: 'Pěšec b3 míří na b1. Postav střelce tak, aby pole b1 hlídal.',
        success: 'Výborně! Když pěšec vstoupí na b1, střelec ho vezme.',
        wrongDefault: 'Tohle pole b1 nehlídá. Hledej úhlopříčku, která vede přes b1.',
        tbNarrow: 'The task asks to guard b1 now; every bishop move draws (the bishop gets there later).',
      },
      {
        id: 'knight-slow',
        kind: 'show',
        fen: KNIGHT_TOO_LATE,
        text: 'Jezdec je pomalejší. Na vzdálené pole potřebuje několik skoků.',
      },
      {
        // Tablebase: black wins.
        id: 'knight-late',
        kind: 'choose',
        fen: KNIGHT_TOO_LATE,
        text: 'Pěšec a2 je před proměnou a kryje ho král. Bílý je na tahu. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['cerny'],
        explain: 'Černý vyhraje. Jezdec za jeden tah pole a1 neohlídá a pěšec se promění.',
        wrongDefault: 'Pole a1 hlídá jezdec jen z b3 nebo c2. Tam za jeden tah nedoskočí.',
        verify: { kind: 'outcome' },
      },
      {
        // Tablebase: only Jd2 and Je3 draw.
        id: 'knight-stop',
        kind: 'move',
        fen: KNIGHT_IN_TIME,
        accept: ['f1d2', 'f1e3'],
        completeness: { kind: 'tablebase' },
        text: 'Pěšec a3 běží na a1. Najdi tah jezdcem, který ho ještě zastaví.',
        success: 'Výborně! Příštím tahem jezdec ohlídá pole a1.',
        wrongDefault: 'Tenhle tah prohrává. Jezdec musí mířit k polím b3 nebo c2, odkud hlídá a1.',
      },
      {
        id: 'rook-pawn',
        kind: 'show',
        fen: KNIGHT_IN_TIME,
        shapes: [{ from: 'a1', brush: 'red' }],
        text: 'Nejtěžší je pro jezdce krajní pěšec. Na kraji šachovnice jezdec hlídá málo polí.',
      },
    ],
    outro: 'Střelci stačí hlídat jedno pole na cestě pěšce. Soupeřův král mu ale může úhlopříčku zastoupit. Jezdec to má těžší, hlavně proti krajnímu pěšci.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'knightEndgame', count: 3, label: 'Úlohy: jezdcová koncovka' }],
  },

  // plan lesson 8: Mat střelcem a jezdcem (`kbn`)
  {
    id: 'l6-mat-sj',
    level: 6,
    number: 9,
    title: 'Mat střelcem a jezdcem',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1',
        text: 'Mat střelcem a jezdcem je nejtěžší základní mat. Vynutit se dá jen v rohu, který má barvu tvého střelce.',
      },
      {
        id: 'corner',
        kind: 'choose',
        fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1',
        text: 'Střelec f1 chodí po světlých polích. Do kterého rohu musíš černého krále zahnat?',
        options: [
          { id: 'a1', square: 'a1' },
          { id: 'a8', square: 'a8' },
          { id: 'h1', square: 'h1' },
          { id: 'h8', square: 'h8' },
        ],
        correct: ['a8', 'h1'],
        explain: 'Ano! Rohy a8 a h1 jsou světlé, stejně jako pole tvého střelce.',
        wrongDefault: 'Tenhle roh je tmavý. Tvůj střelec chodí po světlých polích.',
      },
      {
        id: 'plan',
        kind: 'show',
        fen: '4k3/8/8/8/8/8/8/4KBN1 w - - 0 1',
        text: 'Nejdřív zatlač krále na kraj. Pak ho po kraji veď do správného rohu. Tvůj král pomáhá zblízka.',
      },
      {
        id: 'mate-h1',
        kind: 'move',
        fen: '8/8/8/8/8/3B2K1/4N3/7k w - - 0 1',
        accept: ['d3e4'],
        completeness: { kind: 'mate' },
        text: 'Černý král je ve správném rohu. Dej mat.',
        success: 'Mat! Střelec šachuje, jezdec hlídá g1 a král hlídá g2 a h2.',
        wrongDefault: 'Tohle mat není. Šachuj střelcem po dlouhé úhlopříčce.',
      },
      {
        id: 'mate-a8',
        kind: 'move',
        fen: 'k7/3N4/1K6/8/8/8/8/5B2 w - - 0 1',
        accept: ['f1g2'],
        completeness: { kind: 'mate' },
        text: 'A teď v druhém světlém rohu. Dej mat.',
        success: 'Mat! Jezdec hlídá b8, král hlídá a7 a b7.',
        wrongDefault: 'Tohle mat není. Střelec může šachovat po dlouhé úhlopříčce.',
      },
    ],
    outro: 'Mat střelcem a jezdcem: krále na kraj, pak do rohu barvy střelce. Trénuj ho v Koncovkách, chce to trpělivost.',
    practice: [
      { kind: 'endgame', id: 'strelec-jezdec-2', label: 'Koncovky: střelec a jezdec 2/7' },
      { kind: 'endgame', id: 'kbn', label: 'Koncovky: střelec a jezdec 7/7' },
    ],
  },

  // plan lesson 9: Obranný tah
  {
    id: 'l6-obranny-tah',
    level: 6,
    number: 10,
    title: 'Obranný tah',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: 'r3k2r/pp2bp1p/2BQbpq1/8/8/2P5/PP3PPP/RN2R1K1 b kq - 0 14',
        orientation: 'black',
        text: 'Obranný tah zastaví soupeřovu hrozbu. Nejdřív se zeptej, co soupeř chce. Pozor, přirozený tah může být chyba.',
      },
      {
        // Lichess puzzle UVsao, after 14.Sxc6+.
        id: 'king',
        kind: 'move',
        fen: 'r3k2r/pp2bp1p/2BQbpq1/8/8/2P5/PP3PPP/RN2R1K1 b kq - 0 14',
        orientation: 'black',
        accept: ['e8f8'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé a jsi v šachu. Najdi jediný dobrý tah.',
        success: 'Výborně! Král uhnul a černý stojí na výhru.',
        wrong: {
          b7c6: 'Po bxc6 přijde Dxc6+. Dáma napadne krále i věž a8.',
          e6d7: 'Po Sd7 dá bílý mat: Dxe7.',
        },
        wrongDefault: 'Tohle nevyjde. Vyber mezi braním, zakrytím a útěkem krále.',
      },
      {
        id: 'block-idea',
        kind: 'show',
        fen: 'rnb1kb1r/pp1ppppp/5n2/q3P3/8/5Q2/PB3PPP/RN2KBNR w KQkq - 1 7',
        text: 'Nejlepší obrana někdy sama útočí. Tady je bílý v šachu od dámy a5.',
      },
      {
        // Lichess puzzle GJnJJ, after 6...Da5+.
        id: 'block',
        kind: 'move',
        fen: 'rnb1kb1r/pp1ppppp/5n2/q3P3/8/5Q2/PB3PPP/RN2KBNR w KQkq - 1 7',
        accept: ['b2c3'],
        completeness: { kind: 'best' },
        text: 'Zakryj šach a zároveň napadni dámu.',
        success: 'Výborně! Dáma musí uhnout. Pak pěšec e5 vezme jezdce f6.',
        wrong: {
          b1c3: 'Jezdec šach zakryje, ale dámu nenapadne. Černý pak zachrání jezdce f6.',
          f3c3: 'Dáma šach zakryje, ale po Dxc3 ztratíš výhodu.',
        },
        wrongDefault: 'Tohle nevyjde. Zakryj šach figurou, která napadne dámu a5.',
      },
      {
        id: 'result',
        kind: 'show',
        fen: 'rnb1kb1r/pp1ppppp/5n2/3qP3/8/2B2Q2/P4PPP/RN2KBNR w KQkq - 3 8',
        shapes: [{ from: 'e5', to: 'f6', brush: 'green' }],
        text: 'Dáma uhnula na d5. Teď exf6 a bílý má figuru navíc.',
      },
    ],
    outro: 'Obranný tah: zjisti, co soupeř hrozí. Pak hledej obranu, nejlépe takovou, která sama útočí.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'defensiveMove', count: 5, label: 'Úlohy: obranný tah' }],
  },

  // plan lesson 10: Chycená figura a tichý tah (pokročilé)
  {
    id: 'l6-chycena-figurka',
    level: 6,
    number: 11,
    title: 'Chycená figurka II',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: '4r1k1/1pp2p2/p2p2p1/4r3/4P3/4Q1R1/PPP4q/2K3R1 w - - 2 26',
        shapes: [{ from: 'h2', brush: 'red' }],
        text: 'I dáma se dá chytit. Najdi tichý tah: nedává šach, nic nebere a dámě vezme poslední útěk.',
      },
      {
        // Lichess puzzle 5hoOI, after 25...Vce8.
        id: 'rook',
        kind: 'move',
        fen: '4r1k1/1pp2p2/p2p2p1/4r3/4P3/4Q1R1/PPP4q/2K3R1 w - - 2 26',
        accept: ['g3h3'],
        completeness: { kind: 'best' },
        text: 'Černá dáma h2 má málo polí. Chyť ji.',
        success: 'Výborně! Dáma je napadená a nemá kam. Nejvýš ji dá za věž: Dxg1+ Dxg1.',
        wrongDefault: 'Hledej tah věží, který dámu napadne a zavře jí poslední pole.',
      },
      {
        id: 'rook-why',
        kind: 'show',
        fen: '4r1k1/1pp2p2/p2p2p1/4r3/4P3/4Q2R/PPP4q/2K3R1 b - - 3 26',
        shapes: [
          { from: 'g1', to: 'g3', brush: 'blue' },
          { from: 'e3', to: 'f2', brush: 'blue' },
        ],
        text: 'Pole h1, g2 a g3 hlídá věž g1. Pole f4, f2, e2, d2 a h3 hlídá dáma e3. Pěšce c2 kryje král.',
      },
      {
        // Lichess puzzle JqGpn, after 14...Je7.
        id: 'bishop',
        kind: 'move',
        fen: 'r3k2r/1p2nppp/p1n1p3/3pP3/8/Q4N2/1P2BPPP/1qB2RK1 w kq - 2 15',
        accept: ['e2d3'],
        completeness: { kind: 'best' },
        text: 'Černá dáma b1 vnikla do tvého tábora. Chyť ji tichým tahem.',
        success: 'Výborně! Střelec napadl dámu a hlídá pole c2. Dáma nemá kam.',
        wrongDefault: 'Hledej tah střelcem, který dámu napadne a vezme jí pole c2.',
      },
      {
        id: 'bishop-why',
        kind: 'show',
        fen: 'r3k2r/1p2nppp/p1n1p3/3pP3/8/Q2B1N2/1P3PPP/1qB2RK1 b kq - 3 15',
        shapes: [
          { from: 'a3', to: 'a1', brush: 'blue' },
          { from: 'd3', to: 'b1', brush: 'red' },
        ],
        text: 'Pole a1 a a2 hlídá dáma a3. Na b2 nebo c1 by dámu vzal bílý. Černý ji musí dát za střelce.',
      },
    ],
    outro: 'Figura hluboko v soupeřově táboře má málo polí. Tichým tahem jí zavři poslední a chyť ji.',
    practice: [
      { kind: 'puzzles', band: 'tezsi', theme: 'trappedPiece', count: 5, label: 'Úlohy: chycená figurka' },
      { kind: 'puzzles', band: 'tezsi', theme: 'quietMove', count: 5, label: 'Úlohy: tichý tah' },
    ],
  },

  // plan lesson 11: Vzájemná nevýhoda tahu (the trébuchet)
  {
    id: 'l6-vzajemna-nevyhoda',
    level: 6,
    number: 12,
    title: 'Vzájemná nevýhoda tahu',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: TREBUCHET_W,
        shapes: [
          { from: 'c5', to: 'd5', brush: 'red' },
          { from: 'e4', to: 'd4', brush: 'red' },
        ],
        text: 'Oba králové hlídají svého pěšce a napadají soupeřova. Kdo táhne, musí jedno z toho vzdát.',
      },
      {
        id: 'white-to-move',
        kind: 'choose',
        fen: TREBUCHET_W,
        text: 'Na tahu je bílý. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['cerny'],
        explain: 'Černý vyhraje. Bílý král musí odejít a černý vezme pěšce d4.',
        wrongDefault: 'Bílý král musí táhnout. Pěšce d4 pak už neuhlídá.',
        verify: { kind: 'outcome' },
      },
      {
        id: 'black-to-move',
        kind: 'choose',
        fen: TREBUCHET_B,
        text: 'Stejná pozice, na tahu je černý. Jak to dopadne teď?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['bily'],
        explain: 'Bílý vyhraje. Teď musí odejít černý král a padne pěšec d5.',
        wrongDefault: 'Černý král musí táhnout. Pěšce d5 pak už neuhlídá.',
        verify: { kind: 'outcome' },
      },
      {
        id: 'name',
        kind: 'show',
        fen: TREBUCHET_B,
        text: 'Tomu se říká vzájemná nevýhoda tahu. Kdo je na tahu, dopadne hůř. Tady dokonce prohraje.',
      },
      {
        // Tablebase: only Kc5 wins; every other move loses.
        id: 'reach',
        kind: 'move',
        fen: TREBUCHET_REACH,
        accept: ['c6c5'],
        completeness: { kind: 'tablebase' },
        text: 'Bílý je na tahu. Jeden tah vyhraje, všechny ostatní prohrají. Najdi ho.',
        success: 'Výborně! Teď je v nevýhodě tahu černý. Musí odejít a pěšec d5 padne.',
        wrong: { c6d6: 'Král teď napadá pěšce d5, ale nehlídá d4. Po Kxd4 prohraješ.' },
        wrongDefault: 'Tenhle tah prohrává. Postav krále tak, aby na tahu byl černý.',
      },
    ],
    outro: 'Vzájemná nevýhoda tahu: kdo musí táhnout, dopadne hůř. Snaž se, aby to byl soupeř.',
    practice: [{ kind: 'endgame', id: 'kp-far', label: 'Koncovky: král a pěšec 5/7' }],
  },

  // plan lesson 12: Rozbor vlastní partie II
  {
    id: 'l6-rozbor',
    level: 6,
    number: 13,
    title: 'Rozbor vlastní partie II',
    steps: [
      {
        id: 'why',
        kind: 'show',
        fen: START,
        text: 'Na téhle úrovni se učíš hlavně ze svých partií. Zahraj si a pak otevři Rozbor.',
      },
      {
        id: 'turn',
        kind: 'show',
        fen: START,
        text: 'Najdi místo, kde se proužek nejvíc pohnul. Tam se partie zlomila.',
      },
      {
        id: 'before',
        kind: 'show',
        fen: START,
        text: 'U té chyby se ještě nedívej na šipku. Nejdřív najdi lepší tah bez nápovědy a propočítej ho.',
      },
      {
        id: 'question',
        kind: 'choose',
        fen: START,
        text: 'Co si máš u své chyby zeptat nejdřív?',
        options: [
          { id: 'prehledl', label: 'Co mi uniklo: šach, braní, nebo hrozba?' },
          { id: 'smula', label: 'Proč mám takovou smůlu?' },
          { id: 'rychle', label: 'Jak dohrát partii rychleji?' },
        ],
        correct: ['prehledl'],
        explain: 'Ano! Většina chyb je přehlédnutý šach, braní nebo hrozba.',
        wrongDefault: 'Nejvíc pomůže zjistit, co ti uniklo.',
      },
      {
        id: 'note',
        kind: 'show',
        fen: START,
        text: 'Po každém rozboru si zapamatuj jednu věc. Příště na ni dej pozor.',
      },
    ],
    outro: 'Rozbor: najdi zlom partie a bez nápovědy hledej lepší tah. Teprve pak se podívej na šipku.',
    practice: [{ kind: 'play', level: 6, label: 'Zahraj si partii a pak ji rozeber' }],
  },

  // Zkouška úrovně 6 (plan, level tests L6: mat 4. tahem · Réti · podproměna · Vančura ·
  // lehká figura proti pěšci · roh pro S+J · obranný tah · vzájemná nevýhoda tahu), plus
  // poslední řada, klíčové pole a chycená figurka. New positions: other Lichess puzzles, or the
  // lesson's endgames mirrored (a↔h), every one checked again by the tablebase.
  {
    id: 'l6-zkouska',
    level: 6,
    number: 14,
    title: 'Zkouška úrovně 6',
    test: {
      passScore: 9,
      badge: 'l6',
      failOutro: 'Tentokrát to nevyšlo. Zopakuj si lekce, kde to drhlo, a zkus to znovu.',
    },
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        diagram: true,
        text: 'Zkouška úrovně 6! Čeká tě 11 úloh. Na každou máš jen jeden pokus a žádnou nápovědu.',
      },
      {
        // Lichess puzzle 1seQh, after black's 19th move (Df7+ Kh8 Sf8 Vxf8 Dxf8+ Dxf8 Vxf8#).
        id: 't-mate4',
        kind: 'move',
        fen: 'q3r1k1/6pp/2p1p3/1pBp4/3Pn3/1PP1PQ2/6PP/5RK1 w - - 0 20',
        accept: ['f3f7'],
        completeness: { kind: 'best' },
        text: 'Dej mat 4. tahem. Zahraj první tah.',
        success: 'Správně! Po Kh8 přijde tichý tah Sf8 a mat na f8.',
        wrongDefault: 'Začni šachem Df7+. Po Kh8 Sf8 Vxf8 Dxf8+ Dxf8 Vxf8 je mat.',
      },
      {
        // Lichess puzzle MvlyT, after 27...Vad8 (Dxf7+ Vxf7 Vxd8+ Vf8 Sxe6+ Kh8 Vxf8#).
        id: 't-back-rank',
        kind: 'move',
        fen: '3r1rk1/3R1ppp/p3p3/1p2P3/8/P3q2P/BPb3P1/5Q1K w - - 4 28',
        accept: ['f1f7'],
        completeness: { kind: 'best' },
        text: 'Věž f8 má dva úkoly. Využij toho a dej mat.',
        success: 'Správně! Po Vxf7 přijde Vxd8+ Vf8 Sxe6+ a mat.',
        wrongDefault: 'Dxf7+! odláká věž f8. Pak Vxd8+ Vf8 Sxe6+ Kh8 Vxf8 mat.',
      },
      {
        // l6-klicova-pole's sixth-rank task mirrored (a↔h). Tablebase: only Kd7 wins.
        id: 't-key',
        kind: 'move',
        fen: '5k2/8/3KP3/8/8/8/8/8 w - - 0 1',
        accept: ['d6d7'],
        completeness: { kind: 'tablebase' },
        text: 'Najdi jediný vyhrávající tah.',
        success: 'Správně! Král na d7 stojí na klíčovém poli pěšce e6.',
        wrongDefault: 'Vyhraje jen Kd7, klíčové pole pěšce e6. Po e7+ je jen remíza.',
      },
      {
        // Réti's study mirrored (a↔h). Tablebase: only Kb7 draws.
        id: 't-reti',
        kind: 'move',
        fen: 'K7/8/5P1k/p7/8/8/8/8 w - - 0 1',
        accept: ['a8b7'],
        completeness: { kind: 'tablebase' },
        text: 'Zachraň remízu.',
        success: 'Správně! Král jde po úhlopříčce k oběma pěšcům, jako v Rétiho studii.',
        wrongDefault: 'Remízu drží jen Kb7. Král jde po úhlopříčce k oběma pěšcům najednou.',
      },
      {
        // Saavedra after 5...Vd4 mirrored (a↔h). Tablebase: f8V wins, f8D draws, f8S/f8J lose.
        id: 't-underpromotion',
        kind: 'move',
        fen: '8/5P2/8/8/4r3/8/5K2/7k w - - 0 1',
        movable: ['f7'],
        accept: ['f7f8r'],
        completeness: { kind: 'promote', from: 'f7', to: 'f8', piece: 'r' },
        text: 'Proměň pěšce ve figuru, se kterou vyhraješ.',
        success: 'Správně! Věž. Po dámě by přišlo Vf4+ Dxf4 a pat.',
        wrongDefault: 'Vyhraje jen věž. Dáma dá po Vf4+ Dxf4 pat, střelce nebo jezdce věž sebere.',
        tbNarrow: 'Only the pawn may move (Kf3 and Kg3 win too, more slowly).',
      },
      {
        // l6-vancura's build mirrored (a↔h). Tablebase: Vc6 and Vc4+ draw, Vh1 and Vc7 lose.
        id: 't-vancura',
        kind: 'choose',
        fen: '7R/1k6/7P/8/6K1/8/8/2r5 b - - 0 1',
        orientation: 'black',
        text: 'Hraješ za černé. Kam s věží, aby udržela remízu?',
        options: [
          { id: 'c6', label: 'Vc6' },
          { id: 'h1', label: 'Vh1' },
          { id: 'c7', label: 'Vc7' },
        ],
        correct: ['c6'],
        explain: 'Správně! Vančurova pozice: věž napadá pěšce h6 ze strany.',
        wrongDefault: 'Remízu drží Vc6. Věž napadá pěšce ze strany, po šesté řadě.',
        verify: { kind: 'tbmoves', moves: { c6: 'c1c6', h1: 'c1h1', c7: 'c1c7' } },
      },
      {
        // l6-lehka-figura-pesec's knight task mirrored (a↔h). Tablebase: black wins.
        id: 't-knight',
        kind: 'choose',
        fen: 'K7/8/8/8/8/8/6kp/2N5 w - - 0 1',
        text: 'Bílý je na tahu. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['cerny'],
        explain: 'Správně! Jezdec za jeden tah pole h1 neohlídá. Pěšec se promění.',
        wrongDefault: 'Černý vyhraje. Jezdec nestihne ohlídat pole h1.',
        verify: { kind: 'outcome' },
      },
      {
        id: 't-kbn',
        kind: 'choose',
        fen: '8/8/8/3k4/8/3KBN2/8/8 w - - 0 1',
        text: 'Mat střelcem a jezdcem. Do kterého rohu zaženeš černého krále?',
        options: [
          { id: 'a8', square: 'a8' },
          { id: 'h8', square: 'h8' },
          { id: 'h1', square: 'h1' },
        ],
        correct: ['h8'],
        explain: 'Správně! Střelec e3 chodí po tmavých polích a roh h8 je tmavý.',
        wrongDefault: 'Správný je roh h8. Má stejnou barvu jako pole střelce e3.',
      },
      {
        // Lichess puzzle dbdmq, after 15.Sxa7 (Sb4+ Kd1 0-0: the rook f8 then guards b8).
        id: 't-defence',
        kind: 'move',
        fen: 'Qn2kb1r/Bpq2ppp/4pn2/1p1P4/2P5/5P2/PP3P1P/R3KB1R b KQk - 1 15',
        orientation: 'black',
        accept: ['f8b4'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé. Bílá dáma hrozí Dxb8+. Najdi obranu.',
        success: 'Správně! Po šachu uhne bílý král a ty uděláš rošádu. Věž pak kryje b8.',
        wrongDefault: 'Obranou je Sb4+. Po tahu králem přijde 0-0 a věž kryje jezdce b8.',
      },
      {
        // The trébuchet mirrored (a↔h). Tablebase: black to move loses.
        id: 't-zugzwang',
        kind: 'choose',
        fen: '8/8/8/4pK2/3kP3/8/8/8 b - - 0 1',
        text: 'Na tahu je černý. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['bily'],
        explain: 'Správně! Vzájemná nevýhoda tahu: černý král musí odejít a pěšec e5 padne.',
        wrongDefault: 'Bílý vyhraje. Černý král musí táhnout a pěšce e5 už neuhlídá.',
        verify: { kind: 'outcome' },
      },
      {
        // Lichess puzzle 77pPn, after 14.Se2: Sc2 traps the queen d1.
        id: 't-trapped',
        kind: 'move',
        fen: 'rn2r1k1/ppq2ppp/8/8/1P1p4/3bP3/P2PBPPP/RNBQK2R b KQ - 1 14',
        orientation: 'black',
        accept: ['d3c2'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé. Chyť bílou dámu.',
        success: 'Správně! Dáma d1 nemá kam uhnout. Bílý ji musí dát za střelce.',
        wrongDefault: 'Sc2 napadne dámu d1. Ta nemá kam uhnout.',
      },
    ],
    outro: 'Zkouška je za tebou! Odznak je tvůj a můžeš si vytisknout diplom.',
    practice: [{ kind: 'play', level: 7, label: 'Zahraj si partii proti nejsilnějšímu soupeři' }],
  },
];
