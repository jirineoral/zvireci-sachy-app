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
 * Sources. Tactics are real game positions from the Lichess puzzle database (CC0; the puzzle
 * id is noted, the FEN is the position after the opponent's first move) or two classic games
 * replayed move by move with chess.js: Carlos Torre – Emanuel Lasker, Moscow 1925 (the
 * windmill) and Richard Réti – Savielly Tartakower, Vienna 1910. The greek-gift trio is a
 * French-defence setup (1.e4 e6 2.d4 d5 3.Jc3 Jf6 4.e5 Jfd7 5.Jf3 Sb4 6.Sd3 Jc6 7.0-0 0-0)
 * with one piece changed between „works“ and „fails“. Every tactical move step uses `best`
 * or `mate` (Stockfish / chess.js decide the accepted set); review evals at depth 22–24:
 * greek gift Sxh7+ +3.7 (next best +1.5), with Se7 instead of Sb4 Sxh7+ −2.2, with Jf6 and
 * e3 −3.5. The rook/queen-vs-pawn tasks were checked against the Lichess tablebase: every
 * accepted move keeps the win and the task wording excludes the other winning moves.
 */
import type { Lesson } from './types';

/** Greek gift „works“: black's knight was kicked from f6 by e5, the bishop on b4 cannot guard g5. */
const GREEK_WORKS = 'r1bq1rk1/pppn1ppp/2n1p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 7 8';

export const LEVEL4: readonly Lesson[] = [
  // plan lesson 1: Uvolnění (clearance)
  {
    id: 'l4-uvolneni',
    level: 4,
    number: 1,
    title: 'Uvolnění',
    steps: [
      {
        // Lichess puzzle WdEM0.
        id: 'idea',
        kind: 'show',
        fen: '1r5k/4q1p1/2p1p2p/p1n2R2/2P1Q3/1P1B3P/P5P1/6K1 w - - 0 29',
        shapes: [
          { from: 'f5', brush: 'red' },
          { from: 'e4', to: 'h7', brush: 'blue' },
        ],
        text: 'Uvolnění: tvoje figurka stojí v cestě jiné tvojí figurce. Uhneš s ní, nejlépe se šachem. Tady věž f5 zavírá dámě cestu na h7.',
      },
      {
        id: 'rook-clear',
        kind: 'move',
        fen: '1r5k/4q1p1/2p1p2p/p1n2R2/2P1Q3/1P1B3P/P5P1/6K1 w - - 0 29',
        accept: ['f5f8'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Uvolni dámě úhlopříčku. Uhni věží se šachem.',
        success: 'Výborně! Černý musí věž vzít. A úhlopříčka k poli h7 je volná.',
        wrong: { f5f7: 'Úhlopříčka je volná, ale bez šachu. Černý dostal čas se bránit.' },
        wrongDefault: 'Po tomhle tahu má černý čas se bránit. Uhni věží se šachem.',
      },
      {
        id: 'rook-mate',
        kind: 'move',
        fen: '1r3q1k/6p1/2p1p2p/p1n5/2P1Q3/1P1B3P/P5P1/6K1 w - - 0 30',
        accept: ['e4h7'],
        completeness: { kind: 'mate' },
        text: 'Černý vzal věž dámou. Dej mat.',
        success: 'Mat! Dámu na h7 kryje střelec d3.',
        wrongDefault: 'Tohle mat není. Kam teď dáma dosáhne po volné úhlopříčce?',
      },
      {
        // Lichess puzzle rsOiD.
        id: 'pawn-clear',
        kind: 'move',
        fen: '8/8/4ppp1/3p1k1p/2pP3P/1qP1PPP1/6K1/2Q5 w - - 0 46',
        accept: ['e3e4'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Uvolnit umí i pěšec. Pěšec e3 zavírá dámě úhlopříčku. Uvolni ji se šachem.',
        success: 'Výborně! Černý musí vzít dxe4. Úhlopříčka c1–f4 je volná.',
        wrong: { g3g4: 'Šach to je, ale dámě cestu neuvolní. Který pěšec jí stojí v cestě?' },
        wrongDefault: 'Tohle dámě cestu neuvolní. Pěšec e3 jí stojí v cestě.',
      },
      {
        id: 'pawn-mate',
        kind: 'move',
        fen: '8/8/4ppp1/5k1p/2pPp2P/1qP2PP1/6K1/2Q5 w - - 0 47',
        accept: ['c1f4'],
        completeness: { kind: 'mate' },
        text: 'Úhlopříčka je volná. Dej mat.',
        success: 'Mat! Král nemá kam utéct.',
        wrongDefault: 'Tohle mat není. Kam teď dáma dosáhne?',
      },
      {
        // Lichess puzzle XjcZ0.
        id: 'knight-clear',
        kind: 'move',
        fen: '2rr4/1p3p1k/1q2pPNp/8/1p3PQ1/P3p2P/6PK/5R2 w - - 1 30',
        accept: ['g6f8'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Teď stojí dámě v cestě jezdec g6. Uvolni jí sloupec g.',
        success: 'Výborně! Jezdec uhnul se šachem. Sloupec g je volný.',
        wrongDefault: 'Po tomhle tahu má černý čas se bránit. Uhni jezdcem se šachem.',
      },
      {
        id: 'knight-mate',
        kind: 'move',
        fen: '2r2r2/1p3p1k/1q2pP1p/8/1p3PQ1/P3p2P/6PK/5R2 w - - 0 31',
        accept: ['g4g7'],
        completeness: { kind: 'mate' },
        text: 'Černý vzal jezdce věží. Dej mat.',
        success: 'Mat! Dámu na g7 kryje pěšec f6.',
        wrongDefault: 'Tohle mat není. Kam teď dáma dosáhne po volném sloupci?',
      },
    ],
    outro: 'Uvolnění: uhni vlastní figurkou z cesty. Nejlépe se šachem, aby soupeř neměl čas.',
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
        // Lichess puzzle G79Dz.
        id: 'idea',
        kind: 'show',
        fen: '2r2r2/5pkp/4pqp1/pp1p4/6Pn/1BP1R1QP/PP3P2/R5K1 w - - 0 22',
        shapes: [
          { from: 'f6', to: 'h4', brush: 'blue' },
          { from: 'h4', brush: 'red' },
        ],
        text: 'Přerušení: postavíš figurku mezi dvě soupeřovy. Přerušíš tak jejich spojení. Tady dáma f6 kryje jezdce h4.',
      },
      {
        id: 'pawn-block',
        kind: 'move',
        fen: '2r2r2/5pkp/4pqp1/pp1p4/6Pn/1BP1R1QP/PP3P2/R5K1 w - - 0 22',
        accept: ['g4g5'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Najdi tah, po kterém jezdec h4 ztratí obranu.',
        success: 'Výborně! Pěšec g5 přerušil linii f6–h4 a napadá dámu.',
        wrong: { g3h4: 'Jezdce kryje dáma f6. Po Dxh4 Dxh4 přijdeš o dámu.' },
        wrongDefault: 'Jezdec h4 je pořád krytý dámou f6. Postav něco mezi ně.',
      },
      {
        id: 'result',
        kind: 'show',
        fen: '2r2r2/4qpkp/4p1p1/pp1p2P1/7n/1BP1R1QP/PP3P2/R5K1 w - - 1 23',
        shapes: [{ from: 'g3', to: 'h4', brush: 'green' }],
        text: 'Dáma musela uhnout. Jezdec h4 zůstal bez obrany a Dxh4 ho vezme.',
      },
      {
        // Lichess puzzle aupOi.
        id: 'rook-block',
        kind: 'move',
        fen: '6k1/1q2npbp/p3p1p1/1r1p4/3PnB2/1P1Q1NP1/4NP1P/2R3K1 w - - 2 29',
        accept: ['c1c7'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Dáma b7 kryje jezdce e7 po sedmé řadě. Přeruš tu řadu.',
        success: 'Výborně! Věž napadá dámu a jezdec e7 padne. Věž kryje střelec f4.',
        wrongDefault: 'Jezdec e7 je pořád krytý dámou b7. Postav figurku mezi ně.',
      },
      {
        // Lichess puzzle 807ML.
        id: 'bishop-block',
        kind: 'move',
        fen: '3rr1k1/3b1ppp/3q1b2/1p2p3/1n6/1P2BN2/3N1PPP/2RQR1K1 w - - 0 27',
        accept: ['e3c5'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Ještě jednou. Dáma d6 kryje jezdce b4. Přeruš jejich spojení.',
        success: 'Výborně! Sc5 napadá dámu a zavírá linii d6–b4. Jezdec b4 padne.',
        wrongDefault: 'Jezdec b4 je pořád krytý dámou d6. Postav figurku mezi ně.',
      },
    ],
    outro: 'Přerušení: postav figurku mezi soupeřovy figurky. Nejlépe s útokem, aby soupeř neměl čas.',
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
        text: 'Slavná partie: Carlos Torre proti Emanueli Laskerovi, Moskva 1925. Torre nechal Laskera vzít dámu. Teď spustí mlýn.',
      },
      {
        id: 'check1',
        kind: 'move',
        fen: 'r3rnk1/pb3pp1/3ppB1p/7q/1P1P4/4N1R1/P4PPP/4R1K1 w - - 0 26',
        movable: ['g3'],
        accept: ['g3g7'],
        completeness: { kind: 'captures', from: 'g3' },
        text: 'Vezmi věží pěšce g7 se šachem.',
        success: 'Výborně! Věž kryje střelec f6. Král musí do rohu na h8.',
        wrongDefault: 'Zkus věží vzít pěšce g7 se šachem.',
      },
      {
        id: 'discovered',
        kind: 'show',
        fen: 'r3rn1k/pb3pR1/3ppB1p/7q/1P1P4/4N3/P4PPP/4R1K1 w - - 1 27',
        shapes: [{ from: 'f6', to: 'h8', brush: 'red' }],
        text: 'Teď pozor. Když věž z g7 odtáhne, šachuje střelec f6. To je odtažný šach.',
      },
      {
        id: 'check2',
        kind: 'move',
        fen: 'r3rn1k/pb3pR1/3ppB1p/7q/1P1P4/4N3/P4PPP/4R1K1 w - - 1 27',
        movable: ['g7'],
        accept: ['g7f7'],
        completeness: { kind: 'captures', from: 'g7' },
        text: 'Odtáhni věží a vezmi pěšce. Šach dá střelec.',
        success: 'Paráda! Odtažný šach a další pěšec je pryč. Král musí zpátky na g8.',
        wrongDefault: 'Zkus věží vzít pěšce f7. Šach pak dá střelec f6.',
      },
      {
        id: 'why',
        kind: 'show',
        fen: 'r3rn1k/p5R1/3ppB1p/7q/1P1P4/4N3/P4PPP/4R1K1 w - - 3 31',
        text: 'Věž se vrátí na g7 se šachem a zase odtáhne. Tak vzala i střelce b7. Tomu se říká mlýn.',
      },
      {
        id: 'final',
        kind: 'move',
        fen: 'r3rn2/p6k/3ppB1p/6Rq/1P1P4/4N3/P4PPP/4R1K1 w - - 5 32',
        movable: ['g5'],
        accept: ['g5h5'],
        completeness: { kind: 'captures', from: 'g5' },
        text: 'Věž naposledy odtáhla na g5 a napadla dámu. Vezmi ji.',
        success: 'Mlýn skončil. Torre dal dámu, ale vzal zpátky dámu, střelce a dva pěšce.',
        wrongDefault: 'Zkus věží vzít dámu na poli h5.',
      },
    ],
    outro: 'Mlýn: věž střídá šach a odtažný šach. Pokaždé něco vezme a král nestihne nic udělat.',
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
        text: 'Partie Richard Réti proti Saviellymu Tartakowerovi, Vídeň 1910. Bílý dá mat 3. tahem. Začne obětí dámy.',
      },
      {
        id: 'sac',
        kind: 'move',
        fen: 'rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9',
        movable: ['d3'],
        accept: ['d3d8'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Obětuj dámu se šachem.',
        success: 'Šach! Černý nemá jiný tah než Kxd8.',
        wrongDefault: 'Hledej šach dámou. Černý ji pak musí vzít.',
      },
      {
        id: 'forced',
        kind: 'show',
        fen: 'rnbk1b1r/pp3ppp/2p5/4q3/4n3/8/PPPB1PPP/2KR1BNR w - - 0 10',
        shapes: [{ from: 'd1', to: 'd8', brush: 'blue' }],
        text: 'Král dámu vzal. Střelec d2 stojí věži v cestě. Každý jeho tah odkryje šach věží.',
      },
      {
        id: 'double-check',
        kind: 'move',
        fen: 'rnbk1b1r/pp3ppp/2p5/4q3/4n3/8/PPPB1PPP/2KR1BNR w - - 0 10',
        movable: ['d2'],
        accept: ['d2g5'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Najdi tah střelcem, po kterém šachuje i on. A příští tah dáš mat.',
        success: 'Dvojšach! Šachuje věž d1 i střelec g5 naráz.',
        wrong: { d2a5: 'Taky dvojšach, ale král uteče na e7 nebo e8. Tam mat nedáš.' },
        wrongDefault: 'Tohle je jen odtažný šach. Černý ho zakryje nebo uteče. Ať šachuje i střelec.',
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
          zakryt: 'Černý zakryje jen jeden šach. Ten druhý pořád platí.',
          vzit: 'I kdyby vzal jednu figurku, druhá pořád šachuje.',
        },
        wrongDefault: 'Šachují dvě figurky naráz. Jedním tahem obě nezastavíš.',
      },
      {
        id: 'mate',
        kind: 'move',
        fen: 'rnb2b1r/ppk2ppp/2p5/4q1B1/4n3/8/PPP2PPP/2KR1BNR w - - 2 11',
        accept: ['g5d8'],
        completeness: { kind: 'mate' },
        text: 'Král utekl na c7. Dej mat.',
        success: 'Mat! Po Ke8 by přišlo Vd8 mat.',
        wrongDefault: 'Tohle mat není. Střelec může zpátky na úhlopříčku d8–a5.',
      },
    ],
    outro: 'Dvojšach: šachují dvě figurky naráz, pomůže jen útěk krále. Rodí se z odtažného útoku.',
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
        fen: GREEK_WORKS,
        shapes: [
          { from: 'd3', to: 'h7', brush: 'red' },
          { from: 'f3', to: 'g5', brush: 'blue' },
          { from: 'd1', to: 'h5', brush: 'blue' },
        ],
        text: 'Řecký dar: Sxh7+ Kxh7, pak Jg5+ a Dh5. Dáma s jezdcem hrozí mat na h7. Nejdřív ale ověř, že to vyjde.',
      },
      {
        id: 'fails-knight',
        kind: 'choose',
        fen: 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/1b1P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 6 7',
        text: 'Vyjde tady řecký dar Sxh7+?',
        options: [
          { id: 'ano', label: 'Ano' },
          { id: 'ne', label: 'Ne' },
        ],
        correct: ['ne'],
        explain: 'Správně. Jezdec f6 kryje h7 a střelce prostě vezme. Bílý jen ztratí figuru.',
        wrongDefault: 'Podívej se na jezdce f6. Které pole kryje?',
      },
      {
        id: 'fails-bishop',
        kind: 'choose',
        fen: 'r1bq1rk1/pppnbppp/2n1p3/3pP3/3P4/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 7 8',
        text: 'Jezdce z f6 vyhnal pěšec e5. Vyjde tedy řecký dar teď?',
        options: [
          { id: 'ano', label: 'Ano' },
          { id: 'ne', label: 'Ne' },
        ],
        correct: ['ne'],
        explain: 'Správně. Střelec e7 hlídá g5. Po Jg5+ ho černý vezme a útok skončí.',
        wrongDefault: 'Podívej se na černého střelce e7. Které pole hlídá?',
      },
      {
        id: 'sac',
        kind: 'move',
        fen: GREEK_WORKS,
        accept: ['d3h7'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Tady je černý střelec na b4 a pole g5 nikdo nehlídá. Zahraj řecký dar.',
        success: 'Výborně! Černý vzal Kxh7. Kdyby nevzal, přišel by o pěšce zadarmo.',
        wrongDefault: 'Řecký dar začíná obětí střelce na h7 se šachem.',
      },
      {
        id: 'knight',
        kind: 'move',
        fen: 'r1bq1r2/pppn1ppk/2n1p3/3pP3/1b1P4/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 9',
        accept: ['f3g5'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Druhý krok: šach jezdcem.',
        success: 'Výborně! Nikdo jezdce nevezme. Černý král couvl na g8.',
        wrongDefault: 'Druhý krok řeckého daru je šach jezdcem z g5.',
      },
      {
        id: 'queen',
        kind: 'move',
        fen: 'r1bq1rk1/pppn1pp1/2n1p3/3pP1N1/1b1P4/2N5/PPP2PPP/R1BQ1RK1 w - - 2 10',
        movable: ['d1'],
        accept: ['d1h5'],
        completeness: { kind: 'lands', square: 'h5', from: 'd1' },
        text: 'Třetí krok: dáma na h5.',
        success: 'Výborně! Hrozí Dh7 mat. Černý se ubrání jen za cenu dámy.',
        wrongDefault: 'Třetí krok řeckého daru je dáma na h5.',
      },
    ],
    outro: 'Řecký dar potřebuje tři věci. Černý jezdec nesmí na f6. Pole g5 nikdo nehlídá. Dáma se dostane na h5. Nejdřív to ověř, pak obětuj.',
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
        // Lichess puzzle JupYf.
        id: 'idea',
        kind: 'show',
        fen: 'r6k/1p3R2/1p2p2p/7N/8/p7/6PP/7K w - - 0 38',
        text: 'Tichý tah nedává šach a nic nebere. Přesto bývá nejsilnější. Připraví hrozbu, kterou soupeř nezastaví.',
      },
      {
        id: 'definition',
        kind: 'choose',
        fen: 'r6k/1p3R2/1p2p2p/7N/8/p7/6PP/7K w - - 0 38',
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
        fen: 'r6k/1p3R2/1p2p2p/7N/8/p7/6PP/7K w - - 0 38',
        accept: ['h5f6'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Šachy tu nic nedají. Najdi tichý tah, po kterém hrozí mat.',
        success: 'Výborně! Jezdec f6 hlídá h7 i g8. Hrozí Vh7 mat a černý ho nezastaví.',
        wrong: {
          f7f8: 'Šach, ale černý vezme věž: Vxf8.',
          f7h7: 'Šach, ale král vezme věž: Kxh7.',
        },
        wrongDefault: 'Tohle nic nehrozí. Zkus tah jezdcem, po kterém věž dá mat.',
      },
      {
        id: 'deliver',
        kind: 'move',
        fen: 'r6k/1p3R2/1p2pN1p/8/8/8/p5PP/7K w - - 0 39',
        accept: ['f7h7'],
        completeness: { kind: 'mate' },
        text: 'Černý táhl pěšcem na a2. Dej mat.',
        success: 'Mat! Tichý tah jezdcem mat připravil, věž ho dokončila.',
        wrongDefault: 'Tohle mat není. Věž kryje jezdec f6.',
      },
      {
        // Lichess puzzle QkgeA.
        id: 'quiet-rook',
        kind: 'move',
        fen: 'r2k4/1pp2pp1/p2p3p/3P4/6r1/2K1R3/PP4P1/R7 w - - 0 22',
        accept: ['a1e1'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Tichý tah umí i vyhrát materiál. Najdi tah, po kterém hrozí Ve8+.',
        success: 'Výborně! Věže stojí za sebou. Po Ve8+ padne věž a8.',
        wrong: { e3e8: 'Šach, ale černá věž a8 tvou věž vezme.' },
        wrongDefault: 'Po tomhle tahu Ve8+ nic nevyhraje. Věž na e8 potřebuje oporu.',
      },
    ],
    outro: 'Tichý tah nedává šach ani nebere, ale připraví hrozbu, kterou soupeř nezastaví.',
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
        // Lichess puzzle u2Phq.
        id: 'idea',
        kind: 'show',
        fen: '2b2rk1/1p2n1p1/8/6NR/7P/r3P3/5bP1/3Q3K w - - 6 28',
        text: 'Kandidátní tahy: nejdřív hledej šachy, pak braní, pak hrozby. Každý propočítej až do konce.',
      },
      {
        id: 'count',
        kind: 'choose',
        fen: '2b2rk1/1p2n1p1/8/6NR/7P/r3P3/5bP1/3Q3K w - - 6 28',
        text: 'Kolik různých šachů má tady bílý?',
        options: [
          { id: '1', label: 'Jeden' },
          { id: '2', label: 'Dva' },
          { id: '3', label: 'Tři' },
        ],
        correct: ['3'],
        explain: 'Ano, tři: Vh8+, Db3+ a Dd5+. Teď je propočítej.',
        wrongDefault: 'Hledej dál. Šach může dát věž i dáma, a dáma dvakrát.',
      },
      {
        id: 'move1',
        kind: 'move',
        fen: '2b2rk1/1p2n1p1/8/6NR/7P/r3P3/5bP1/3Q3K w - - 6 28',
        accept: ['h5h8'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Jeden z těch šachů vede k matu 3. tahem. Zahraj ho.',
        success: 'Výborně! Černý musí vzít: Kxh8.',
        wrong: {
          d1b3: 'Po Db3+ se černý ubrání, třeba Kh8. Mat z toho nebude.',
          d1d5: 'Po Dd5+ vezme jezdec e7 dámu.',
        },
        wrongDefault: 'Začni šachem. Propočítej hlavně ten, po kterém král musí vzít.',
      },
      {
        id: 'move2',
        kind: 'move',
        fen: '2b2r1k/1p2n1p1/8/6N1/7P/r3P3/5bP1/3Q3K w - - 0 29',
        accept: ['d1h5'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Král vzal věž. Dej další šach.',
        success: 'Šach! Král musí zpátky na g8.',
        wrongDefault: 'Dáma teď může šachovat po sloupci h.',
      },
      {
        id: 'move3',
        kind: 'move',
        fen: '2b2rk1/1p2n1p1/8/6NQ/7P/r3P3/5bP1/7K w - - 2 30',
        accept: ['h5h7'],
        completeness: { kind: 'mate' },
        text: 'Dej mat.',
        success: 'Mat 3. tahem! Dámu na h7 kryje jezdec g5.',
        wrongDefault: 'Tohle mat není. Dáma potřebuje oporu jezdce.',
      },
      {
        // Lichess puzzle QzHh3.
        id: 'second',
        kind: 'move',
        fen: 'r5k1/ppp2rpp/3p4/8/4P1n1/1Q2P2q/Pp3R1P/1R2K3 w - - 0 18',
        accept: ['b3f7'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Teď sám. Bílý dá mat 3. tahem. Začni šachy.',
        success: 'Výborně! Černý musí Kh8.',
        wrongDefault: 'Tohle mat 3. tahem nedá. Prober šachy: který z nich něco bere?',
      },
      {
        id: 'second2',
        kind: 'move',
        fen: 'r6k/ppp2Qpp/3p4/8/4P1n1/4P2q/Pp3R1P/1R2K3 w - - 1 19',
        accept: ['f7f8'],
        completeness: { kind: 'best', marginCp: 100 },
        text: 'Pokračuj. Hledej šach na poslední řadě.',
        success: 'Výborně! Po Vxf8 přijde Vxf8 mat.',
        wrongDefault: 'Hledej šach dámou na osmé řadě. Věž f2 ji podpoří.',
      },
    ],
    outro: 'Kandidátní tahy: prober šachy, braní i hrozby. Vyber nejlepší a propočítej ho do konce.',
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
        text: 'Dáma proti osamocenému pěšci skoro vždy vyhraje. Věž většinou taky, když jí pomůže tvůj král.',
      },
      {
        id: 'rook-technique',
        kind: 'show',
        fen: '8/8/8/8/8/1k6/1p6/1K5R w - - 0 1',
        shapes: [{ from: 'b2', brush: 'red' }],
        text: 'Tvůj král pěšce zastavil. Černý král ho ale kryje. Věž ho od pěšce odežene šachem.',
      },
      {
        id: 'rook-check',
        kind: 'move',
        fen: '8/8/8/8/8/1k6/1p6/1K5R w - - 0 1',
        movable: ['h1'],
        accept: ['h1h3'],
        completeness: { kind: 'lands', square: 'h3', from: 'h1' },
        text: 'Dej věží šach z dálky.',
        success: 'Výborně! Černý král musí od pěšce pryč. Tvůj král pak pěšce sebere.',
        wrongDefault: 'Tohle není šach. Zkus šach po třetí řadě, daleko od krále.',
      },
      {
        id: 'queen-technique',
        kind: 'show',
        fen: 'Q7/8/8/8/8/8/3pk3/7K w - - 0 1',
        text: 'Dáma šachuje, dokud černý král nemusí stoupnout před pěšce. Pak má tvůj král čas na jeden krok.',
      },
      {
        id: 'king-step',
        kind: 'move',
        fen: '8/8/8/8/8/4Q3/3p4/3k3K w - - 0 1',
        accept: ['h1g1', 'h1g2', 'h1h2'],
        completeness: { kind: 'legal', from: 'h1' },
        text: 'Černý král stojí před pěšcem. Pěšec teď nemůže dál. Udělej krok králem.',
        success: 'Výborně! Tohle opakuješ, dokud tvůj král nedojde až k pěšci.',
        wrongDefault: 'Dáma svou práci udělala. Teď je čas na krok králem.',
      },
      {
        id: 'exception',
        kind: 'show',
        fen: '8/8/8/8/8/k7/p7/6QK b - - 0 1',
        text: 'Krajní pěšec je výjimka. Černý král se schová do rohu a1. Když tvůj král nepřijde včas, je to remíza: černý by byl v patu.',
      },
    ],
    outro: 'Věž a dáma proti pěšci: odežeň krále šachy a přiveď svého krále. Krajní pěšec v rohu často drží remízu kvůli patu.',
    practice: [
      { kind: 'endgame', id: 'rvp', label: 'Koncovky: věž proti pěšci' },
      { kind: 'endgame', id: 'rvp2', label: 'Koncovky: věž proti pěšci II' },
      { kind: 'endgame', id: 'qvbp', label: 'Koncovky: dáma proti pěšci na b2' },
      { kind: 'endgame', id: 'qvp', label: 'Koncovky: dáma proti pěšci na d2' },
      { kind: 'endgame', id: 'qvap', label: 'Koncovky: krajní pěšec drží remízu' },
    ],
  },
];
