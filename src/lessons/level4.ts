/**
 * Level 4 — Středně pokročilý (docs/phase-22-plan.md, curriculum). Phase 22 ships only the
 * mechanically checkable subset: plan lessons 1–7 and 12 (tactics with big margins or forced
 * mates, and the "rook/queen vs pawn" pointers). Plan lessons 8–11 (věčný šach/pat, klíčová
 * pole, trojúhelník, průlom) need a tablebase checker and are NOT here — see the plan's
 * generation order. There is no level test yet (it needs the full level).
 *
 * `number` is 1..8, the position in this array (scripts/check-lessons.mjs requires
 * `number === index + 1`). The plan's own numbering has a gap (8–11 come later); each
 * lesson's doc comment below says which plan lesson it is, so a future author inserting the
 * missing lessons knows where to splice them in and can renumber 8→12 etc. at that point.
 *
 * Positions are either invented (small, engine/chess.js-checked) or two verified classic
 * games, replayed move by move against chess.js before use: Carlos Torre – Emanuel Lasker,
 * Moscow 1925 (the windmill, from chessgames.com/chesshistory sources) and Richard Réti –
 * Savielly Tartakower, Vienna 1910 (Réti's mate). Moves not proven forced (the greek-gift
 * sacrifice, the quiet-move and mate-in-3 puzzles) use deterministic completeness kinds
 * (`lands`/`captures`/`mate`) rather than `best`, so no Stockfish judgement call is needed —
 * see the report handed back with this file for the ones worth a strong player's second look.
 */
import type { Lesson } from './types';

