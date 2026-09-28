/**
 * Level 5 — Pokročilý: all 12 lessons of the plan's curriculum (docs/phase-22-plan.md) and the
 * level test (13), in the plan's order. Lesson ids never change, so progress survives the
 * renumbering. The tablebase lessons (věž za volného pěšce, volný pěšec, nestejnobarevní
 * střelci) and the endgame tasks of the test are checked by `check-lessons.mjs` against the
 * Lichess tablebase (`tablebase` completeness, the `outcome` / `tbmoves` choose facts); the
 * tactics (dvě věže na sedmé, oběť kvality, the test) are Lichess puzzles (CC0; the id is
 * noted, the FEN is the position after the opponent's first move) with Stockfish margins.
 *
 * Rook endgames: many moves keep the result, so `lucena` and `philidor` teach the technique
 * with show/choose steps whose answers are facts (e.g. "which move ends the checks"); every
 * wrong option was checked to be really wrong with the Lichess tablebase (review
 * 2026-09-26, see the notes at the FENs). The two Lucena move tasks name the target
 * explicitly („na čtvrtou řadu“, „v dámu“) and explain the other winning moves in `wrong`.
 *
 * Slavné kombinace: both games replayed move by move with chess.js against the
 * published scores (Wikipedia + chessbase/chess.com for the Immortal Game; Wikipedia +
 * chesstrapguide/gambiter for Lasker–Bauer). At 22.Df6+ Stockfish (depth 20) sees three
 * forced mates: Df6+ (#2), Dxf7 (#4), d4 (#8); the task asks for a queen move and accepts
 * both queen mates (margin 10 cp over mate scores). Kieseritzky reportedly resigned before
 * the mate; 22.Df6+ Jxf6 23.Se7# is the finish as usually published.
 *
 * Izolovaný/zdvojený/opožděný pěšec, dobrý/špatný střelec, slabé pole a
 * forpost: definitional `choose` tasks (docs/phase-22-plan.md, generation order 3). Every
 * position is a hand-built, minimal pawn/piece skeleton chosen so the definition applies
 * unambiguously (no `verify` fact fits these terms — file-count and square-colour geometry
 * — so no new `check-lessons.mjs` verify kind was added; see the report). Per the plan,
 * these three need a strong-player (~2000+) read before shipping to players.
 */
import type { Lesson } from './types';

// ---- Lucenova pozice (stavba mostu) --------------------------------------------

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

// ---- Philidorova pozice -----------------------------------------------------

// Tablebase (review 2026-09-26): START draw; D6 draws only with Va1–Va4 (Va5+, Vb6, Vc6,
// Vxd6, Va7, Va8 and king moves lose); after 1...Va1 2.Ke6 only Ve1+ draws; BEHIND: every
// white move draws. The white rook stands on h7 so that it does not see the first rank.
const PHILIDOR_START = '3k4/7R/r7/3PK3/8/8/8/8 b - - 0 1';
/** After d5–d6: the pawn now blocks the sixth rank, so e6 is no longer guarded. */
const PHILIDOR_PAWN_D6 = '3k4/7R/r2P4/4K3/8/8/8/8 b - - 0 1';
/** After 1...Va1 2.Ke6 (threat Vh8#) Ve1+: checks from behind, from far away. */
const PHILIDOR_BEHIND = '3k4/7R/3PK3/8/8/8/8/4r3 w - - 3 3';

// ---- Mat dvěma střelci (`bb`) -----------------------------------------------

const BB_START = '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1';
/** The "wall": two bishops next to each other block every square in front of them. */
const BB_WALL = '4k3/8/8/8/3BB3/8/8/4K3 w - - 0 1';
/** Black king at e6 tries the squares around it: d7, e7, f7, d6 are free; e5/f5 are not. */
const BB_WALL_REACH = '8/8/4k3/8/3BB3/8/8/4K3 b - - 0 1';
/** One move from mate: Sh6-g7 is check, and the king has nowhere to go. */
const BB_PRE_MATE = '7k/5K2/6BB/8/8/8/8/8 w - - 0 1';

// ---- Slavné kombinace --------------------------------------------------------

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

// ---- Izolovaný, zdvojený, opožděný pěšec -------------------------------------

