/**
 * Level 5 — Pokročilý. First batch (docs/phase-22-plan.md, generation order 3): lessons 1,
 * 2, 9 and 10 of the plan's curriculum — the mechanically checkable ones (endgames `lucena`,
 * `philidor`, `bb`; two verified classic games). Shipped here as lessons 1–4 in course order;
 * the plan's own numbering is not preserved (docs/phase-22-plan.md note on gaps) — the rest
 * of level 5 (izolovaný/zdvojený/opožděný pěšec, dobrý/špatný střelec, slabé pole a forpost,
 * and later the tablebase-checked lessons) is appended by later commits. No level test yet.
 *
 * Rook endgames: many moves keep the result, so `lucena` and `philidor` teach the technique
 * with show/choose steps whose answers are facts (e.g. "which move ends the checks"); every
 * wrong option was checked to be really wrong with the Lichess tablebase (review
 * 2026-09-26, see the notes at the FENs). The two Lucena move tasks name the target
 * explicitly („na čtvrtou řadu“, „v dámu“) and explain the other winning moves in `wrong`.
 *
 * Lesson 4 (Slavné kombinace): both games replayed move by move with chess.js against the
 * published scores (Wikipedia + chessbase/chess.com for the Immortal Game; Wikipedia +
 * chesstrapguide/gambiter for Lasker–Bauer). At 22.Df6+ Stockfish (depth 20) sees three
 * forced mates: Df6+ (#2), Dxf7 (#4), d4 (#8); the task asks for a queen move and accepts
 * both queen mates (margin 10 cp over mate scores). Kieseritzky reportedly resigned before
 * the mate; 22.Df6+ Jxf6 23.Se7# is the finish as usually published.
 *
 * Lessons 5–7 (izolovaný/zdvojený/opožděný pěšec, dobrý/špatný střelec, slabé pole a
 * forpost): definitional `choose` tasks (docs/phase-22-plan.md, generation order 3). Every
 * position is a hand-built, minimal pawn/piece skeleton chosen so the definition applies
 * unambiguously (no `verify` fact fits these terms — file-count and square-colour geometry
 * — so no new `check-lessons.mjs` verify kind was added; see the report). Per the plan,
 * these three need a strong-player (~2000+) read before shipping to players.
 */
import type { Lesson } from './types';

// ---- Lesson 1: Lucenova pozice (stavba mostu) --------------------------------------------

// The main line (review 2026-09-26, every position checked with the Lichess tablebase):
// 1.Vd1+ Ke7 2.Vd4 Va1 3.Kc7 Vc1+ 4.Kb6 Vb1+ 5.Kc6 Vc1+ 6.Kb5 Vb1+ 7.Vb4 (Vc1) 8.b8D.
/** The Lucena position: the white king is shut in (a-file: rook; c7/c8: the black king). */
const LUCENA_START = '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1';
/** After 1.Vd1+ Ke7: the king has been pushed a file away; now the bridge (tablebase:
 *  Vd4, Vd3, Vd5 and waiting moves win; Vd2, Vd6, Vd7+, Vd8, Va1 only draw). */
const LUCENA_KICKED = '1K6/1P2k3/8/8/8/8/r7/3R4 w - - 2 2';
/** After 6...Vb1+: tablebase — Vb4 wins (and ends the checks), Kc6/Ka6 only repeat,
 *  Kc5/Kc4/Ka5/Ka4 draw (the rook takes b7). */
const LUCENA_CHECKED = '8/1P2k3/8/1K6/3R4/8/8/1r6 w - - 12 7';
/** After 7.Vb4: the bridge; Vxb4+ is met by Kxb4. Every black move loses. */
const LUCENA_BRIDGE = '8/1P2k3/8/1K6/1R6/8/8/1r6 b - - 13 7';
/** After 7...Vc1: b8D (and b8V) win, b8S/b8J only draw (tablebase). */
const LUCENA_PROMOTE = '8/1P2k3/8/1K6/1R6/8/8/2r5 w - - 14 8';