export const LEVEL4: readonly Lesson[] = [
  // plan lesson 1: Uvolnění (clearance)
  {
    id: 'l4-uvolneni',
    level: 4,
    number: 1,
    title: 'Uvolnění',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: '6k1/5ppp/8/8/8/8/3N4/2B3K1 w - - 0 1',
        shapes: [
          { from: 'd2', brush: 'red' },
          { from: 'c1', to: 'h6', brush: 'blue' },
        ],
        text: 'Uvolnění: uhneš vlastní figurkou z cesty. Uvolníš tak pole nebo linii jiné svojí figurce.',
      },
      {
        id: 'clear-knight',
        kind: 'move',
        fen: '6k1/5ppp/8/8/8/8/3N4/2B3K1 w - - 0 1',
        movable: ['d2'],
        accept: ['d2e4'],
        completeness: { kind: 'lands', square: 'e4', from: 'd2' },
        text: 'Střelec c1 chce na aktivní pole h6, ale jezdec mu stojí v cestě. Uvolni mu ji.',
        success: 'Výborně! Diagonála c1–h6 je teď volná pro střelce.',
        wrong: { d2b1: 'Tam jezdec neuvolní nic užitečného. Najdi mu aktivnější pole.' },
        wrongDefault: 'Tohle diagonálu neuvolní. Zkus jiné pole pro jezdce.',
      },
      {
        id: 'pawn-clear',
        kind: 'move',
        fen: '4k3/8/3p1p2/4P3/2N5/8/8/4K3 w - - 0 1',
        movable: ['e5'],
        accept: ['e5d6', 'e5f6'],
        completeness: { kind: 'captures', from: 'e5' },
        text: 'Uvolnění umí i pěšec. Vezmi pěšcem a uvolni pole e5 pro jezdce.',
        success: 'Výborně! Teď může jezdec skočit na volné pole e5.',
        wrong: { e5e6: 'To taky uvolní pole e5, ale nic nezískáš. Radši vezmi pěšce.' },
        wrongDefault: 'Tenhle tah pole e5 neuvolní. Zkus vzít pěšce d6 nebo f6.',
      },
      {
        id: 'rook-idea',
        kind: 'show',
        fen: '6k1/1pp2ppp/2p5/8/B7/8/8/R5K1 w - - 0 1',
        shapes: [
          { from: 'a4', brush: 'red' },
          { from: 'a1', to: 'a7', brush: 'blue' },
        ],
        text: 'Věž a1 by chtěla na sedmou řadu, ale svůj střelec jí stojí v cestě.',
      },
      {
        id: 'rook-clear',
        kind: 'move',
        fen: '6k1/1pp2ppp/2p5/8/B7/8/8/R5K1 w - - 0 1',
        movable: ['a4'],
        accept: ['a4c6'],
        completeness: { kind: 'captures', from: 'a4' },
        text: 'Uvolni věži cestu. Vezmi pěšce c6 střelcem.',
        success: 'Výborně! Věž a1 teď dosáhne na sedmou řadu.',
        wrongDefault: 'Tohle věži cestu neuvolní. Zkus vzít pěšce c6.',
      },
    ],
    outro: 'Uvolnění: uhni vlastní figurkou z pole nebo linie, kterou potřebuje jiná tvoje figurka.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'clearance', count: 5, label: 'Úlohy: uvolnění' }],
  },

  // plan lesson 2: Přerušení (interference)
  {
    id: 'l4-preruseni',
    level: 4,
    number: 2,
    title: 'Přerušení',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: 'r3n1k1/5ppp/8/5B2/8/8/8/4R1K1 w - - 0 1',
        shapes: [
          { from: 'a8', to: 'e8', brush: 'blue' },
          { from: 'c8', brush: 'green' },
        ],
        text: 'Přerušení: postavíš svou figurku mezi dvě soupeřovy. Přerušíš tak jejich spojení.',
      },
      {
        id: 'find-square',
        kind: 'choose',
        fen: 'r3n1k1/5ppp/8/5B2/8/8/8/4R1K1 w - - 0 1',
        text: 'Které pole přeruší obranu věže a8? Střelec tam musí dosáhnout.',
        options: [
          { id: 'b8', square: 'b8' },
          { id: 'c8', square: 'c8' },
          { id: 'd8', square: 'd8' },
        ],
        correct: ['c8'],
        verify: { kind: 'reachable', from: 'f5' },
        explain: 'Ano! Střelec tam dosáhne a přeruší obranu věže a8.',
        wrongDefault: 'Tam střelec nedosáhne. Hledej pole na jeho úhlopříčce.',
      },
      {
        id: 'block',
        kind: 'move',
        fen: 'r3n1k1/5ppp/8/5B2/8/8/8/4R1K1 w - - 0 1',
        movable: ['f5'],
        accept: ['f5c8'],
        completeness: { kind: 'lands', square: 'c8', from: 'f5' },
        text: 'Postav střelce mezi věž a8 a jezdce e8.',
        success: 'Výborně! Věž a8 už jezdce e8 nebrání.',
        wrongDefault: 'Tenhle tah obranu nepřeruší. Najdi pole mezi věží a8 a jezdcem e8.',
      },
      {
        id: 'result',
        kind: 'show',
        fen: 'r1B1n1k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
        shapes: [{ from: 'e1', to: 'e8', brush: 'red' }],
        text: 'Teď je jezdec e8 bez obrany. Ve8 ho vezme zadarmo.',
      },
      {
        id: 'second-example',
        kind: 'move',
        fen: '3b3r/2k5/6N1/8/8/8/8/3R2K1 w - - 0 1',
        movable: ['g6'],
        accept: ['g6f8'],
        completeness: { kind: 'lands', square: 'f8', from: 'g6' },
        text: 'Zkus to samou myšlenkou jinou figurkou. Skoč jezdcem mezi věž h8 a střelce d8.',
        success: 'Výborně! Věž h8 už střelce d8 nebrání.',
        wrongDefault: 'Tenhle skok obranu nepřeruší. Hledej pole mezi věží h8 a střelcem d8.',
      },
    ],
    outro: 'Přerušení: postav svou figurku mezi dvě soupeřovy. Příště pak vyhraješ tu nebráněnou.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'interference', count: 5, label: 'Úlohy: přerušení' }],
  },

  // plan lesson 3: Mlýn (Torre–Lasker, Moscow 1925)
  {
    id: 'l4-mlyn',
    level: 4,
    number: 3,
    title: 'Mlýn',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: 'r3rnk1/pb3pp1/3ppB1p/7q/1P1P4/4N1R1/P4PPP/4R1K1 w - - 0 26',
        text: 'Slavná partie: Carlos Torre proti Emanueli Laskerovi, Moskva 1925. Bílá věž teď spustí mlýn.',
      },
      {
        id: 'check1',
        kind: 'move',
        fen: 'r3rnk1/pb3pp1/3ppB1p/7q/1P1P4/4N1R1/P4PPP/4R1K1 w - - 0 26',
        movable: ['g3'],
        accept: ['g3g7'],
        completeness: { kind: 'captures', from: 'g3' },
        text: 'Vezmi pěšce g7 se šachem.',
        success: 'Výborně! Šach a bere pěšce. Král musí pryč.',
        wrongDefault: 'Zkus věží vzít pěšce g7 se šachem.',
      },
      {
        id: 'again',
        kind: 'show',
        fen: 'r3rn1k/pb3pR1/3ppB1p/7q/1P1P4/4N3/P4PPP/4R1K1 w - - 1 27',
        text: 'Král musí pryč. Věž bere dalšího pěšce se šachem. Tomu se říká mlýn.',
      },
      {
        id: 'check2',
        kind: 'move',
        fen: 'r3rn1k/pb3pR1/3ppB1p/7q/1P1P4/4N3/P4PPP/4R1K1 w - - 1 27',
        movable: ['g7'],
        accept: ['g7f7'],
        completeness: { kind: 'captures', from: 'g7' },
        text: 'Vezmi dalšího pěšce se šachem.',
        success: 'Paráda! Další pěšec padl a král zase utíká.',
        wrongDefault: 'Zkus věží vzít pěšce f7 se šachem.',
      },
      {
        id: 'why',
        kind: 'show',
        fen: 'r3rn1k/p5R1/3ppB1p/7q/1P1P4/4N3/P4PPP/4R1K1 w - - 3 29',
        text: 'Král na věž nikdy nedosáhne. Věž pokaždé uteče na bezpečné pole se šachem.',
      },
      {
        id: 'final',
        kind: 'move',
        fen: 'r3rn2/p6k/3ppB1p/6Rq/1P1P4/4N3/P4PPP/4R1K1 w - - 5 32',
        movable: ['g5'],
        accept: ['g5h5'],
        completeness: { kind: 'captures', from: 'g5' },
        text: 'Mlýn se blíží ke konci. Vezmi dámu.',
        success: 'Mlýn skončil. Bílý získal dámu a spoustu pěšců za jednu věž.',
        wrongDefault: 'Zkus věží vzít dámu na poli h5.',
      },
    ],
    outro: 'Mlýn: věž nebo střelec dokola šachuje a bere. Král se schová, ale nemůže nic dělat.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'discoveredCheck', count: 5, label: 'Úlohy: odtažný šach' }],
  },

  // plan lesson 4: Dvojšach a odtažný útok (Réti–Tartakower, Vienna 1910)
  {
    id: 'l4-dvojsach',
    level: 4,
    number: 4,
    title: 'Dvojšach a odtažný útok',
    steps: [
      {
        id: 'intro',
        kind: 'show',
        fen: 'rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9',
        text: 'Partie Richard Réti proti Saviellymu Tartakowerovi, Vídeň 1910. Bílý teď obětuje dámu.',
      },
      {
        id: 'sac',
        kind: 'move',
        fen: 'rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9',
        movable: ['d3'],
        accept: ['d3d8'],
        completeness: { kind: 'lands', square: 'd8', from: 'd3' },
        text: 'Dej šach dámou na poli d8.',
        success: 'Šach! Král dámu musí vzít, jinak o ni přijde jinak.',
        wrongDefault: 'Zkus přesunout dámu na pole d8.',
      },
      {
        id: 'forced',
        kind: 'show',
        fen: 'rnbk1b1r/pp3ppp/2p5/4q3/4n3/8/PPPB1PPP/2KR1BNR w - - 0 10',
        text: 'Král dámu vzal. Teď přijde druhý úder — odtažný útok se šachem navíc.',
      },
      {
        id: 'double-check',
        kind: 'move',
        fen: 'rnbk1b1r/pp3ppp/2p5/4q3/4n3/8/PPPB1PPP/2KR1BNR w - - 0 10',
        movable: ['d2'],
        accept: ['d2g5'],
        completeness: { kind: 'lands', square: 'g5', from: 'd2' },
        text: 'Uhni střelcem na g5. Uvolníš tak i cestu věži.',
        success: 'Dvojšach! Šachují věž i střelec naráz. Král musí pryč.',
        wrongDefault: 'Zkus přesunout střelce na pole g5.',
      },
      {
        id: 'only-king',
        kind: 'choose',
        fen: 'rnbk1b1r/pp3ppp/2p5/4q1B1/4n3/8/PPP2PPP/2KR1BNR b - - 1 10',
        text: 'Co smí černý proti dvojšachu?',
        options: [
          { id: 'kral', label: 'Jen uhnout králem' },
          { id: 'zakryt', label: 'Zakrýt jeden ze šachů' },
          { id: 'vzit', label: 'Vzít jednu z figurek' },
        ],
        correct: ['kral'],
        explain: 'Správně. Proti dvojšachu pomůže jen tah králem.',
        wrongExplain: {
          zakryt: 'Zakryješ jen jeden šach. Ten druhý pořád platí.',
          vzit: 'I kdyby vzal jednu figurku, druhá pořád šachuje.',
        },
        wrongDefault: 'Šachují dvě figurky naráz. Jedním tahem obě nezastavíš.',
      },
      {
        id: 'mate',
        kind: 'move',
        fen: 'rnb2b1r/ppk2ppp/2p5/4q1B1/4n3/8/PPP2PPP/2KR1BNR w - - 2 11',
        movable: ['g5'],
        accept: ['g5d8'],
        completeness: { kind: 'mate' },
        text: 'Vrať střelce zpátky na d8. Dej mat!',
        success: 'Mat! Král nemá kam utéct.',
        wrongDefault: 'Zkus přesunout střelce zpátky na pole d8.',
      },
    ],
    outro: 'Dvojšach: dvě figurky šachují naráz, pomůže jen útěk krále. Odtažný útok umí odkrýt cestu i beze šachu.',
    practice: [
      { kind: 'puzzles', band: 'stredni', theme: 'doubleCheck', count: 5, label: 'Úlohy: dvojšach' },
      { kind: 'puzzles', band: 'stredni', theme: 'discoveredCheck', count: 5, label: 'Úlohy: odtažný šach' },
    ],
  },

  // plan lesson 5: Řecký dar (Sxh7+, Jg5+, Dh5 — when it works)
  {
    id: 'l4-recky-dar',
    level: 4,
    number: 5,
    title: 'Řecký dar',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: 'r2q1rk1/ppp1bppp/2n5/8/8/3B1N2/PPP2PPP/R2Q1RK1 w - - 0 1',
        shapes: [
          { from: 'd3', to: 'h7', brush: 'red' },
          { from: 'g5', brush: 'blue' },
          { from: 'h5', brush: 'blue' },
        ],
        text: 'Řecký dar: obětuješ střelce na h7, skočíš jezdcem na g5 a přivedeš dámu na h5.',
      },
      {
        id: 'defender-check1',
        kind: 'choose',
        fen: 'r2q1rk1/ppp1bppp/5n2/8/8/3B1N2/PPP2PPP/R2Q1RK1 w - - 0 1',
        text: 'Hlídá tu černý jezdec pole h5?',
        options: [
          { id: 'ano', label: 'Ano' },
          { id: 'ne', label: 'Ne' },
        ],
        correct: ['ano'],
        explain: 'Ano, jezdec f6 hlídá h5. Řecký dar tu nevyjde.',
        wrongDefault: 'Podívej se, kam všude jezdec f6 dosáhne.',
      },
      {
        id: 'defender-check2',
        kind: 'choose',
        fen: 'r2q1rk1/ppp1bppp/2n5/8/8/3B1N2/PPP2PPP/R2Q1RK1 w - - 0 1',
        text: 'A tady? Hlídá tu někdo pole h5?',
        options: [
          { id: 'ano', label: 'Ano' },
          { id: 'ne', label: 'Ne' },
        ],
        correct: ['ne'],
        explain: 'Ne, nikdo pole h5 nehlídá. Tady řecký dar může vyjít.',
        wrongDefault: 'Podívej se, jestli na pole h5 něco dosáhne.',
      },
      {
        id: 'sac',
        kind: 'move',
        fen: 'r2q1rk1/ppp1bppp/2n5/8/8/3B1N2/PPP2PPP/R2Q1RK1 w - - 0 1',
        movable: ['d3'],
        accept: ['d3h7'],
        completeness: { kind: 'lands', square: 'h7', from: 'd3' },
        text: 'Nikdo h5 nehlídá. Obětuj střelce na h7.',
        success: 'Výborně! Král musí buď vzít, nebo se mu postavení zhorší.',
        wrongDefault: 'Obětuj střelce na h7.',
      },
      {
        id: 'follow-up',
        kind: 'show',
        fen: 'r2q1r2/ppp1bppk/2n5/8/8/5N2/PPP2PPP/R2Q1RK1 w - - 0 2',
        shapes: [
          { from: 'f3', to: 'g5', brush: 'blue' },
          { from: 'd1', to: 'h5', brush: 'blue' },
        ],
        text: 'Král vzal. Teď přijde Jg5+ a král uteče. Pak Dh5 hrozí mat na h7.',
      },
      {
        id: 'finish',
        kind: 'move',
        fen: '7k/6p1/6Q1/5N2/8/8/8/6K1 w - - 0 1',
        movable: ['g6'],
        accept: ['g6g7'],
        completeness: { kind: 'mate' },
        text: 'Dokonči útok. Vezmi pěšce dámou.',
        success: 'Mat! Dáma a jezdec spolupracují — král nemá kam utéct.',
        wrongDefault: 'Zkus vzít pěšce g7 dámou.',
      },
    ],
    outro: 'Řecký dar funguje, když nikdo nehlídá h5 ani h7. Nejdřív to ověř, pak obětuj.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'kingsideAttack', count: 5, label: 'Úlohy: útok na krále' }],
  },

  // plan lesson 6: Tichý tah (těžší)
  {
    id: 'l4-tichy-tah',
    level: 4,
    number: 6,
    title: 'Tichý tah',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: '6k1/5pp1/7p/8/1Q6/8/5PPP/3R2K1 w - - 0 1',
        shapes: [{ from: 'h7', brush: 'yellow' }],
        text: 'Věž chce dát mat na d8. Ale král má únik na pole h7.',
      },
      {
        id: 'definition',
        kind: 'choose',
        fen: '6k1/5pp1/7p/8/1Q6/8/5PPP/3R2K1 w - - 0 1',
        text: 'Co je tichý tah?',
        options: [
          { id: 'ticho', label: 'Tah, který nedává šach ani nebere' },
          { id: 'sach', label: 'Šach, který zachrání krále' },
          { id: 'brani', label: 'Braní zadarmo' },
        ],
        correct: ['ticho'],
        explain: 'Přesně tak. Tichý tah nedává šach ani nebere. Přesto může být nejsilnější.',
        wrongDefault: 'Tichý tah nedává šach ani nebere.',
      },
      {
        id: 'quiet',
        kind: 'move',
        fen: '6k1/5pp1/7p/8/1Q6/8/5PPP/3R2K1 w - - 0 1',
        accept: ['b4b1'],
        completeness: { kind: 'lands', square: 'b1', from: 'b4' },
        text: 'Zavři králi únik na h7. Přesuň dámu na pole b1.',
        success: 'Výborně! Teď dáma hlídá pole h7 po úhlopříčce.',
        wrong: { d1d8: 'To je šach, ale král uteče na h7. Nejdřív mu tam zavři cestu.' },
        wrongDefault: 'Tenhle tah únik na h7 nezavře. Zkus přesunout dámu na pole b1.',
      },
      {
        id: 'now',
        kind: 'show',
        fen: '6k1/5pp1/7p/8/8/8/5PPP/1Q1R2K1 w - - 0 1',
        text: 'Teď už král nemá kam utéct. Přišel čas na mat.',
      },
      {
        id: 'deliver',
        kind: 'move',
        fen: '6k1/5pp1/7p/8/8/8/5PPP/1Q1R2K1 w - - 0 1',
        movable: ['d1'],
        accept: ['d1d8'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Mat! Tichý tah dámou mat připravil, teď ho věž dokončila.',
        wrongDefault: 'Zkus dát šach věží na osmé řadě.',
      },
    ],
    outro: 'Tichý tah nedává šach ani nebere, ale připraví mat, který soupeř nezastaví.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'quietMove', count: 5, label: 'Úlohy: tichý tah' }],
  },

  // plan lesson 7: Mat 3. tahem, kandidátní tahy
  {
    id: 'l4-mat3',
    level: 4,
    number: 7,
    title: 'Mat 3. tahem',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: '8/8/4k3/R7/8/8/8/6KR w - - 0 1',
        text: 'Kandidátní tahy: nejdřív hledej šachy, pak braní, pak hrozby. Propočítej je do konce.',
      },
      {
        id: 'move1',
        kind: 'move',
        fen: '8/8/4k3/R7/8/8/8/6KR w - - 0 1',
        movable: ['h1'],
        accept: ['h1h6'],
        completeness: { kind: 'lands', square: 'h6', from: 'h1' },
        text: 'Čtvrtou řadu hlídá druhá věž. Dej šach na šesté řadě.',
        success: 'Šach! Král musí na sedmou řadu.',
        wrongDefault: 'Zkus dát šach věží na poli h6.',
      },
      {
        id: 'again',
        kind: 'show',
        fen: '8/4k3/7R/R7/8/8/8/6K1 w - - 0 1',
        text: 'Král ušel na sedmou řadu. Druhá věž teď zašachuje a zároveň ohlídá řadu pod sebou.',
      },
      {
        id: 'move2',
        kind: 'move',
        fen: '8/4k3/7R/R7/8/8/8/6K1 w - - 0 1',
        movable: ['a5'],
        accept: ['a5a7'],
        completeness: { kind: 'lands', square: 'a7', from: 'a5' },
        text: 'Dej šach na sedmé řadě.',
        success: 'Šach! Král musí na osmou řadu, poslední.',
        wrongDefault: 'Zkus dát šach věží na poli a7.',
      },
      {
        id: 'search',
        kind: 'show',
        fen: '4k3/R7/7R/8/8/8/8/6K1 w - - 0 1',
        text: 'Král je na poslední řadě. Sedmou řadu hlídá věž a7. Najdi mat.',
      },
      {
        id: 'mate',
        kind: 'move',
        fen: '4k3/R7/7R/8/8/8/8/6K1 w - - 0 1',
        movable: ['h6'],
        accept: ['h6h8'],
        completeness: { kind: 'mate' },
        text: 'Dej mat!',
        success: 'Mat! Král neměl kam utéct.',
        wrongDefault: 'Zkus dát šach věží na poli h8.',
      },
    ],
    outro: 'Kandidátní tahy: u každého tahu zvaž šachy, braní i hrozby. Vyber nejlepší a propočítej ho do konce.',
    practice: [{ kind: 'puzzles', band: 'stredni', theme: 'mateIn3', count: 5, label: 'Úlohy: mat 3. tahem' }],
  },

  // plan lesson 12: Věž a dáma proti pěšci
  {
    id: 'l4-vez-dama-pesec',
    level: 4,
    number: 8,
    title: 'Věž a dáma proti pěšci',
    steps: [
      {
        id: 'idea',
        kind: 'show',
        fen: '8/8/8/8/3k4/8/3p4/3K1R2 w - - 0 1',
        text: 'Věž nebo dáma většinou snadno zastaví osamocený pěšec. Kromě jedné výjimky.',
      },
      {
        id: 'rook-technique',
        kind: 'show',
        fen: '8/8/8/8/8/2k5/1p6/1K1R4 w - - 0 1',
        shapes: [{ from: 'b2', brush: 'red' }],
        text: 'Věž zaútočí na pěšce zezadu nebo po řadě. Tvůj král se pak přiblíží a pomůže.',
      },
      {
        id: 'rook-attack',
        kind: 'move',
        fen: '8/8/8/8/8/2k5/1p6/1K1R4 w - - 0 1',
        movable: ['d1'],
        accept: ['d1d2'],
        completeness: { kind: 'lands', square: 'd2', from: 'd1' },
        text: 'Postav věž na stejnou řadu jako pěšec.',
        success: 'Výborně! Věž teď útočí na pěšce po druhé řadě.',
        wrongDefault: 'Zkus přesunout věž na pole d2, na stejnou řadu jako pěšec.',
      },
      {
        id: 'queen-technique',
        kind: 'show',
        fen: '8/8/8/8/8/1k6/1p6/1K4Q1 w - - 0 1',
        text: 'Dáma šachuje z dálky, dokud král nemusí stoupnout před pěšce. Pak přiběhne tvůj král.',
      },
      {
        id: 'exception',
        kind: 'show',
        fen: '8/8/8/8/8/k7/p7/6QK b - - 0 1',
        text: 'Krajní pěšec je výjimka. V rohu může být remíza — pozor na pat.',
      },
    ],
    outro: 'Věž a dáma proti pěšci: většinou vyhraješ. U krajního pěšce v rohu dej pozor na pat.',
    practice: [
      { kind: 'endgame', id: 'rvp', label: 'Koncovky: věž proti pěšci' },
      { kind: 'endgame', id: 'rvp2', label: 'Koncovky: věž proti pěšci II' },
      { kind: 'endgame', id: 'qvbp', label: 'Koncovky: dáma proti pěšci na b2' },
      { kind: 'endgame', id: 'qvp', label: 'Koncovky: dáma proti pěšci na d2' },
      { kind: 'endgame', id: 'qvap', label: 'Koncovky: krajní pěšec drží remízu' },
    ],
  },
];