/** White's f4 pawn has no pawn on e or g file: izolovaný. b2/c2 cover each other. */
const STRUCT_ISOLATED = '4k3/p6p/8/8/5P2/8/1PP5/4K3 w - - 0 1';
/** Two white pawns on the same file (c2, c4): zdvojení. */
const STRUCT_DOUBLED = '4k3/p6p/8/8/2P5/8/2P5/4K3 w - - 0 1';
/** c3 lags behind b4 and d4 (they can never cover it) and cannot catch up: c4 is guarded
 *  by the black pawn d5. Without d5 the pawn would simply go c3–c4 and not be backward. */
const STRUCT_BACKWARD = '4k3/p6p/8/3p4/1P1P4/2P5/8/4K3 w - - 0 1';

// ---- Dobrý a špatný střelec ---------------------------------------------------

/** Sc1 (tmavá pole) has two own pawns on dark squares (d4, e5); Sf1 (světlá pole) has none. */
const BISHOPS_MAIN = '4k3/p7/8/4P3/3P4/8/8/2B1KB2 w - - 0 1';
/** The same dark-squared bishop, now outside its pawn chain, active on h6. */
const BISHOPS_ACTIVE = '4k3/p7/7B/4P3/3P4/8/8/4KB2 w - - 0 1';

// ---- Slabé pole a forpost -----------------------------------------------------

/** Black has no pawn left on c or e file: d5 can never be guarded by a black pawn. */
const WEAK_SQUARE = '4k3/1p3p2/8/8/2P5/2N5/8/4K3 w - - 0 1';
/** The knight sits on that weak square, defended by the pawn on c4: a forpost. */
const OUTPOST = '4k3/1p3p2/8/3N4/2P5/8/8/4K3 w - - 0 1';

// ---- Věž za volného pěšce (Tarraschovo pravidlo) — tablebase -----------------------------

/** Only Va1 (behind the pawn) and Vc5 win; everything else draws or loses. */
const TARRASCH_ATTACK = 'r7/5pk1/8/P7/8/6P1/6K1/2R5 w - - 0 1';
const TARRASCH_BEHIND = 'r7/5pk1/8/P7/8/6P1/6K1/R7 b - - 1 1';
/** Black to move: Vb1 (behind the pawn), Vd1 and Vh5 draw; Vh8 and Vc1 lose. */
const TARRASCH_DEFEND = '8/2R5/5k2/1P6/4K3/8/8/7r b - - 0 1';
const TARRASCH_DEFENDED = '8/2R5/5k2/1P6/4K3/8/8/1r6 w - - 1 2';

// ---- Volný pěšec: krytý a vzdálený — tablebase --------------------------------------------

/** a4 is an outside passer: white wins with either side to move. */
const OUTSIDE_WHITE = '8/5pk1/6p1/8/P7/6P1/5K2/8 w - - 0 1';
const OUTSIDE_BLACK = '8/5pk1/6p1/8/P7/6P1/5K2/8 b - - 0 1';
/** Only Kd4 and Ke4 win; Kc4 (to the a-pawn) and Ke3 only draw. */
const OUTSIDE_CENTRE = '8/5p2/6p1/k7/P7/3K2P1/8/8 w - - 0 1';
/** b5 is a protected passer; black to move loses (Kxc4 is met by b6). */
const PROTECTED = '8/8/2k3p1/1P6/2P5/8/6P1/5K2 b - - 0 1';

// ---- Dvě věže na sedmé řadě — Lichess puzzles JYlDu and uDZRp -----------------------------

const SEVENTH_WHITE = '5k2/3R1pRp/8/2rbB3/5P2/1r4P1/5K2/8 w - - 3 35';
const SEVENTH_WHITE_MATE = '6k1/3R1p1p/8/2rbB3/5P2/1r4P1/5K2/8 w - - 0 36';
const SEVENTH_BLACK = '1R6/7k/1R5p/P2p2p1/3P4/6PK/4rr2/8 b - - 1 39';
const SEVENTH_BLACK_2 = '1R6/7k/1R5p/P2p2p1/3P2K1/6P1/4r2r/8 b - - 3 40';
const SEVENTH_BLACK_3 = '1R6/7k/1R5p/P2p2p1/3Pr3/5KP1/7r/8 b - - 5 41';

// ---- Nestejnobarevní střelci a pevnost — tablebase ----------------------------------------

/** Two pawns up, and still a draw: every white move draws (Sg7 guards f6 and hits e5). */
const OCB_FORTRESS = '8/5kb1/8/4PP2/3K4/8/4B3/8 w - - 0 1';
/** Black to move: only Sg7 draws (and white to move would win here). */
const OCB_BUILD = '8/5k2/7b/4PP2/3K4/8/4B3/8 b - - 0 1';
/** The same but with a dark-squared white bishop: white wins. */
const SAME_COLOUR = '8/5kb1/8/4PP2/3K4/8/3B4/8 w - - 0 1';