// ---- Lesson 2: Philidorova pozice -----------------------------------------------------

// Tablebase (review 2026-09-26): START draw; D6 draws only with Va1–Va4 (Va5+, Vb6, Vc6,
// Vxd6, Va7, Va8 and king moves lose); after 1...Va1 2.Ke6 only Ve1+ draws; BEHIND: every
// white move draws. The white rook stands on h7 so that it does not see the first rank.
const PHILIDOR_START = '3k4/7R/r7/3PK3/8/8/8/8 b - - 0 1';
/** After d5–d6: the pawn now blocks the sixth rank, so e6 is no longer guarded. */
const PHILIDOR_PAWN_D6 = '3k4/7R/r2P4/4K3/8/8/8/8 b - - 0 1';
/** After 1...Va1 2.Ke6 (threat Vh8#) Ve1+: checks from behind, from far away. */
const PHILIDOR_BEHIND = '3k4/7R/3PK3/8/8/8/8/4r3 w - - 3 3';

// ---- Lesson 3: Mat dvěma střelci (`bb`) -----------------------------------------------

const BB_START = '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1';
/** The "wall": two bishops next to each other block every square in front of them. */
const BB_WALL = '4k3/8/8/8/3BB3/8/8/4K3 w - - 0 1';
/** Black king at e6 tries the squares around it: d7, e7, f7, d6 are free; e5/f5 are not. */
const BB_WALL_REACH = '8/8/4k3/8/3BB3/8/8/4K3 b - - 0 1';
/** One move from mate: Sh6-g7 is check, and the king has nowhere to go. */
const BB_PRE_MATE = '7k/5K2/6BB/8/8/8/8/8 w - - 0 1';

// ---- Lesson 4: Slavné kombinace --------------------------------------------------------

/** Anderssen–Kieseritzky, London 1851 ("Nesmrtelná partie"), position after 21...Kd8. */
const IMMORTAL_BEFORE_QF6 = 'r1bk2nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1 w - - 1 22';
/** After 22.Df6+ Jxf6, one move from mate. */
const IMMORTAL_BEFORE_SE7 = 'r1bk3r/p2p1pNp/n2B1n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 w - - 0 23';
/** Lasker–Bauer, Amsterdam 1889, position after 14...Jxh5. */
const LASKER_BAUER_BEFORE_SXH7 = 'r4rk1/1b2bppp/ppq1p3/2ppB2n/5P2/1P1BP3/P1PPQ1PP/R4RK1 w - - 0 15';
/** After 15.Sxh7+ Kxh7 16.Dxh5+ Kg8, ready for the second sacrifice. */
const LASKER_BAUER_BEFORE_SXG7 = 'r4rk1/1b2bpp1/ppq1p3/2ppB2Q/5P2/1P2P3/P1PP2PP/R4RK1 w - - 1 17';
/** After 17.Sxg7 Kxg7 18.Dg4+ Kh7 19.Vf3: Vh3+ threatens mate; only 19...e5 (giving the
 *  queen after 20.Vh3+ Dh6) avoids it (Stockfish depth 20). */
const LASKER_BAUER_ROOK_LIFT = 'r4r2/1b2bp1k/ppq1p3/2pp4/5PQ1/1P2PR2/P1PP2PP/R5K1 b - - 3 19';

// ---- Lesson 5: Izolovaný, zdvojený, opožděný pěšec -------------------------------------

/** White's f4 pawn has no pawn on e or g file: izolovaný. b2/c2 cover each other. */
const STRUCT_ISOLATED = '4k3/p6p/8/8/5P2/8/1PP5/4K3 w - - 0 1';
/** Two white pawns on the same file (c2, c4): zdvojení. */
const STRUCT_DOUBLED = '4k3/p6p/8/8/2P5/8/2P5/4K3 w - - 0 1';
/** c3 lags behind b4 and d4 (they can never cover it) and cannot catch up: c4 is guarded
 *  by the black pawn d5. Without d5 the pawn would simply go c3–c4 and not be backward. */
