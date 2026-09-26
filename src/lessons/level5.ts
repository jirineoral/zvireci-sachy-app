/**
 * Level 5 — Pokročilý. First batch (docs/phase-22-plan.md, generation order 3): lessons 1,
 * 2, 9 and 10 of the plan's curriculum — the mechanically checkable ones (endgames `lucena`,
 * `philidor`, `bb`; two verified classic games). Shipped here as lessons 1–4 in course order;
 * the plan's own numbering is not preserved (docs/phase-22-plan.md note on gaps) — the rest
 * of level 5 (izolovaný/zdvojený/opožděný pěšec, dobrý/špatný střelec, slabé pole a forpost,
 * and later the tablebase-checked lessons) is appended by later commits. No level test yet.
 *
 * Rook endgames: many moves keep the result, so `lucena` and `philidor` use only show/choose
 * steps for the technique itself (Stockfish gives no clean, large-margin "only move" at the
 * key decisions — checked by hand with the project's own engine before writing this file);
 * the one `move` task per lesson is a plain, forced promotion, checked deterministically
 * (`lands`), not by engine margin.
 *
 * Lesson 4 (Slavné kombinace): both games replayed and verified move by move with chess.js
 * against the published game scores (Anderssen–Kieseritzky, London 1851, "The Immortal
 * Game"; Lasker–Bauer, Amsterdam 1889, the first "double bishop sacrifice") before writing
 * the FENs below — see the report for sources. The queen sacrifice task (Df6+) is graded
 * with `marginCp: 0`: at depth 20 the project's engine found a second, nearly-as-fast mate
 * (Dxf7) about 2 cp behind; `npm run check:lessons` is the final authority on the accepted
 * set (it may need Dxf7 added if depth 18 ties them).
 */
import type { Lesson } from './types';

// ---- Lesson 1: Lucenova pozice (stavba mostu) --------------------------------------------

const LUCENA_START = '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1';
/** White has built the bridge: Vb4 blocks the check Vb1+ on the king at b6. */
const LUCENA_BRIDGE = '8/1P1k4/1K6/8/1R6/8/8/1r6 b - - 0 1';
/** King out of the way, no more checks: just push the pawn. */
const LUCENA_PROMOTE = '6k1/1PK5/8/8/1R6/8/8/8 w - - 0 1';

// ---- Lesson 2: Philidorova pozice -----------------------------------------------------