// ---- Oběť kvality — Lichess puzzles Fu1rf and KwKzE ---------------------------------------

const EXCHANGE_1 = '3rr3/ppp2pk1/5p2/7p/3npP1P/PP2N1P1/2P2PK1/R2R4 w - - 3 21';
const EXCHANGE_1_FORK = '4r3/ppp2pk1/5p2/7p/3rpP1P/PP2N1P1/2P2PK1/R7 w - - 0 22';
const EXCHANGE_2 = '2k5/8/1p1R1p2/4n3/2P1P3/4K3/r2N4/8 b - - 4 50';
const EXCHANGE_2_FORK = '2k5/8/1p3p2/4n3/2P1P3/4K3/3R4/8 b - - 0 51';

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
        tbNarrow: 'The task names the fourth rank; waiting rook moves on the first rank win too.',
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
        completeness: { kind: 'promote', from: 'b7', to: 'b8', piece: 'q' },
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
    id: 'l5-tarrasch',
    level: 5,
    number: 3,
    title: 'Věž za volného pěšce',
    steps: [
      {
        id: 'rule',
        kind: 'show',
        fen: TARRASCH_ATTACK,
        shapes: [{ from: 'a5', brush: 'green' }],
        text: 'Tarraschovo pravidlo: věž patří za volného pěšce. Za tvého i za soupeřova.',
      },
      {
        id: 'behind-own',
        kind: 'move',
        fen: TARRASCH_ATTACK,
        movable: ['c1'],
        accept: ['c1a1'],
        completeness: { kind: 'lands', square: 'a1', from: 'c1' },
        text: 'Tvůj pěšec a5 je volný. Postav věž za něj.',
        success: 'Výborně! Čím dál pěšec dojde, tím víc místa má tvoje věž.',
        wrong: { c1c5: 'I to vyhrává, ale věž z boku je slabší. Postav ji za pěšce.' },
        wrongDefault: 'Tohle vyhru pustí. Věž patří na sloupec a, za pěšce.',
        tbNarrow: 'Only Va1 and Vc5 win; Vc5 is explained in `wrong`.',
      },
      {
        id: 'passive',
        kind: 'show',
        fen: TARRASCH_BEHIND,
        shapes: [
          { from: 'a8', brush: 'red' },
          { from: 'a1', brush: 'green' },
        ],
        text: 'Černá věž stojí před pěšcem a jen ho hlídá. Je pasivní. Tvoje věž za pěšcem je aktivní.',
      },
      {
        id: 'behind-theirs',
        kind: 'choose',
        fen: TARRASCH_DEFEND,
        orientation: 'black',
        text: 'Teď bráníš černými. Bílý pěšec b5 je volný. Kam s věží?',
        options: [
          { id: 'b1', label: 'Vb1' },
          { id: 'h8', label: 'Vh8' },
          { id: 'c1', label: 'Vc1' },
        ],
        correct: ['b1'],
        explain: 'Ano! Věž za pěšcem ho napadá zezadu a drží remízu.',
        wrongExplain: {
          h8: 'Z h8 je věž pasivní. Pěšec s pomocí věže a krále projde.',
          c1: 'Bílá věž c7 tvou věž vezme. Pěšec pak proběhne.',
        },
        wrongDefault: 'Věž patří za volného pěšce, i za soupeřova.',
        verify: { kind: 'tbmoves', moves: { b1: 'h1b1', h8: 'h1h8', c1: 'h1c1' } },
      },
      {
        id: 'summary',
        kind: 'show',
        fen: TARRASCH_DEFENDED,
        shapes: [{ from: 'b1', brush: 'green' }],
        text: 'Za pěšcem je věž nejsilnější. Ať pěšec dojde kamkoli, věž za ním má pořád volnou cestu.',
      },
    ],
    outro: 'Tarraschovo pravidlo: věž patří za volného pěšce. Za svého ho tlačí, za soupeřovým ho brzdí.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'rookEndgame', count: 3, label: 'Úlohy: věžová koncovka' }],
  },

  {
    id: 'l5-struktura-pescu',
    level: 5,
    number: 4,
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
    id: 'l5-volny-pesec',
    level: 5,
    number: 5,
    title: 'Volný pěšec: krytý a vzdálený',
    steps: [
      {
        id: 'passer',
        kind: 'show',
        fen: OUTSIDE_WHITE,
        shapes: [{ from: 'a4', brush: 'green' }],
        text: 'Volný pěšec: před ním ani na vedlejších sloupcích nestojí žádný soupeřův pěšec. Pěšcem ho nikdo nezastaví.',
      },
      {
        id: 'which-passer',
        kind: 'choose',
        fen: OUTSIDE_WHITE,
        text: 'Který bílý pěšec je volný?',
        options: [
          { id: 'a4', square: 'a4' },
          { id: 'g3', square: 'g3' },
        ],
        correct: ['a4'],
        explain: 'Ano! Před pěšcem a4 ani vedle něj nestojí žádný černý pěšec.',
        wrongExplain: { g3: 'Tenhle volný není. Před ním stojí černý pěšec g6.' },
        wrongDefault: 'Hledej pěšce, před kterým ani vedle kterého nestojí černý pěšec.',
      },
      {
        // Tablebase: black to move loses.
        id: 'outside',
        kind: 'choose',
        fen: OUTSIDE_BLACK,
        text: 'Pěšec a4 stojí daleko od ostatních. Je to vzdálený volný pěšec. Černý je na tahu. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['bily'],
        explain: 'Ano! Černý král musí běžet k pěšci a4. Mezitím tvůj král sebere černé pěšce.',
        wrongDefault: 'Černý král musí pěšce a4 hlídat. Kdo pak ohlídá černé pěšce?',
        verify: { kind: 'outcome' },
      },
      {
        // Tablebase: only Kd4 and Ke4 win; Kc4 (towards the a-pawn) only draws.
        id: 'centre',
        kind: 'move',
        fen: OUTSIDE_CENTRE,
        accept: ['d3d4', 'd3e4'],
        completeness: { kind: 'tablebase' },
        text: 'Černý král hlídá pěšce a4. Tvůj král musí stihnout obě strany. Najdi vyhrávající tah.',
        success: 'Výborně! Ze středu tvůj král stihne pěšce a4 i černé pěšce.',
        wrong: { d3c4: 'Tohle je jen remíza. U pěšce a4 je tvůj král moc daleko od černých pěšců.' },
        wrongDefault: 'Tenhle tah vyhru pustí. Tvůj král patří do středu šachovnice.',
      },
      {
        id: 'protected',
        kind: 'show',
        fen: PROTECTED,
        shapes: [
          { from: 'b5', brush: 'green' },
          { from: 'c4', to: 'b5', brush: 'blue' },
        ],
        text: 'Krytý volný pěšec: pěšec b5 je volný a kryje ho pěšec c4. Černý král ho nemůže vzít.',
      },
      {
        id: 'protected-why',
        kind: 'choose',
        fen: PROTECTED,
        text: 'Proč černý král nevezme aspoň pěšce c4?',
        options: [
          { id: 'utek', label: 'Pěšec b5 by mu utekl do dámy' },
          { id: 'kryty', label: 'Pěšec c4 je krytý' },
          { id: 'nesmi', label: 'Král nesmí brát pěšce' },
        ],
        correct: ['utek'],
        explain: 'Ano! Než král pěšce c4 sebere, pěšec b5 mu uteče. Král by byl mimo jeho čtverec.',
        wrongExplain: {
          kryty: 'Pěšce c4 nic nekryje. Jenže když ho král vezme, uteče mu pěšec b5.',
          nesmi: 'Král smí brát nekrytého pěšce. Háček je jinde: hlídej pěšce b5.',
        },
        wrongDefault: 'Podívej se, kam by mohl utéct pěšec b5.',
      },
    ],
    outro: 'Volný pěšec je síla. Vzdálený odláká soupeřova krále, krytý se sám ubrání.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'pawnEndgame', count: 3, label: 'Úlohy: pěšcová koncovka' }],
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

  {
    id: 'l5-dve-veze',
    level: 5,
    number: 8,
    title: 'Dvě věže na sedmé řadě',
    steps: [
      {
        // Lichess puzzle JYlDu, after 34...Rb3.
        id: 'idea',
        kind: 'show',
        fen: SEVENTH_WHITE,
        shapes: [
          { from: 'd7', brush: 'green' },
          { from: 'g7', brush: 'green' },
        ],
        text: 'Dvě věže na sedmé řadě jsou velmi silné. Berou pěšce a hrozí soupeřovu králi matem.',
      },
      {
        id: 'white-sac',
        kind: 'move',
        fen: SEVENTH_WHITE,
        accept: ['g7g8'],
        completeness: { kind: 'best' },
        text: 'Bílý dá mat 2. tahem. Najdi první tah.',
        success: 'Výborně! Král musí věž vzít: Kxg8.',
        wrongDefault: 'Tohle mat nedá. Obětuj věž g7 se šachem. Po Kxg8 dá mat druhá věž.',
      },
      {
        id: 'white-mate',
        kind: 'move',
        fen: SEVENTH_WHITE_MATE,
        accept: ['d7d8'],
        completeness: { kind: 'mate' },
        text: 'Král vzal věž. Dej mat.',
        success: 'Mat! Pole f8 hlídá věž, pole g7 a h8 střelec e5.',
        wrongDefault: 'Tohle mat není. Kam dojde věž d7 se šachem?',
      },
      {
        // Lichess puzzle uDZRp, after 39.Kh3.
        id: 'black-idea',
        kind: 'show',
        fen: SEVENTH_BLACK,
        orientation: 'black',
        shapes: [
          { from: 'e2', brush: 'green' },
          { from: 'f2', brush: 'green' },
        ],
        text: 'Teď hraješ za černé. Tvoje věže stojí na druhé řadě. Pro černého je to sedmá řada.',
      },
      {
        id: 'black-check',
        kind: 'move',
        fen: SEVENTH_BLACK,
        orientation: 'black',
        accept: ['f2h2'],
        completeness: { kind: 'best' },
        text: 'Dej mat 3. tahem. Začni šachem věží.',
        success: 'Výborně! Věž h2 kryje věž e2. Bílý král musí na g4.',
        wrongDefault: 'Tohle mat 3. tahem nedá. Šachuj věží po sloupci h.',
      },
      {
        id: 'black-check2',
        kind: 'move',
        fen: SEVENTH_BLACK_2,
        orientation: 'black',
        accept: ['e2e4'],
        completeness: { kind: 'best' },
        text: 'Král utekl na g4. Dej další šach.',
        success: 'Výborně! Král musí na f3.',
        wrongDefault: 'Šachuj druhou věží po čtvrté řadě.',
      },
      {
        id: 'black-mate',
        kind: 'move',
        fen: SEVENTH_BLACK_3,
        orientation: 'black',
        accept: ['g5g4'],
        completeness: { kind: 'mate' },
        text: 'Král šel na f3. Dej mat.',
        success: 'Mat! Obě věže a pěšec sebraly králi všechna pole.',
        wrongDefault: 'Tohle mat není. Zkus to pěšcem.',
      },
    ],
    outro: 'Dvě věže na sedmé řadě berou pěšce a honí krále. Často z toho je mat.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'rookEndgame', count: 3, label: 'Úlohy: věžová koncovka' }],
  },

  {
    id: 'l5-dva-strelci',
    level: 5,
    number: 9,
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
    number: 10,
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
    id: 'l5-nestejnobarevni',
    level: 5,
    number: 11,
    title: 'Nestejnobarevní střelci a pevnost',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: OCB_FORTRESS,
        shapes: [
          { from: 'e2', brush: 'yellow' },
          { from: 'g7', brush: 'blue' },
        ],
        text: 'Nestejnobarevní střelci: bílý chodí po světlých polích, černý po tmavých. Nikdy se nepotkají.',
      },
      {
        // Tablebase: draw with white to move (every white move draws).
        id: 'outcome',
        kind: 'choose',
        fen: OCB_FORTRESS,
        text: 'Bílý má o dva pěšce víc a je na tahu. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['remiza'],
        explain: 'Ano, remíza! Černý se ubrání, i když má o dva pěšce méně.',
        wrongDefault: 'Bílý má víc pěšců, a přesto nevyhraje. Podívej se, co hlídá černý střelec.',
        verify: { kind: 'outcome' },
      },
      {
        id: 'fortress',
        kind: 'show',
        fen: OCB_FORTRESS,
        shapes: [
          { from: 'g7', to: 'e5', brush: 'blue' },
          { from: 'e6', brush: 'blue' },
          { from: 'f6', brush: 'blue' },
        ],
        text: 'Černý král a střelec hlídají pole před pěšci. Pěšci se k proměně nedostanou. Tomu se říká pevnost.',
      },
      {
        // Tablebase: only Sg7 draws.
        id: 'build',
        kind: 'move',
        fen: OCB_BUILD,
        orientation: 'black',
        accept: ['h6g7'],
        completeness: { kind: 'tablebase' },
        text: 'Hraješ černými. Postav pevnost. Jen jeden tah drží remízu.',
        success: 'Pevnost stojí! Střelec g7 hlídá pole f6 a napadá pěšce e5.',
        wrongDefault: 'Tenhle tah prohrává. Střelec musí hlídat pole f6 a napadat pěšce e5.',
      },
      {
        // Tablebase: white to move wins.
        id: 'same-colour',
        kind: 'choose',
        fen: SAME_COLOUR,
        text: 'Teď chodí bílý střelec po tmavých polích, stejně jako černý. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['bily'],
        explain: 'Bílý vyhraje. Jeho střelec teď bojuje o tmavá pole a pevnost padne.',
        wrongDefault: 'Bílý střelec teď může vyhnat černého z tmavých polí. Pevnost nevydrží.',
        verify: { kind: 'outcome' },
      },
    ],
    outro: 'S nestejnobarevnými střelci se často ubráníš i bez dvou pěšců. Postav pevnost na polích barvy svého střelce.',
    practice: [{ kind: 'play', level: 5, label: 'Zahraj si partii a všímej si barvy střelců' }],
  },

  {
    id: 'l5-obet-kvality',
    level: 5,
    number: 12,
    title: 'Oběť kvality',
    steps: [
      {
        // Lichess puzzle Fu1rf, after 20...Kg7.
        id: 'idea',
        kind: 'show',
        fen: EXCHANGE_1,
        text: 'Kvalita je rozdíl mezi věží a jezdcem nebo střelcem. Oběť kvality: dáš věž za jezdce nebo střelce.',
      },
      {
        id: 'value',
        kind: 'choose',
        fen: EXCHANGE_1,
        text: 'Věž má cenu 5 pěšců, jezdec 3. O kolik přijdeš, když dáš věž za jezdce?',
        options: [
          { id: '1', label: 'O 1 pěšce' },
          { id: '2', label: 'O 2 pěšce' },
          { id: '3', label: 'O 3 pěšce' },
        ],
        correct: ['2'],
        explain: 'Ano, asi o dva pěšce. Oběť se vyplatí, jen když za ni dostaneš víc.',
        wrongDefault: 'Spočítej to: 5 minus 3.',
      },
      {
        id: 'sac1',
        kind: 'move',
        fen: EXCHANGE_1,
        accept: ['d1d4'],
        completeness: { kind: 'best' },
        text: 'Najdi oběť kvality. Po ní přijde vidlička.',
        success: 'Výborně! Černý vzal věží zpátky: Vxd4.',
        wrongDefault: 'Vezmi věží jezdce d4. Po Vxd4 napadne tvůj jezdec krále i věž.',
      },
      {
        id: 'fork1',
        kind: 'move',
        fen: EXCHANGE_1_FORK,
        accept: ['e3f5'],
        completeness: { kind: 'best' },
        text: 'Teď vidlička.',
        success: 'Výborně! Jezdec napadá krále i věž d4. Věž pak vezmeš a máš figuru navíc.',
        wrongDefault: 'Skoč jezdcem se šachem na f5. Napadne krále i věž d4.',
      },
      {
        // Lichess puzzle KwKzE, after 50.Ke3.
        id: 'sac2',
        kind: 'move',
        fen: EXCHANGE_2,
        orientation: 'black',
        accept: ['a2d2'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé. Obětuj kvalitu a vyhraj figuru.',
        success: 'Výborně! Bílý vzal zpátky: Vxd2. Teď přijde vidlička.',
        wrongDefault: 'Vezmi věží jezdce d2. Po Vxd2 přijde vidlička Jxc4+.',
      },
      {
        id: 'fork2',
        kind: 'move',
        fen: EXCHANGE_2_FORK,
        orientation: 'black',
        accept: ['e5c4'],
        completeness: { kind: 'best' },
        text: 'Teď vidlička.',
        success: 'Vidlička! Jezdec napadá krále i věž. Po útěku krále vezmeš věž.',
        wrongDefault: 'Vezmi jezdcem pěšce c4 se šachem. Napadneš krále i věž d2.',
      },
      {
        id: 'summary',
        kind: 'show',
        fen: EXCHANGE_2_FORK,
        orientation: 'black',
        text: 'Oběť kvality se vyplatí, když za ni hned něco dostaneš. Třeba vidličku, mat nebo silný útok.',
      },
    ],
    outro: 'Oběť kvality: dáš věž za lehkou figuru. Nejdřív ale propočítej, co za ni dostaneš.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'sacrifice', count: 5, label: 'Úlohy: oběť' }],
  },

  {
    id: 'l5-zkouska',
    level: 5,
    number: 13,
    title: 'Zkouška úrovně 5',
    test: {
      passScore: 9,
      badge: 'l5',
      failOutro: 'Tentokrát to nevyšlo. Zopakuj si lekce, kde to drhlo, a zkus to znovu.',
    },
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        diagram: true,
        text: 'Zkouška úrovně 5! Čeká tě 11 úloh. Na každou máš jen jeden pokus a žádnou nápovědu.',
      },
      {
        // Endgame lucena-1. Tablebase: Vb4 wins, and so do Kc6/Ka6 (they only repeat).
        id: 't-lucena',
        kind: 'move',
        fen: '8/1P2k3/8/1K6/3R4/8/1r6/8 w - - 0 1',
        movable: ['d4'],
        accept: ['d4b4'],
        completeness: { kind: 'lands', square: 'b4', from: 'd4' },
        text: 'Postav most: zakryj šach věží.',
        success: 'Správně! Vb4 zastavila šachy. Pěšec teď dojde do dámy.',
        wrongDefault: 'Most staví věž na b4. Zakryje šach a černá věž už šachovat nemůže.',
        tbNarrow: 'The task asks to block the check with the rook; the king moves Kc6/Ka6 only repeat.',
      },
      {
        // Endgame philidor-3. Tablebase: Vb6 and Vb1–Vb4 draw; Vb7 and Vd8 lose.
        id: 't-philidor',
        kind: 'choose',
        fen: '1r2k3/7R/8/3PK3/8/8/8/8 b - - 0 1',
        orientation: 'black',
        text: 'Hraješ černými. Kam s věží, aby udržela remízu?',
        options: [
          { id: 'b6', label: 'Vb6' },
          { id: 'b7', label: 'Vb7' },
          { id: 'd8', label: 'Vd8' },
        ],
        correct: ['b6'],
        explain: 'Správně! Věž na šesté řadě nepustí bílého krále dopředu.',
        wrongDefault: 'Věž patří na šestou řadu. Bílý král tam pak nevstoupí.',
        verify: { kind: 'tbmoves', moves: { b6: 'b8b6', b7: 'b8b7', d8: 'b8d8' } },
      },
      {
        // l5-tarrasch's defence mirrored (a↔h). Tablebase: Vg1, Ve1, Va5 draw.
        id: 't-tarrasch',
        kind: 'choose',
        fen: '8/5R2/2k5/6P1/3K4/8/8/r7 b - - 0 1',
        orientation: 'black',
        text: 'Hraješ černými. Kam s věží proti volnému pěšci g5?',
        options: [
          { id: 'g1', label: 'Vg1' },
          { id: 'a8', label: 'Va8' },
          { id: 'f1', label: 'Vf1' },
        ],
        correct: ['g1'],
        explain: 'Správně! Věž patří za volného pěšce, i za soupeřova.',
        wrongDefault: 'Tarraschovo pravidlo: věž patří za volného pěšce. I za soupeřova.',
        verify: { kind: 'tbmoves', moves: { g1: 'a1g1', a8: 'a1a8', f1: 'a1f1' } },
      },
      {
        id: 't-isolated',
        kind: 'choose',
        fen: '4k3/pp3ppp/8/8/3P4/8/PP3PPP/4K3 w - - 0 1',
        text: 'Který bílý pěšec je izolovaný?',
        options: [
          { id: 'd4', square: 'd4' },
          { id: 'b2', square: 'b2' },
          { id: 'f2', square: 'f2' },
        ],
        correct: ['d4'],
        explain: 'Správně! Pěšec d4 nemá vlastního pěšce na sloupci c ani e.',
        wrongDefault: 'Izolovaný pěšec nemá vlastního pěšce na vedlejších sloupcích. To je d4.',
      },
      {
        // l5-volny-pesec's outside passer mirrored (a↔h). Tablebase: black to move loses.
        id: 't-outside',
        kind: 'choose',
        fen: '8/1kp5/1p6/8/7P/1P6/2K5/8 b - - 0 1',
        text: 'Černý je na tahu. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['bily'],
        explain: 'Správně! Vzdálený volný pěšec h4 odláká černého krále. Bílý král mezitím sebere černé pěšce.',
        wrongDefault: 'Bílý vyhraje. Vzdálený volný pěšec h4 odláká černého krále od jeho pěšců.',
        verify: { kind: 'outcome' },
      },
      {
        id: 't-bad-bishop',
        kind: 'choose',
        fen: '4k3/8/8/2P1P3/3P4/8/8/2B1KB2 w - - 0 1',
        text: 'Který bílý střelec je špatný?',
        options: [
          { id: 'c1', square: 'c1' },
          { id: 'f1', square: 'f1' },
        ],
        correct: ['c1'],
        explain: 'Správně! Pěšci c5, d4 a e5 stojí na tmavých polích a zavírají střelci c1 cestu.',
        wrongDefault: 'Špatný je střelec c1. Vlastní pěšci stojí na tmavých polích, jeho barvě.',
      },
      {
        // Lichess puzzle eXE9H, after 35.Kg1 (Jh3+ Kh1 Vh2#).
        id: 't-seventh',
        kind: 'move',
        fen: '5k2/6p1/p1B5/1p2R1p1/2P2nP1/1P6/P2r1r2/4R1K1 b - - 3 35',
        orientation: 'black',
        accept: ['f4h3'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé. Tvoje věže stojí na sedmé řadě. Dej mat 2. tahem.',
        success: 'Správně! Po Kh1 dá věž mat na h2.',
        wrongDefault: 'Šach jezdcem Jh3+ zažene krále do rohu. Pak dá věž mat na h2.',
      },
      {
        id: 't-two-bishops',
        kind: 'move',
        fen: '7k/5K2/8/5B2/8/6B1/8/8 w - - 0 1',
        accept: ['g3e5'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Správně! Střelec e5 šachuje a druhý střelec hlídá pole h7.',
        wrongDefault: 'Mat dá Se5. Šachuje po úhlopříčce a pole h7 hlídá střelec f5.',
      },
      {
        // Lichess puzzle egfIi, after 16...Qxa1 (Vxf8+ Vxf8 De7#).
        id: 't-sacrifice',
        kind: 'move',
        fen: 'r1bk1b1r/5Rpp/p1pP4/8/2B5/6P1/P1P1Q1P1/qN5K w - - 0 17',
        accept: ['f7f8'],
        completeness: { kind: 'best' },
        text: 'Obětuj figuru a dej mat 2. tahem.',
        success: 'Správně! Po Vxf8 přijde De7 mat.',
        wrongDefault: 'Obětuj věž Vxf8+. Po Vxf8 dá dáma mat na e7.',
      },
      {
        // l5-nestejnobarevni's fortress mirrored (a↔h). Tablebase: draw.
        id: 't-opposite-bishops',
        kind: 'choose',
        fen: '8/1bk5/8/2PP4/4K3/8/3B4/8 w - - 0 1',
        text: 'Bílý je na tahu a má o dva pěšce víc. Jak to dopadne?',
        options: [
          { id: 'bily', label: 'Bílý vyhraje' },
          { id: 'remiza', label: 'Remíza' },
          { id: 'cerny', label: 'Černý vyhraje' },
        ],
        correct: ['remiza'],
        explain: 'Správně! Nestejnobarevní střelci a pevnost: černý se ubrání.',
        wrongDefault: 'Remíza. Černý král a střelec staví pevnost, pěšci neprojdou.',
        verify: { kind: 'outcome' },
      },
      {
        // Lichess puzzle Dl1ZB, after 43.Dg6 (Vxd5 cxd5 Vxg7: the rook pins the queen).
        id: 't-exchange',
        kind: 'move',
        fen: '3r2k1/p1p2rP1/5pQp/3B4/2P4P/3PP3/2P2RK1/2q5 b - - 4 43',
        orientation: 'black',
        accept: ['d8d5'],
        completeness: { kind: 'best' },
        text: 'Hraješ za černé. Obětuj kvalitu a vyhraj víc.',
        success: 'Správně! Po cxd5 vezme věž Vxg7 a dáma g6 je vázaná. Padne.',
        wrongDefault: 'Vezmi věží střelce d5. Po cxd5 přijde Vxg7 a bílá dáma je vázaná ke králi.',
      },
    ],
    outro: 'Zkouška je za tebou! Odznak je tvůj a můžeš si vytisknout diplom.',
    practice: [{ kind: 'play', level: 6, label: 'Zahraj si partii proti silnějšímu soupeři' }],
  },
];