const STRUCT_BACKWARD = '4k3/p6p/8/3p4/1P1P4/2P5/8/4K3 w - - 0 1';

// ---- Lesson 6: Dobrý a špatný střelec ---------------------------------------------------

/** Sc1 (tmavá pole) has two own pawns on dark squares (d4, e5); Sf1 (světlá pole) has none. */
const BISHOPS_MAIN = '4k3/p7/8/4P3/3P4/8/8/2B1KB2 w - - 0 1';
/** The same dark-squared bishop, now outside its pawn chain, active on h6. */
const BISHOPS_ACTIVE = '4k3/p7/7B/4P3/3P4/8/8/4KB2 w - - 0 1';

// ---- Lesson 7: Slabé pole a forpost -----------------------------------------------------

/** Black has no pawn left on c or e file: d5 can never be guarded by a black pawn. */
const WEAK_SQUARE = '4k3/1p3p2/8/8/2P5/2N5/8/4K3 w - - 0 1';
/** The knight sits on that weak square, defended by the pawn on c4: a forpost. */
const OUTPOST = '4k3/1p3p2/8/3N4/2P5/8/8/4K3 w - - 0 1';

export const LEVEL5: readonly Lesson[] = [
  {
    id: 'l5-lucena',
    level: 5,
    number: 1,
    title: 'Lucenova pozice',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: LUCENA_START,
        text: 'Bílý pěšec chce na pole b8. Vlastní král mu ale stojí v cestě.',
      },
      {
        id: 'stuck',
        kind: 'show',
        fen: LUCENA_START,
        shapes: [
          { from: 'a2', to: 'a8', brush: 'red' },
          { from: 'c7', brush: 'red' },
          { from: 'c8', brush: 'red' },
        ],
        text: 'Tvůj král zatím nemůže ven. Sloupec a hlídá černá věž. Pole c7 a c8 hlídá černý král.',
      },
      {
        id: 'kick',
        kind: 'show',
        fen: LUCENA_START,
        shapes: [{ from: 'c1', to: 'd1', brush: 'green' }],
        text: 'Nejdřív odežeň černého krále šachem Vd1+. Musí ustoupit na sloupec e.',
      },
      {
        id: 'rook4',
        kind: 'move',
        fen: LUCENA_KICKED,
        movable: ['d1'],
        accept: ['d1d4'],
        completeness: { kind: 'lands', square: 'd4' },
        text: 'Král ustoupil na e7. Teď postav věž na čtvrtou řadu.',
        success: 'Výborně! Z d4 věž později zastaví šachy.',
        wrong: {
          d1d3: 'I to vyhrává, ale věž patří na čtvrtou řadu. Zkus d4.',
          d1d5: 'I to vyhrává, ale věž patří na čtvrtou řadu. Zkus d4.',
          d1d7: 'Tam ji černý král vezme.',
        },
        wrongDefault: 'Věž má jít na čtvrtou řadu. Kam na ni dojde?',
      },
      {
        id: 'checks',
        kind: 'choose',
        fen: LUCENA_CHECKED,
        shapes: [{ from: 'b1', to: 'b5', brush: 'red' }],
        text: 'Tvůj král vyšel ven a černá věž ho šachuje. Kterým tahem šachy skončí?',
        options: [
          { id: 'vb4', label: 'Vb4' },
          { id: 'kc5', label: 'Kc5' },
          { id: 'ka6', label: 'Ka6' },
        ],
        correct: ['vb4'],
        explain: 'Ano! Věž se postaví šachu do cesty. Tomu se říká stavba mostu.',
        wrongExplain: {
          kc5: 'Pak černá věž sebere pěšce b7. Král musí zůstat u něj.',
          ka6: 'Tím šachy neskončí. Hned přijde další šach Va1+.',
        },
        wrongDefault: 'Hledej tah, po kterém černá věž už šachovat nemůže.',
      },
      {
        id: 'bridge',
        kind: 'show',
        fen: LUCENA_BRIDGE,
        shapes: [{ from: 'b1', to: 'b4', brush: 'red' }],
        text: 'Tohle je most. Věž na b4 zastavila šach zezadu. Když ji černá věž vezme, král vezme zpátky.',
      },
      {
        id: 'promote',
        kind: 'move',
        fen: LUCENA_PROMOTE,
        movable: ['b7'],
        accept: ['b7b8q'],
        completeness: { kind: 'best' },
        text: 'Černý už šachovat nemůže. Proměň pěšce v dámu.',
        success: 'Vyhráno! Most postavený, pěšec je dáma.',
        wrong: {
          b7b8r: 'Věž by taky vyhrála, ale dáma je silnější. Proměň v dámu.',
          b7b8b: 'Se střelcem by to byla jen remíza. Proměň v dámu.',
          b7b8n: 'S jezdcem by to byla jen remíza. Proměň v dámu.',
        },
        wrongDefault: 'Táhni pěšcem na b8 a vyber dámu.',
      },
    ],
    outro: 'Umíš stavbu mostu! Šachem odežeň krále, věž dej na čtvrtou řadu a pak zastav šachy.',
    practice: [{ kind: 'endgame', id: 'lucena', label: 'Koncovky: Lucenova pozice' }],
  },

  {
    id: 'l5-philidor',
    level: 5,
    number: 2,
    title: 'Philidorova pozice',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: PHILIDOR_START,
        text: 'Bílý má navíc pěšce. Černý král ale stojí před ním. Když černý brání správně, je to remíza.',
      },
      {
        id: 'sixth-rank',
        kind: 'show',
        fen: PHILIDOR_START,
        shapes: [{ from: 'a6', to: 'h6', brush: 'blue' }],
        text: 'Černá věž hlídá šestou řadu. Bílý král na ni nesmí, dokud tam věž stojí.',
      },
      {
        id: 'why-holds',
        kind: 'choose',
        fen: PHILIDOR_START,
        text: 'Proč bílý král teď nesmí na pole e6?',
        options: [
          { id: 'vez', label: 'Hlídá ho černá věž' },
          { id: 'nic', label: 'Nic mu nebrání' },
          { id: 'sach', label: 'Byl by tam sám v šachu od pěšce' },
        ],
        correct: ['vez'],
        explain: 'Ano! Věž na šesté řadě hlídá celou řadu, i pole e6.',
        wrongExplain: {
          nic: 'Něco mu brání. Podívej se, co hlídá černá věž.',
          sach: 'Vlastní pěšec svého krále v šachu nedá.',
        },
        wrongDefault: 'Podívej se, kterou řadu hlídá černá věž.',
      },
      {
        id: 'pawn-advances',
        kind: 'show',
        fen: PHILIDOR_PAWN_D6,
        shapes: [{ from: 'a6', to: 'd6', brush: 'red' }],
        text: 'Bílý zahrál d6. Pěšec teď zakrývá šestou řadu. Věž už pole e6 nehlídá.',
      },
      {
        id: 'switch',
        kind: 'choose',
        fen: PHILIDOR_PAWN_D6,
        text: 'Kam teď pojede černá věž?',
        options: [
          { id: 'a1', square: 'a1' },
          { id: 'a5', square: 'a5' },
          { id: 'b6', square: 'b6' },
        ],
        correct: ['a1'],
        explain: 'Ano! Věž jde co nejdál dozadu. Odtud bude krále šachovat zezadu.',
        wrongExplain: {
          a5: 'Po šachu Va5+ král vstoupí na e6. Pak hrozí mat na osmé řadě.',
          b6: 'Na šesté řadě už věž nepomůže. Král vstoupí na e6 a hrozí mat.',
        },
        wrongDefault: 'Věž má jít daleko dozadu, odkud bude šachovat.',
      },
      {
        id: 'behind',
        kind: 'show',
        fen: PHILIDOR_BEHIND,
        shapes: [{ from: 'e1', to: 'e6', brush: 'red' }],
        text: 'Bílý král vstoupil na e6 a hrozí mat. Věž ho ale hned šachuje zezadu, z dálky.',
      },
      {
        id: 'result',
        kind: 'choose',
        fen: PHILIDOR_BEHIND,
        text: 'Co se stane, když věž takhle šachuje pořád?',
        options: [
          { id: 'remiza', label: 'Král nikdy neuteče, je to remíza' },
          { id: 'vyhra', label: 'Bílý nakonec unikne a vyhraje' },
        ],
        correct: ['remiza'],
        explain: 'Přesně tak! Král se šachům nevyhne. Remíza.',
        wrongDefault: 'Když král uteče od pěšce, černý ho sebere. Když zůstane, přijde další šach.',
      },
    ],
    outro: 'Umíš Philidorovu pozici! Věž drž na šesté řadě. Když pěšec postoupí, šachuj zezadu.',
    practice: [{ kind: 'endgame', id: 'philidor', label: 'Koncovky: Philidorova pozice' }],
  },

  {
    id: 'l5-dva-strelci',
    level: 5,
    number: 3,
    title: 'Mat dvěma střelci',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: BB_START,
        text: 'Král s jedním střelcem mat dát nemůže. Král se dvěma střelci ano.',
      },
      {
        id: 'wall',
        kind: 'show',
        fen: BB_WALL,
        shapes: [
          { from: 'd4', to: 'g7', brush: 'blue' },
          { from: 'e4', to: 'h7', brush: 'blue' },
        ],
        text: 'Střelci vedle sebe tvoří zeď. Král přes ni nemůže projít.',
      },
      {
        id: 'reach',
        kind: 'choose',
        fen: BB_WALL_REACH,
        text: 'Na které z těch polí smí černý král?',
        options: [
          { id: 'e5', square: 'e5' },
          { id: 'f5', square: 'f5' },
          { id: 'e7', square: 'e7' },
        ],
        correct: ['e7'],
        explain: 'Ano! Na e7 král smí. Na e5 i f5 hlídá zeď střelců.',
        wrongExplain: {
          e5: 'Tam nesmí. To pole hlídá střelec d4.',
          f5: 'Tam nesmí. To pole hlídá střelec e4.',
        },
        wrongDefault: 'Podívej se, která pole hlídají oba střelci.',
        verify: { kind: 'reachable', from: 'e6' },
      },
      {
        id: 'any-corner',
        kind: 'show',
        fen: BB_START,
        text: 'Střelci krále zatlačí k okraji a pak do rohu. Barva rohu nevadí, máš střelce na obou barvách.',
      },
      {
        id: 'corner',
        kind: 'show',
        fen: BB_PRE_MATE,
        text: 'Král je zahnaný do rohu a nemá žádné volné pole. Pozor na pat: teď musíš dát šach.',
      },
      {
        id: 'mate',
        kind: 'move',
        fen: BB_PRE_MATE,
        accept: ['h6g7'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Mat! Střelce na g7 kryje tvůj král, takže ho černý nevezme.',
        wrongDefault: 'To není mat. Hledej tah střelcem, po kterém král nemá žádné pole.',
      },
    ],
    outro: 'Umíš mat dvěma střelci! Střelci jako zeď zatlačí krále do rohu a tvůj král pomůže.',
    practice: [{ kind: 'endgame', id: 'bb', label: 'Koncovky: mat dvěma střelci' }],
  },

  {
    id: 'l5-kombinace',
    level: 5,
    number: 4,
    title: 'Slavné kombinace',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: IMMORTAL_BEFORE_QF6,
        text: 'Anderssen–Kieseritzky, Londýn 1851. Této partii se říká Nesmrtelná. Bílý už daroval střelce a obě věže.',
      },
      {
        id: 'qf6',
        kind: 'move',
        fen: IMMORTAL_BEFORE_QF6,
        movable: ['f3'],
        accept: ['f3f6', 'f3f7'],
        completeness: { kind: 'best', marginCp: 10 },
        text: 'Bílý teď vynutí mat. Najdi tah dámou, který k němu vede.',
        success: 'Správně, to vede k matu! Anderssen zvolil nejkrásnější cestu: oběť dámy 22.Df6+.',
        wrongDefault: 'Tím mat nevynutíš. Hledej tah dámou se šachem nebo s hrozbou matu.',
      },
      {
        id: 'why',
        kind: 'show',
        fen: IMMORTAL_BEFORE_SE7,
        text: 'Po 22.Df6+ vzal černý dámu jezdcem. Jezdec tím odešel z g8, odkud hlídal pole e7.',
      },
      {
        id: 'se7',
        kind: 'move',
        fen: IMMORTAL_BEFORE_SE7,
        accept: ['d6e7'],
        completeness: { kind: 'mate' },
        text: 'Dej mat střelcem.',
        success: 'Mat! Slavné 23.Se7# z Nesmrtelné partie.',
        wrongDefault: 'To není mat. Hledej tah střelcem, po kterém král nemá kam utéct.',
      },
      {
        id: 'lb-intro',
        kind: 'show',
        fen: LASKER_BAUER_BEFORE_SXH7,
        text: 'Lasker–Bauer, Amsterdam 1889. Bílý obětuje oba střelce, aby odkryl krále.',
      },
      {
        id: 'sxh7',
        kind: 'move',
        fen: LASKER_BAUER_BEFORE_SXH7,
        accept: ['d3h7'],
        completeness: { kind: 'best' },
        text: 'Obětuj prvního střelce se šachem.',
        success: 'Výborně! Černý král střelce vzal. Hned přijde šach 16.Dxh5+.',
        wrongDefault: 'Hledej tah střelcem, který obětuje figurku, ale dá šach.',
      },
      {
        id: 'sxg7',
        kind: 'move',
        fen: LASKER_BAUER_BEFORE_SXG7,
        accept: ['e5g7'],
        completeness: { kind: 'best' },
        text: 'Po 16.Dxh5+ se král vrátil na g8. Obětuj i druhého střelce.',
        success: 'Druhá oběť! Před černým králem teď skoro nezbyli pěšci.',
        wrongDefault: 'Hledej tah druhým střelcem, který taky obětuje figurku.',
      },
      {
        id: 'rook-lift',
        kind: 'show',
        fen: LASKER_BAUER_ROOK_LIFT,
        shapes: [{ from: 'f3', to: 'h3', brush: 'red' }],
        text: 'Pak přišlo 18.Dg4+ Kh7 19.Vf3. Věž hrozí Vh3+ a mat. Mat odvrátil černý jen za cenu dámy.',
      },
    ],
    outro: 'Oběť se vyplatí, když otevře cestu ke králi. Slavné partie to dokazují už přes sto let.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'sacrifice', count: 5, label: 'Úlohy: oběť' }],
  },

  {
    id: 'l5-struktura-pescu',
    level: 5,
    number: 5,
    title: 'Izolovaný, zdvojený, opožděný pěšec',
    steps: [
      {
        id: 'isolated-show',
        kind: 'show',
        fen: STRUCT_ISOLATED,
        shapes: [{ from: 'f4', brush: 'red' }],
        text: 'Pěšec f4 nemá vlastního pěšce na sloupci e ani g. Je izolovaný. Žádný pěšec ho nikdy nebude krýt.',
      },
      {
        id: 'isolated-find',
        kind: 'choose',
        fen: STRUCT_ISOLATED,
        text: 'Který bílý pěšec je izolovaný?',
        options: [
          { id: 'f4', square: 'f4' },
          { id: 'b2', square: 'b2' },
          { id: 'c2', square: 'c2' },
        ],
        correct: ['f4'],
        explain: 'Ano! Vedle f4 nestojí žádný bílý pěšec.',
        wrongExplain: {
          b2: 'Ten izolovaný není. Na vedlejším sloupci c má souseda.',
          c2: 'Ten izolovaný není. Na vedlejším sloupci b má souseda.',
        },
        wrongDefault: 'Hledej pěšce, který nemá souseda na sloupci vedle.',
      },
      {
        id: 'doubled-show',
        kind: 'show',
        fen: STRUCT_DOUBLED,
        shapes: [
          { from: 'c2', brush: 'red' },
          { from: 'c4', brush: 'red' },
        ],
        text: 'Dva bílí pěšci stojí na stejném sloupci c. Tomu se říká zdvojení pěšci.',
      },
      {
        id: 'doubled-check',
        kind: 'choose',
        fen: STRUCT_DOUBLED,
        text: 'Kryje zadní pěšec c2 toho předního na c4?',
        options: [
          { id: 'ano', label: 'Ano' },
          { id: 'ne', label: 'Ne' },
        ],
        correct: ['ne'],
        explain: 'Správně, ne. Pěšec bere šikmo, ne po svém sloupci.',
        wrongDefault: 'Pěšec kryje jen šikmo dopředu, nikdy po svém sloupci.',
      },
      {
        id: 'backward-show',
        kind: 'show',
        fen: STRUCT_BACKWARD,
        shapes: [
          { from: 'c3', brush: 'red' },
          { from: 'd5', to: 'c4', brush: 'blue' },
        ],
        text: 'Pěšec c3 zůstal za sousedy b4 a d4. Dopředu nemůže, na c4 by ho vzal pěšec d5. Je opožděný.',
      },
      {
        id: 'backward-find',
        kind: 'choose',
        fen: STRUCT_BACKWARD,
        text: 'Který pěšec je opožděný?',
        options: [
          { id: 'c3', square: 'c3' },
          { id: 'b4', square: 'b4' },
          { id: 'd4', square: 'd4' },
        ],
        correct: ['c3'],
        explain: 'Ano! Sousedé b4 a d4 už c3 nikdy nekryjí. A dopředu ho nepustí pěšec d5.',
        wrongExplain: {
          b4: 'Ten opožděný není. Je nejvíc vpředu, spolu s d4.',
          d4: 'Ten opožděný není. Je nejvíc vpředu, spolu s b4.',
        },
        wrongDefault: 'Hledej pěšce, který zůstal za oběma sousedy.',
      },
    ],
    outro: 'Izolovaný, zdvojený i opožděný pěšec bývají slabiny. Soupeř na ně rád útočí.',
    practice: [{ kind: 'play', level: 5, label: 'Zahraj si partii a všímej si slabých pěšců' }],
  },

  {
    id: 'l5-strelec',
    level: 5,
    number: 6,
    title: 'Dobrý a špatný střelec',
    steps: [
      {
        id: 'colour',
        kind: 'show',
        fen: BISHOPS_MAIN,
        text: 'Střelec chodí jen po jedné barvě polí. Spočítej si vlastní pěšce na jeho barvě.',
      },
      {
        id: 'count',
        kind: 'choose',
        fen: BISHOPS_MAIN,
        text: 'Střelec c1 chodí po tmavých polích. Kolik bílých pěšců stojí na tmavém poli?',
        options: [
          { id: '0', label: '0' },
          { id: '1', label: '1' },
          { id: '2', label: '2' },
        ],
        correct: ['2'],
        explain: 'Ano! Pěšci d4 i e5 stojí na tmavém poli, stejně jako střelec.',
        wrongExplain: { '0': 'Podívej se pořádně, oba pěšci stojí na tmavém poli.', '1': 'Je jich víc. Podívej se na d4 i e5.' },
        wrongDefault: 'Spočítej pěšce na d4 a e5. Jsou to tmavá pole?',
      },
      {
        id: 'bad',
        kind: 'show',
        fen: BISHOPS_MAIN,
        text: 'Vlastní pěšci stojí na polích jeho barvy a zavírají mu cestu. Takový střelec je špatný.',
      },
      {
        id: 'good',
        kind: 'choose',
        fen: BISHOPS_MAIN,
        text: 'Který střelec je tady dobrý?',
        options: [
          { id: 'c1', square: 'c1' },
          { id: 'f1', square: 'f1' },
        ],
        correct: ['f1'],
        explain: 'Ano! Střelci f1 žádný vlastní pěšec na jeho barvě nepřekáží.',
        wrongExplain: { c1: 'Ten je tu špatný. Vlastní pěšci mu stojí v cestě.' },
        wrongDefault: 'Hledej střelce, kterému nepřekáží vlastní pěšci.',
      },
      {
        id: 'not-useless',
        kind: 'show',
        fen: BISHOPS_ACTIVE,
        text: 'Špatný střelec ale není k ničemu. Před svými pěšci může být aktivní, třeba na h6.',
      },
    ],
    outro: 'Dobrý střelec má volnou cestu, špatnému ji zavírají vlastní pěšci. I špatný střelec ale bývá užitečný.',
    practice: [{ kind: 'play', level: 5, label: 'Zahraj si partii a všímej si, jakou barvu mají tvoji pěšci' }],
  },

  {
    id: 'l5-slabe-pole',
    level: 5,
    number: 7,
    title: 'Slabé pole a forpost',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: WEAK_SQUARE,
        shapes: [{ from: 'd5', brush: 'green' }],
        text: 'Černý nemá pěšce na sloupci c ani e. Pole d5 proto žádný černý pěšec hlídat nemůže.',
      },
      {
        id: 'why',
        kind: 'choose',
        fen: WEAK_SQUARE,
        text: 'Proč je pole d5 slabé?',
        options: [
          { id: 'zadny', label: 'Černý ho pěšcem nikdy nehlídá' },
          { id: 'dva', label: 'Bílý ho hlídá dvěma pěšci' },
          { id: 'stred', label: 'Je uprostřed šachovnice' },
        ],
        correct: ['zadny'],
        explain: 'Ano! Bez pěšců na sloupcích c a e ho černý pěšcem hlídat nemůže.',
        wrongExplain: {
          dva: 'Bílý ho tady hlídá jen jedním pěšcem.',
          stred: 'Poloha uprostřed sama o sobě pole slabým nedělá.',
        },
        wrongDefault: 'Slabé je pole, které soupeř nemůže hlídat pěšcem.',
      },
      {
        id: 'outpost-show',
        kind: 'show',
        fen: OUTPOST,
        shapes: [{ from: 'c4', to: 'd5', brush: 'blue' }],
        text: 'Pole d5 je slabé pole černého a kryje ho tvůj pěšec. Takovému poli se říká forpost.',
      },
      {
        id: 'outpost-why',
        kind: 'choose',
        fen: OUTPOST,
        text: 'Proč je pole d5 pro tvého jezdce forpost?',
        options: [
          { id: 'stoji', label: 'Je slabé a kryje ho tvůj pěšec' },
          { id: 'silny', label: 'Stojí na něm jezdec, nejsilnější figurka' },
          { id: 'blizko', label: 'Je blízko soupeřova krále' },
        ],
        correct: ['stoji'],
        explain: 'Ano! Pěšec jezdce odtud nevyžene. A když ho vezme figurka, pěšec vezme zpátky.',
        wrongExplain: {
          silny: 'Jezdec není nejsilnější figurka. Forpost dělá pole, ne figurka.',
          blizko: 'Blízkost krále forpost nedělá. Rozhoduje slabé pole a krytí pěšcem.',
        },
        wrongDefault: 'Forpost je slabé pole soupeře, které kryje tvůj pěšec.',
      },
      {
        id: 'caveat',
        kind: 'show',
        fen: OUTPOST,
        text: 'Slabé pole samo o sobě nic nevyhraje. Potřebuješ na něj dostat vlastní figurku.',
      },
    ],
    outro: 'Ze slabého pole tě soupeř pěšcem nevyžene. Když ho kryje tvůj pěšec, je to forpost pro tvou figurku.',
    practice: [{ kind: 'play', level: 5, label: 'Zahraj si partii a hledej slabá pole pro svého jezdce' }],
  },
];