const PHILIDOR_START = '4k3/8/r7/3PK3/8/8/8/7R b - - 0 1';
/** The pawn has reached the sixth rank: the blockade on that rank no longer holds it back. */
const PHILIDOR_PAWN_D6 = '4k3/8/r2P4/4K3/8/8/8/7R b - - 0 1';
/** The rook has gone behind, far enough that the white king cannot reach it. */
const PHILIDOR_BEHIND = '4k3/8/3P4/4K3/8/8/8/r6R b - - 0 1';

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
        text: 'Bílý pěšec chce na pole b8. Ale vlastní král mu tam stojí v cestě.',
      },
      {
        id: 'checks',
        kind: 'show',
        fen: LUCENA_START,
        shapes: [{ from: 'a2', to: 'a8', brush: 'blue' }],
        text: 'Když král uhne stranou, černá věž začne šachovat zezadu. Král by musel pořád utíkat.',
      },
      {
        id: 'plan',
        kind: 'choose',
        fen: LUCENA_START,
        text: 'Kam se hodí postavit věž, aby ti pozdější šachy nevadily?',
        options: [
          { id: 'c4', square: 'c4' },
          { id: 'h1', square: 'h1' },
          { id: 'c7', square: 'c7' },
        ],
        correct: ['c4'],
        explain: 'Ano! Odsud věž pozdější šach zastaví. Tomu se říká stavba mostu.',
        wrongExplain: {
          h1: 'Odtud věž pozdější šach nezastaví. Je moc daleko od pěšce.',
          c7: 'Odtud věž zavazí vlastnímu králi. Nemá odkud zastavit šach.',
        },
        wrongDefault: 'Věž má stát blízko pěšce, ne moc blízko ani moc daleko.',
      },
      {
        id: 'bridge',
        kind: 'show',
        fen: LUCENA_BRIDGE,
        shapes: [{ from: 'b1', to: 'b4', brush: 'red' }],
        text: 'Tomu se říká stavba mostu. Bílá věž na čtvrté řadě zastaví šach věže b1.',
      },
      {
        id: 'why',
        kind: 'show',
        fen: LUCENA_BRIDGE,
        text: 'Černá věž už šachovat nemůže. Cestu jí zavírá vlastní bílá věž.',
      },
      {
        id: 'promote',
        kind: 'move',
        fen: LUCENA_PROMOTE,
        movable: ['b7'],
        accept: ['b7b8q', 'b7b8r', 'b7b8b', 'b7b8n'],
        completeness: { kind: 'lands', square: 'b8' },
        text: 'Král už nestojí v cestě a šach nehrozí. Proměň pěšce.',
        success: 'Vyhráno! Most postavený, král uhnutý, pěšec doma.',
        wrongDefault: 'Tím se pěšec nepromění. Táhni pěšcem na poslední řadu.',
      },
    ],
    outro: 'Umíš stavbu mostu! Věž na čtvrté řadě zastaví šach a král může projít.',
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
        text: 'Bílý má navíc pěšce. Černý ale umí udržet remízu, když brání správně.',
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
        text: 'Pěšec došel na šestou řadu. Teď už tam věž sama nestačí.',
      },
      {
        id: 'switch',
        kind: 'choose',
        fen: PHILIDOR_PAWN_D6,
        text: 'Kam teď pojede černá věž?',
        options: [
          { id: 'a1', square: 'a1' },
          { id: 'a5', square: 'a5' },
          { id: 'g6', square: 'g6' },
        ],
        correct: ['a1'],
        explain: 'Ano! Věž jde dozadu a odtud bude šachovat krále.',
        wrongExplain: {
          a5: 'Odtud by král na věž brzy dosáhl. Musí být dál.',
          g6: 'Odtud věž krále nešachuje. Nepomůže ti to.',
        },
        wrongDefault: 'Věž má jít za krále, odkud bude moct šachovat.',
      },
      {
        id: 'behind',
        kind: 'show',
        fen: PHILIDOR_BEHIND,
        shapes: [{ from: 'a1', to: 'e1', brush: 'red' }],
        text: 'Věž šachuje zezadu, z bezpečné dálky. Král na ni nedosáhne.',
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
        wrongDefault: 'Zkus najít pole, kam by král před šachem utekl. Žádné takové není.',
      },
    ],
    outro: 'Umíš Philidorovu pozici! Věž drž na šesté řadě, a když pěšec postoupí, šachuj zezadu.',
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
        text: 'Jeden střelec sám o sobě mat nedá. Dva střelci spolu ano.',
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
        text: 'S jedním střelcem matuješ jen v rohu jeho barvy. Se dvěma v kterémkoli rohu.',
      },
      {
        id: 'corner',
        kind: 'show',
        fen: BB_PRE_MATE,
        text: 'Král je zahnaný do rohu. Tvůj král i oba střelci mu hlídají všechna pole.',
      },
      {
        id: 'mate',
        kind: 'move',
        fen: BB_PRE_MATE,
        accept: ['h6g7'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Mat! Král krytý vlastním střelcem nemá kam utéct.',
        wrongDefault: 'To není mat. Hledej tah střelcem, po kterém král nemá žádné pole.',
      },
    ],
    outro: 'Umíš mat dvěma střelci! Zeď je zažene do rohu, král pomůže domatovat.',
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
        text: 'Anderssen–Kieseritzky, Londýn 1851. Bílý obětuje dámu, aby otevřel cestu k matu.',
      },
      {
        id: 'qf6',
        kind: 'move',
        fen: IMMORTAL_BEFORE_QF6,
        accept: ['f3f6'],
        completeness: { kind: 'best', marginCp: 0 },
        text: 'Najdi šach dámou, po kterém ji černý musí vzít.',
        success: 'Paráda! Dáma jde do jámy lvové, ale otevírá cestu jezdci a střelci.',
        wrongDefault: 'Hledej tah dámou, který dá šach a nabídne se k braní.',
      },
      {
        id: 'why',
        kind: 'show',
        fen: IMMORTAL_BEFORE_SE7,
        text: 'Černý dámu vzal jezdcem. Cesta pro tvého střelce je teď volná.',
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
        success: 'Výborně! Král musí střelce vzít, jinak o něj přijde zadarmo.',
        wrongDefault: 'Hledej tah střelcem, který obětuje figurku, ale dá šach.',
      },
      {
        id: 'second',
        kind: 'show',
        fen: LASKER_BAUER_BEFORE_SXG7,
        text: 'Král vzal, dostal další šach a utekl do rohu. Druhý střelec udělá to samé.',
      },
      {
        id: 'sxg7',
        kind: 'move',
        fen: LASKER_BAUER_BEFORE_SXG7,
        accept: ['e5g7'],
        completeness: { kind: 'best' },
        text: 'Obětuj i druhého střelce.',
        success: 'Druhá oběť! Král je teď úplně odkrytý, bez pěšcové ochrany.',
        wrongDefault: 'Hledej tah druhým střelcem, který taky obětuje figurku.',
      },
    ],
    outro: 'Oběť se vyplatí, když otevře cestu ke králi. Slavné partie to dokazují už přes sto let.',
    practice: [{ kind: 'puzzles', band: 'tezsi', theme: 'sacrifice', count: 5, label: 'Úlohy: oběť' }],
  },
];
