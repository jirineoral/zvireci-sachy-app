// Node test of the lesson runner (src/lessons/runner.ts): drives every lesson through its
// correct answers, then checks wrong answers, explanations, text resolution, the board
// adapter glue and progress storage. Phase 21b: mini-games (won through the runner by the
// careful-beginner bot of mini-sim.mjs), level tests (one attempt, score, pass/fail),
// the new explanations (pat, check but not mate), castling / en passant, the diploma name.
// Run: npm run test:lessons
import './ts-hooks.mjs';
import assert from 'node:assert/strict';
import { childMove } from './mini-sim.mjs';

const { COURSE, allLessons } = await import('../src/lessons/course.ts');
const { createLessonRunner, renderToBoard, needsPromotion } = await import('../src/lessons/runner.ts');
const { parsePlacement, pseudoTargets } = await import('../src/lessons/geometry.ts');
const { resolveText } = await import('../src/lessons/text.ts');
const progress = await import('../src/lessons/progress.ts');
const diploma = await import('../src/lessons/diploma.ts');
const { seededRandom } = await import('../src/lessons/mini.ts');

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n`, e);
    process.exitCode = 1;
  }
};

/** Shortest path for a collect step (the same BFS as the checker), as a list of [from, to]. */
function collectPath(step) {
  const board = parsePlacement(step.fen);
  const piece = board.get(step.piece);
  const others = new Map(board);
  others.delete(step.piece);
  const full = (1 << step.stars.length) - 1;
  const prev = new Map([[`${step.piece}|0`, null]]);
  const queue = [[step.piece, 0]];
  while (queue.length) {
    const [sq, mask] = queue.shift();
    if (mask === full) {
      const path = [];
      let key = `${sq}|${mask}`;
      while (prev.get(key)) {
        const [pk, from] = prev.get(key);
        path.unshift([from, key.split('|')[0]]);
        key = pk;
      }
      return path;
    }
    const b = new Map(others);
    b.set(sq, piece);
    for (const to of pseudoTargets(b, sq)) {
      const i = step.stars.indexOf(to);
      const m = i >= 0 ? mask | (1 << i) : mask;
      const key = `${to}|${m}`;
      if (!prev.has(key)) {
        prev.set(key, [`${sq}|${mask}`, sq]);
        queue.push([to, m]);
      }
    }
  }
  throw new Error('unsolvable');
}

const byId = (id) => allLessons().find((l) => l.id === id);
const stepIndex = (lesson, id) => lesson.steps.findIndex((s) => s.id === id);

/** Plays the current mini step with the careful beginner until it is won (retrying lost games). */
function winMini(r, step) {
  let v = r.view;
  for (let game = 0; game < 30; game++) {
    for (let ply = 0; ply < 300 && v.phase === 'task'; ply++) {
      assert.equal(v.mini.thinking, false);
      const m = childMove(step.goal, parsePlacement(v.fen), step.fen.split(' ')[1], Math.random);
      assert.ok(m, 'the child has a move');
      assert.ok(v.movable.dests.get(m[0])?.includes(m[1]), `${m[0]}-${m[1]} offered`);
      v = r.dispatch({ type: 'move', from: m[0], to: m[1] });
      if (v.phase !== 'task') break;
      assert.equal(v.mini.thinking, true, 'waiting for the reply');
      assert.equal(v.movable, null, 'board locked while the opponent thinks');
      assert.equal(v.canNext, false);
      v = r.dispatch({ type: 'reply' });
    }
    if (v.phase === 'stepDone') return v;
    assert.equal(v.phase, 'wrong');
    assert.match(v.feedback.text, /Zkus to znovu!$/);
    v = r.dispatch({ type: 'retry' });
  }
  throw new Error(`${step.id}: not won in 30 games`);
}

// 1. Every lesson end to end with correct answers.
for (const level of COURSE) {
  for (const lesson of level.lessons) {
    test(`${lesson.id}: correct path`, () => {
      const r = createLessonRunner(lesson, { animalId: 'kuzlata' }, 0, { random: seededRandom(7) });
      for (const [i, step] of lesson.steps.entries()) {
        let v = r.view;
        assert.equal(v.stepIndex, i);
        assert.equal(v.phase, 'task');
        assert.ok(!v.text.includes('{'), `unresolved placeholder in ${step.id}`);
        if (step.kind === 'move') {
          const uci = step.accept[0];
          assert.ok(v.movable?.dests.get(uci.slice(0, 2))?.includes(uci.slice(2, 4)), `${step.id}: answer not offered by dests`);
          v = r.dispatch({ type: 'move', from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        } else if (step.kind === 'collect') {
          for (const [from, to] of collectPath(step)) {
            assert.equal(v.phase, 'task');
            assert.ok(v.movable?.dests.get(from)?.includes(to), `${step.id}: ${from}-${to} not offered`);
            v = r.dispatch({ type: 'move', from, to });
          }
          assert.equal(v.stars.length, 0);
        } else if (step.kind === 'choose') {
          const opt = step.options.find((o) => o.id === step.correct[0]);
          v = opt.square ? r.dispatch({ type: 'square', square: opt.square }) : r.dispatch({ type: 'choose', id: opt.id });
        } else if (step.kind === 'mini') {
          v = winMini(r, step);
        }
        if (step.kind !== 'show') {
          assert.equal(v.phase, 'stepDone', `${step.id}: not solved (${v.feedback?.text})`);
          assert.equal(v.feedback?.tone, 'good');
          assert.equal(v.movable, null, 'board locked after solving');
        }
        assert.ok(v.canNext);
        v = r.dispatch({ type: 'next' });
      }
      assert.equal(r.view.phase, 'lessonDone');
      assert.equal(r.view.outro, resolveText(lesson.outro, { animalId: 'kuzlata' }));
      assert.equal(r.view.canNext, false);
      if (lesson.test) {
        assert.equal(r.view.test.correct, r.view.test.total);
        assert.equal(r.view.test.passed, true);
      } else assert.equal(r.view.test, null);
    });
  }
}

// 2. Wrong answers and their explanations.
const wrongMove = (lessonId, stepId, from, to) => {
  const lesson = byId(lessonId);
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, stepId));
  return r.dispatch({ type: 'move', from, to });
};

test('king next to king is explained, board keeps the position', () => {
  const v = wrongMove('l1-kral', 'where', 'e4', 'e5');
  assert.equal(v.phase, 'wrong');
  assert.equal(v.feedback.text, 'Tam nesmíš. Králové nikdy nestojí vedle sebe.');
  assert.equal(v.fen, byId('l1-kral').steps[stepIndex(byId('l1-kral'), 'where')].fen);
  assert.equal(v.movable, null);
  assert.ok(v.canRetry);
});

test('king onto a guarded square names the guard', () => {
  const v = wrongMove('l1-kral', 'take', 'e4', 'e5');
  assert.equal(v.feedback.text, 'Tam nesmíš. To pole hlídá soupeřova věž.');
  assert.deepEqual(v.shapes.at(-1), { from: 'd5', to: 'e5', brush: 'red' });
});

test('a piece left en prise: „tady by ti … vzal …“', () => {
  assert.equal(wrongMove('l1-dama', 'take', 'b2', 'b8').feedback.text, 'Tady by ti král vzal dámu.');
  assert.equal(wrongMove('l1-jezdec', 'take', 'c3', 'b5').feedback.text, 'Tady by ti věž vzala jezdce.');
});

test('step-specific wrong text wins, then wrongDefault', () => {
  const v = wrongMove('l1-pesec', 'take', 'e4', 'e5');
  assert.equal(v.feedback.text, 'Tím nic nevezmeš. Rovně pěšec nebere, bere jen šikmo dopředu.');
  const d = wrongMove('l1-vez', 'take', 'd4', 'd6');
  assert.equal(d.feedback.text, byId('l1-vez').steps[stepIndex(byId('l1-vez'), 'take')].wrongDefault);
  assert.deepEqual(d.lastMove, ['d4', 'd6']); // a legal wrong move is shown
});

test('retry restores the step', () => {
  const lesson = byId('l1-pesec');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'double'));
  r.dispatch({ type: 'move', from: 'e2', to: 'e3' });
  assert.equal(r.view.feedback.text, 'To je jen o jedno pole. Z prvního pole smí pěšec i o dvě.');
  const v = r.dispatch({ type: 'retry' });
  assert.equal(v.phase, 'task');
  assert.equal(v.fen, lesson.steps[stepIndex(lesson, 'double')].fen);
  assert.equal(v.feedback, null);
  assert.equal(r.dispatch({ type: 'move', from: 'e2', to: 'e4' }).phase, 'stepDone');
});

test('moves not offered by the board are ignored', () => {
  const v = wrongMove('l1-vez', 'take', 'd4', 'e5');
  assert.equal(v.phase, 'task');
  assert.equal(v.feedback, null);
});

test('collect: move limit', () => {
  const lesson = byId('l1-kral');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'stars'));
  r.dispatch({ type: 'move', from: 'e1', to: 'd1' });
  r.dispatch({ type: 'move', from: 'd1', to: 'c1' });
  r.dispatch({ type: 'move', from: 'c1', to: 'b1' });
  const v = r.dispatch({ type: 'move', from: 'b1', to: 'a1' });
  assert.equal(v.phase, 'wrong');
  assert.equal(v.feedback.text, 'Došly ti tahy. Jde to na 4 tahy. Zkus to znovu.');
  assert.equal(r.dispatch({ type: 'retry' }).stars.length, 2);
});

test('collect: obstacles block, own pieces are not taken', () => {
  const lesson = byId('l1-vez');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'around'));
  const dests = r.view.movable.dests.get('b2');
  assert.ok(dests.includes('b4') && !dests.includes('b5') && !dests.includes('b6'));
  assert.ok(dests.includes('d2') && !dests.includes('e2'));
});

test('choose: wrong square explained, then right', () => {
  const lesson = byId('l1-sachovnice');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'find-it'));
  let v = r.dispatch({ type: 'square', square: 'f6' });
  assert.equal(v.phase, 'task');
  assert.equal(v.feedback.text, 'Tohle je f6. Sloupec sedí, ale řada 3 je níž.');
  assert.equal(v.choices.find((c) => c.id === 'f6').state, 'wrong');
  v = r.dispatch({ type: 'square', square: 'a1' }); // not an option: ignored
  assert.equal(v.feedback.text, 'Tohle je f6. Sloupec sedí, ale řada 3 je níž.');
  v = r.dispatch({ type: 'square', square: 'f3' });
  assert.equal(v.phase, 'stepDone');
});

test('choose: text answer + wrongDefault', () => {
  const lesson = byId('l1-strelec');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'never'));
  assert.match(r.dispatch({ type: 'choose', id: 'ano' }).feedback.text, /barvu pole/);
  assert.equal(r.dispatch({ type: 'choose', id: 'ne' }).phase, 'stepDone');
});

test('a pinned piece: „tvůj král by pak byl v šachu“', () => {
  const lesson = {
    id: 't', level: 9, number: 1, title: 't', outro: 't',
    steps: [{ id: 'pin', kind: 'move', fen: '4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1', accept: ['e2e8'], completeness: { kind: 'lands', square: 'e8' }, text: 't', wrongDefault: 'x' }],
  };
  const r = createLessonRunner(lesson, { animalId: null });
  assert.ok(r.view.movable.dests.get('e2').includes('a2'), 'pseudo-legal pinned move offered');
  const v = r.dispatch({ type: 'move', from: 'e2', to: 'a2' });
  assert.equal(v.feedback.text, 'Tam nesmíš. Tvůj král by pak byl v šachu.');
  assert.deepEqual(v.shapes.at(-1), { from: 'e8', to: 'e1', brush: 'red' });
});

test('promotion defaults to a queen and needsPromotion sees it', () => {
  const lesson = {
    id: 't', level: 9, number: 1, title: 't', outro: 't',
    steps: [{ id: 'p', kind: 'move', fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1', accept: ['a7a8q', 'a7a8r'], completeness: { kind: 'lands', square: 'a8' }, text: 't', wrongDefault: 'x' }],
  };
  const r = createLessonRunner(lesson, { animalId: null });
  assert.ok(needsPromotion(r.view, 'a7', 'a8'));
  assert.equal(r.dispatch({ type: 'move', from: 'a7', to: 'a8' }).phase, 'stepDone');
  r.dispatch({ type: 'retry' });
  assert.equal(r.dispatch({ type: 'move', from: 'a7', to: 'a8', promotion: 'n' }).phase, 'wrong');
});

test('back / goTo / next refused on an unsolved task', () => {
  const lesson = byId('l1-vez');
  const r = createLessonRunner(lesson, { animalId: null });
  assert.equal(r.view.canBack, false);
  r.dispatch({ type: 'next' });
  assert.equal(r.view.stepIndex, 1);
  assert.equal(r.dispatch({ type: 'back' }).stepIndex, 0);
  assert.equal(r.goTo(99).stepIndex, lesson.steps.length - 1);
  r.dispatch({ type: 'next' }); // a choose step in task phase: next refused
  assert.equal(r.view.phase, 'task');
});

// 2b. Levels 2–3: every task step also gets a wrong answer (explained, never a bare „špatně“).
// Test lessons (one attempt, no retry) are covered separately below.
for (const lesson of COURSE.filter((l) => l.level === 2 || l.level === 3).flatMap((l) => l.lessons).filter((l) => !l.test)) {
  test(`${lesson.id}: wrong answers explained`, () => {
    let tasks = 0;
    for (const [i, step] of lesson.steps.entries()) {
      if (step.kind === 'show') continue;
      const r = createLessonRunner(lesson, { animalId: 'kuzlata' }, i);
      let v;
      if (step.kind === 'move') {
        // A specific wrong move when the step has one, otherwise any offered non-accepted move.
        const own = Object.keys(step.wrong ?? {})[0];
        let uci = own;
        if (!uci) {
          for (const [from, tos] of r.view.movable.dests) {
            const to = tos.find((t) => !step.accept.some((a) => a.startsWith(`${from}${t}`)));
            if (to) { uci = `${from}${to}`; break; }
          }
        }
        assert.ok(uci, `${step.id}: no wrong move offered`);
        v = r.dispatch({ type: 'move', from: uci.slice(0, 2), to: uci.slice(2, 4) });
        assert.equal(v.phase, 'wrong', `${step.id}: ${uci} not refused`);
        if (own) assert.equal(v.feedback.text, step.wrong[own]);
        assert.ok(r.dispatch({ type: 'retry' }).phase === 'task');
        const ok = step.accept[step.accept.length - 1]; // the last accepted answer works too
        assert.equal(r.dispatch({ type: 'move', from: ok.slice(0, 2), to: ok.slice(2, 4), promotion: ok[4] }).phase, 'stepDone', `${step.id}: ${ok} not accepted`);
      } else if (step.kind === 'choose') {
        const bad = step.options.find((o) => !step.correct.includes(o.id));
        v = bad.square ? r.dispatch({ type: 'square', square: bad.square }) : r.dispatch({ type: 'choose', id: bad.id });
        assert.equal(v.phase, 'task');
        assert.equal(v.feedback.text, step.wrongExplain?.[bad.id] ?? step.wrongDefault);
      }
      assert.equal(v.feedback.tone, 'bad');
      assert.ok(v.feedback.text.length > 10 && !/^špatně/i.test(v.feedback.text), `${step.id}: weak explanation`);
      tasks++;
    }
    assert.ok(tasks > 0, 'a lesson without tasks');
  });
}

test('level 2: stalemate instead of mate is named', () => {
  const v = wrongMove('l2-dama-kral', 'mate', 'b7', 'f7');
  assert.match(v.feedback.text, /^To je pat!/);
});

test('level 2: a pinned pawn cannot take — the mate is accepted', () => {
  const lesson = byId('l2-vazba');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'mate'));
  const v = r.dispatch({ type: 'move', from: 'e4', to: 'd6' });
  assert.equal(v.phase, 'stepDone');
});

test('level 2: black tasks are shown from black\'s side', () => {
  const lesson = byId('l2-ovcak');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'defend'));
  assert.equal(r.view.orientation, 'black');
  assert.equal(r.view.movable.color, 'black');
  assert.equal(r.dispatch({ type: 'move', from: 'g7', to: 'g6' }).phase, 'stepDone');
});

test('level 2: a piece left en prise in a tactic is explained', () => {
  // Scholar's defence: ...Dh4 lets the white queen take it.
  assert.equal(wrongMove('l2-ovcak', 'defend', 'd8', 'h4').feedback.text, 'Tady by ti dáma vzala dámu.');
});

// Level 4 (phase 22): correct paths run through the generic loop above; one wrong answer each.
test('level 4: l4-uvolneni — clearing the line without check is explained', () => {
  assert.equal(wrongMove('l4-uvolneni', 'rook-clear', 'f5', 'f7').feedback.text, 'Úhlopříčka je volná, ale bez šachu. Černý dostal čas se bránit.');
});

test('level 4: l4-preruseni — taking the defended knight is explained', () => {
  assert.equal(wrongMove('l4-preruseni', 'pawn-block', 'g3', 'h4').feedback.text, 'Jezdce kryje dáma f6. Po Dxh4 Dxh4 přijdeš o dámu.');
});

test('level 4: l4-mlyn — a move that ignores the windmill capture is explained', () => {
  assert.equal(wrongMove('l4-mlyn', 'check1', 'g3', 'g4').feedback.text, 'Zkus věží vzít pěšce g7 se šachem.');
});

test('level 4: l4-dvojsach — the other double check (no mate) is explained', () => {
  assert.equal(wrongMove('l4-dvojsach', 'double-check', 'd2', 'a5').feedback.text, 'Taky dvojšach, ale král uteče na e7 nebo e8. Tam mat nedáš.');
});

test('level 4: l4-dvojsach — blocking only one of two checks is explained', () => {
  const lesson = byId('l4-dvojsach');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'only-king'));
  const v = r.dispatch({ type: 'choose', id: 'zakryt' });
  assert.equal(v.feedback.text, 'Černý zakryje jen jeden šach. Ten druhý pořád platí.');
  assert.equal(r.dispatch({ type: 'choose', id: 'kral' }).phase, 'stepDone');
});

test('level 4: l4-recky-dar — "it works" where the bishop guards g5 is explained', () => {
  const lesson = byId('l4-recky-dar');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'fails-bishop'));
  const v = r.dispatch({ type: 'choose', id: 'ano' });
  assert.equal(v.feedback.text, 'Podívej se na černého střelce e7. Které pole hlídá?');
  assert.equal(r.dispatch({ type: 'choose', id: 'ne' }).phase, 'stepDone');
});

test('level 4: l4-tichy-tah — a rook check instead of the quiet move is explained', () => {
  assert.equal(wrongMove('l4-tichy-tah', 'quiet', 'f7', 'f8').feedback.text, 'Šach, ale černý vezme věž: Vxf8.');
});

test('level 4: l4-mat3 — a check that does not mate is explained', () => {
  assert.equal(wrongMove('l4-mat3', 'move1', 'd1', 'd5').feedback.text, 'Po Dd5+ vezme jezdec e7 dámu.');
});

test('level 4: l4-vez-dama-pesec — a quiet rook move instead of the check is explained', () => {
  assert.equal(wrongMove('l4-vez-dama-pesec', 'rook-check', 'h1', 'h2').feedback.text, 'Tohle není šach. Zkus šach po třetí řadě, daleko od krále.');
});

// 3. Texts.
test('placeholders: animal + chess name on first mention only', () => {
  assert.equal(resolveText('Tohle je {věž}. {Věž} jezdí rovně.', { animalId: 'kuzlata' }), 'Tohle je věž (u tebe kůzle s hradem na hlavě). Věž jezdí rovně.');
  assert.equal(resolveText('Tohle je {věž}.', { animalId: null }), 'Tohle je věž.');
  assert.equal(resolveText('{Dáma}!', { animalId: 'neznamy' }), 'Dáma (u tebe zvířátko s korunou)!');
  assert.ok(createLessonRunner(byId('l1-jezdec'), { animalId: 'kocky' }).view.text.startsWith('Tohle je jezdec (u tebe kočka s helmou s chocholem).'));
});

// 4. Board adapter glue.
test('renderToBoard drives the adapter', () => {
  const calls = [];
  const board = {
    setPosition: (...a) => calls.push(['setPosition', ...a]),
    setMovable: (m) => calls.push(['setMovable', m]),
    drawShapes: (s) => calls.push(['drawShapes', s]),
    showStars: (s) => calls.push(['showStars', s]),
  };
  const lesson = byId('l1-vez');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'which'));
  renderToBoard(board, r.view);
  assert.deepEqual(calls.map((c) => c[0]), ['setPosition', 'setMovable', 'drawShapes', 'showStars']);
  assert.equal(calls[0][1], lesson.steps[stepIndex(lesson, 'which')].fen);
  assert.equal(calls[1][1], null);
  assert.deepEqual(calls[2][1].map((s) => s.from), ['a6', 'c3', 'f1']);
  const r2 = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'stars'));
  calls.length = 0;
  renderToBoard(board, r2.view);
  assert.deepEqual(calls[3][1], ['a6', 'f6', 'f8']);
  assert.equal(calls[1][1].color, 'white');
});

// 5. Progress.
const fakeStorage = (initial) => {
  const m = new Map(initial === undefined ? [] : [[progress.LESSONS_STORAGE_KEY, initial]]);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

test('progress: garbage → defaults', () => {
  const warn = console.warn;
  console.warn = () => {};
  for (const raw of [undefined, 'not json', '[]', '42', 'null', '{"done":5,"teacher":"cat"}']) {
    assert.deepEqual(progress.readLessonProgress(fakeStorage(raw)), progress.defaultLessonProgress(), String(raw));
  }
  assert.deepEqual(progress.readLessonProgress(null), progress.defaultLessonProgress());
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(progress.readLessonProgress(throwing), progress.defaultLessonProgress());
  progress.writeLessonProgress(throwing, progress.defaultLessonProgress()); // must not throw
  console.warn = warn;
});

test('progress: round trip, unknown ids dropped, next lesson', () => {
  const s = fakeStorage('{"done":{"l1-vez":true,"nope":true,"l1-dama":"yes"},"tests":{"l1":true,"<x>":true},"badges":{},"teacher":"animal"}');
  let p = progress.readLessonProgress(s);
  assert.deepEqual(p, { done: { 'l1-vez': true }, tests: { l1: true }, badges: {}, teacher: 'animal' });
  assert.equal(progress.nextLesson(p).id, 'l1-sachovnice');
  p = progress.markLessonDone(s, p, 'l1-sachovnice'); // „Tohle umím“
  assert.equal(progress.nextLesson(p).id, 'l1-strelec');
  p = progress.setTeacher(s, p, 'owl');
  assert.deepEqual(progress.readLessonProgress(s), p);
});

// 6. Phase 21b — new explanations, castling, en passant, check highlight.
test('a stalemating move is explained as pat', () => {
  const v = wrongMove('l1-pat', 'avoid', 'e7', 'f7');
  assert.equal(v.phase, 'wrong');
  assert.equal(v.feedback.text, 'Pozor, to je pat! Soupeř nemá žádný tah a není v šachu. To je remíza.');
});

test('mate task: check but not mate shows the defence', () => {
  const v = wrongMove('l1-mat', 'queen-rank', 'b1', 'h1');
  assert.equal(v.feedback.text, 'To je šach, ale ne mat. Soupeř se ještě zachrání, podívej se na šipku.');
  assert.deepEqual(v.shapes.at(-1), { from: 'h8', to: 'g8', brush: 'red' });
  // Not a check at all → the step's own text.
  const w = wrongMove('l1-mat', 'back-rank', 'a1', 'a2');
  assert.equal(w.feedback.text, byId('l1-mat').steps[stepIndex(byId('l1-mat'), 'back-rank')].wrongDefault);
});

test('safe squares: a square the opponent guards is explained', () => {
  assert.equal(wrongMove('l1-utok-obrana', 'save', 'e4', 'f6').feedback.text, 'Tady by ti věž vzala jezdce.');
  assert.equal(wrongMove('l1-utok-obrana', 'save', 'e4', 'c5').feedback.text, 'Tady by ti střelec vzal jezdce.');
  assert.equal(wrongMove('l1-utok-obrana', 'take-free', 'c1', 'c4').feedback.text, 'Tady by ti pěšec vzal věž.');
});

test('check is highlighted in lessons (not in tests, not in diagrams)', () => {
  const sach = byId('l1-sach');
  assert.equal(createLessonRunner(sach, { animalId: null }).view.check, 'white');
  assert.equal(createLessonRunner(byId('l1-mat'), { animalId: null }).view.check, 'black');
  assert.equal(createLessonRunner(byId('l1-vez'), { animalId: null }).view.check, null);
  const exam = byId('l1-zkouska');
  assert.equal(createLessonRunner(exam, { animalId: null }, stepIndex(exam, 'state-check')).view.check, null);
});

test('check: escape, block, capture; a move that ignores the check is explained', () => {
  const v = wrongMove('l1-sach', 'escape', 'e1', 'd1');
  assert.equal(v.feedback.text, 'Tam nesmíš. To pole hlídá soupeřova věž.');
  assert.equal(wrongMove('l1-sach', 'block', 'c3', 'b5').feedback.text, 'Tvůj král je v šachu. Tenhle tah ho nezachrání.');
  assert.equal(wrongMove('l1-sach', 'capture', 'g3', 'f1').feedback.text, 'Tím šach zakryješ, to taky jde. Ale teď zkus věž vzít.');
});

test('castling: the king move castles, the other side is explained', () => {
  const lesson = byId('l1-rosada');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'short'));
  assert.ok(r.view.movable.dests.get('e1').includes('g1') && r.view.movable.dests.get('e1').includes('c1'));
  assert.equal(r.dispatch({ type: 'move', from: 'e1', to: 'c1' }).feedback.text, 'To je dlouhá rošáda, k věži na a1. Teď zkus krátkou, k věži na h1.');
  r.dispatch({ type: 'retry' });
  const v = r.dispatch({ type: 'move', from: 'e1', to: 'g1' });
  assert.equal(v.phase, 'stepDone');
  assert.ok(v.fen.startsWith('4k3/8/8/8/8/8/8/R4RK1 '), v.fen);
});

test('en passant: the pawn disappears', () => {
  const lesson = byId('l1-mimochodem');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'take'));
  const v = r.dispatch({ type: 'move', from: 'e5', to: 'd6' });
  assert.equal(v.phase, 'stepDone');
  assert.ok(v.fen.startsWith('4k3/8/3P4/8/8/8/8/4K3 '), v.fen);
});

test('promotion: every piece accepted in the lesson; a capture-promotion into a guarded square explained', () => {
  const lesson = byId('l1-promena');
  for (const p of ['q', 'r', 'b', 'n']) {
    const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'promote'));
    assert.equal(r.dispatch({ type: 'move', from: 'b7', to: 'b8', promotion: p }).phase, 'stepDone');
  }
  assert.equal(wrongMove('l1-promena', 'take-promote', 'c7', 'c8').feedback.text, 'Tady by ti věž vzala dámu.');
});

// 7. Mini-games.
test('mini: board, scoreboard, reply, needsPromotion off', () => {
  const lesson = byId('l1-pescova-valka');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'full'), { random: seededRandom(1) });
  let v = r.view;
  assert.equal(v.stepKind, 'mini');
  assert.deepEqual({ mine: v.mini.mine, theirs: v.mini.theirs, thinking: v.mini.thinking, result: v.mini.result }, { mine: 8, theirs: 8, thinking: false, result: null });
  assert.equal(v.check, null);
  assert.equal(v.movable.color, 'white');
  assert.deepEqual(v.movable.dests.get('e2').sort(), ['e3', 'e4']);
  assert.equal(v.movable.dests.get('e7'), undefined, 'only own pawns move');
  assert.ok(v.canNext, 'a mini-game can be skipped');
  assert.equal(r.dispatch({ type: 'move', from: 'e2', to: 'e5' }), v, 'an impossible move is ignored');
  assert.equal(r.dispatch({ type: 'reply' }), v, 'no reply before the child moved');
  v = r.dispatch({ type: 'move', from: 'e2', to: 'e4' });
  assert.equal(v.mini.thinking, true);
  assert.equal(v.movable, null);
  assert.equal(r.dispatch({ type: 'move', from: 'd2', to: 'd4' }), v, 'no move while the opponent thinks');
  v = r.dispatch({ type: 'reply' });
  assert.equal(v.mini.thinking, false);
  assert.equal(parsePlacement(v.fen).get(v.lastMove[1]).color, 'b', 'the opponent moved');
  assert.equal(needsPromotion({ ...v, fen: '8/P7/8/8/8/8/8/p7 w - - 0 1' }, 'a7', 'a8'), false);
});

test('mini: winning by promotion, losing by the opponent\'s promotion, a draw when blocked', () => {
  const mk = (fen, goal = 'promote-first') => ({
    id: 't', level: 9, number: 1, title: 't', outro: 't',
    steps: [{ id: 'm', kind: 'mini', fen, diagram: true, goal, engineLevel: 1, text: 't' }],
  });
  let r = createLessonRunner(mk('8/8/P7/8/8/8/7p/8 w - - 0 1'), { animalId: null });
  let v = r.dispatch({ type: 'move', from: 'a6', to: 'a7' });
  v = r.dispatch({ type: 'reply' }); // h2-h1: the opponent promotes first
  assert.equal(v.phase, 'wrong');
  assert.equal(v.mini.result, 'lost');
  assert.equal(v.feedback.text, 'Soupeřův pěšec doběhl na konec. Tentokrát vyhrál soupeř. Zkus to znovu!');
  assert.ok(v.canRetry && v.canNext);
  r = createLessonRunner(mk('8/P7/8/8/8/8/7p/8 w - - 0 1'), { animalId: null });
  v = r.dispatch({ type: 'move', from: 'a7', to: 'a8' });
  assert.equal(v.phase, 'stepDone');
  assert.equal(v.feedback.text, 'Tvůj pěšec doběhl na konec. Vyhráváš!');
  r = createLessonRunner(mk('8/8/8/p7/8/P7/8/8 w - - 0 1'), { animalId: null });
  v = r.dispatch({ type: 'move', from: 'a3', to: 'a4' }); // black a5 is now blocked
  assert.equal(v.phase, 'wrong');
  assert.equal(v.mini.result, 'draw');
  assert.equal(v.feedback.text, 'Soupeř nemá žádný tah. Je to remíza. Zkus to znovu!');
});

test('mini: the queen game — a pawn takes the queen, pawns pass when blocked', () => {
  const mk = (fen) => ({
    id: 't', level: 9, number: 1, title: 't', outro: 't',
    steps: [{ id: 'm', kind: 'mini', fen, diagram: true, goal: 'capture-all-pawns', engineLevel: 1, text: 't' }],
  });
  let r = createLessonRunner(mk('8/2p5/8/8/8/8/8/3Q4 w - - 0 1'), { animalId: null });
  let v = r.dispatch({ type: 'move', from: 'd1', to: 'd6' });
  v = r.dispatch({ type: 'reply' });
  assert.equal(v.mini.result, 'lost');
  assert.equal(v.feedback.text, 'Pěšec ti vzal dámu. Tentokrát vyhrál soupeř. Zkus to znovu!');
  r = createLessonRunner(mk('8/2p5/8/8/8/8/8/2Q5 w - - 0 1'), { animalId: null });
  v = r.dispatch({ type: 'move', from: 'c1', to: 'c6' }); // blocks the only pawn
  v = r.dispatch({ type: 'reply' });
  assert.equal(v.feedback.text, 'Soupeř nemůže táhnout. Hraješ znovu ty.');
  assert.equal(v.movable.color, 'white');
  v = r.dispatch({ type: 'move', from: 'c6', to: 'c7' });
  assert.equal(v.phase, 'stepDone');
  assert.equal(v.mini.result, 'won');
});

test('mini: the weak picker is beatable through the runner (careful beginner, 100 games)', () => {
  for (const [lessonId, stepId, minWins] of [['l1-pescova-valka', 'full', 70], ['l1-hodnota', 'queen-vs-pawns', 80]]) {
    const lesson = byId(lessonId);
    const step = lesson.steps[stepIndex(lesson, stepId)];
    let wins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const random = seededRandom(seed);
      const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, stepId), { random });
      let v = r.view;
      for (let ply = 0; ply < 300 && v.phase === 'task'; ply++) {
        const m = childMove(step.goal, parsePlacement(v.fen), 'w', random);
        v = r.dispatch({ type: 'move', from: m[0], to: m[1] });
        if (v.phase === 'task') v = r.dispatch({ type: 'reply' });
      }
      if (v.mini?.result === 'won') wins++;
    }
    assert.ok(wins >= minWins, `${lessonId}: ${wins} wins of 100`);
  }
});

// 8. Level test.
const exam = byId('l1-zkouska');
const exam2 = byId('l2-zkouska');
/** Answers the test: `wrongAt` = step ids answered wrongly. Returns the final view. */
function takeExam(wrongAt, lesson = exam) {
  const r = createLessonRunner(lesson, { animalId: null });
  let v = r.view;
  for (const step of lesson.steps) {
    const wrong = wrongAt.includes(step.id);
    if (step.kind === 'choose') {
      const opt = step.options.find((o) => (wrong ? !step.correct.includes(o.id) : step.correct.includes(o.id)));
      v = opt.square ? r.dispatch({ type: 'square', square: opt.square }) : r.dispatch({ type: 'choose', id: opt.id });
    } else if (step.kind === 'move') {
      const dests = v.movable.dests;
      let uci = step.accept[0];
      if (wrong) {
        const [from, tos] = [...dests].find(([f, t]) => t.some((to) => !step.accept.some((a) => a.startsWith(f + to)))) ?? [];
        uci = from ? from + tos.find((to) => !step.accept.some((a) => a.startsWith(from + to))) : 'f7f8q';
        if (step.id === 'promote') uci = 'f7f8q';
      }
      v = r.dispatch({ type: 'move', from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } else if (step.kind === 'collect') {
      const path = wrong ? [['g1', 'h3'], ['h3', 'g5'], ['g5', 'h7']] : collectPath(step);
      for (const [from, to] of path) v = r.dispatch({ type: 'move', from, to });
    }
    if (step.kind !== 'show') {
      assert.equal(v.phase, 'stepDone', `${step.id}: one attempt, then done`);
      assert.equal(v.feedback.tone, wrong ? 'bad' : 'good', `${step.id}: ${v.feedback.text}`);
      if (wrong) assert.match(v.feedback.text, /^Tohle ne\. /);
      assert.equal(v.canRetry, false);
      assert.equal(v.canBack, false);
    }
    v = r.dispatch({ type: 'next' });
  }
  return { r, v };
}

test('test: the first answer is final, wrong answers show the solution', () => {
  const r = createLessonRunner(exam, { animalId: null }, stepIndex(exam, 'square'));
  let v = r.dispatch({ type: 'choose', id: 'f6' });
  assert.equal(v.phase, 'stepDone');
  assert.equal(v.feedback.text, 'Tohle ne. Sloupec g, řada 6. Je to pole g6.');
  assert.equal(v.choices.find((c) => c.id === 'g6').state, 'correct');
  assert.equal(r.dispatch({ type: 'choose', id: 'g6' }), v, 'no second attempt');
  const m = createLessonRunner(exam, { animalId: null }, stepIndex(exam, 'promote'));
  v = m.dispatch({ type: 'move', from: 'f7', to: 'f8', promotion: 'q' });
  assert.equal(v.feedback.text, 'Tohle ne. Pozor, to je pat! Soupeř nemá žádný tah a není v šachu. To je remíza.');
  assert.deepEqual(v.shapes.at(-1), { from: 'f7', to: 'f8', brush: 'green' });
  const ok = createLessonRunner(exam, { animalId: null }, stepIndex(exam, 'square'));
  assert.equal(ok.dispatch({ type: 'choose', id: 'g6' }).feedback.text, 'Správně! Sloupec g, řada 6. Je to pole g6.');
  const c = createLessonRunner(exam, { animalId: null }, stepIndex(exam, 'knight'));
  for (const [f, t] of [['g1', 'h3'], ['h3', 'g5'], ['g5', 'h7']]) v = c.dispatch({ type: 'move', from: f, to: t });
  assert.equal(v.feedback.text, 'Tohle ne. Došly ti tahy. Jde to na 3 tahy.');
  const k = createLessonRunner(exam, { animalId: null }, stepIndex(exam, 'escape'));
  v = k.dispatch({ type: 'move', from: 'h1', to: 'g1' });
  assert.equal(v.phase, 'stepDone');
  assert.equal(v.feedback.text, 'Tohle ne. Tam nesmíš. To pole hlídá soupeřova věž.');
});

test('test: 11/11, 9/11 pass; 8/11 fails with its own outro and no practice; restart', () => {
  let { r, v } = takeExam([]);
  assert.deepEqual(v.test, { correct: 11, answered: 11, total: 11, passScore: 9, passed: true });
  ({ v } = takeExam(['square', 'knight']));
  assert.equal(v.test.correct, 9);
  assert.equal(v.test.passed, true);
  assert.equal(v.outro, exam.outro);
  ({ r, v } = takeExam(['knight', 'state-pat', 'promote']));
  assert.equal(v.phase, 'lessonDone');
  assert.deepEqual(v.test, { correct: 8, answered: 11, total: 11, passScore: 9, passed: false });
  assert.equal(v.outro, exam.test.failOutro);
  assert.deepEqual(v.practice, []);
  v = r.dispatch({ type: 'restart' });
  assert.equal(v.stepIndex, 0);
  assert.equal(v.phase, 'task');
  assert.deepEqual(v.test, { correct: 0, answered: 0, total: 11, passScore: 9, passed: null });
});

// 8b. Level 3 test (same one-attempt/pass/fail/restart rules as l1-zkouska).
const exam3 = byId('l3-zkouska');
test('l3 test: 11/11, 9/11 pass; 8/11 fails with its own outro and no practice; restart', () => {
  let { v } = takeExam([], exam3);
  assert.deepEqual(v.test, { correct: 11, answered: 11, total: 11, passScore: 9, passed: true });
  assert.equal(v.outro, exam3.outro);
  ({ v } = takeExam(['t-guard', 't-lure'], exam3));
  assert.equal(v.test.correct, 9);
  assert.equal(v.test.passed, true);
  let r;
  ({ r, v } = takeExam(['t-guard', 't-lure', 't-attract'], exam3));
  assert.equal(v.phase, 'lessonDone');
  assert.deepEqual(v.test, { correct: 8, answered: 11, total: 11, passScore: 9, passed: false });
  assert.equal(v.outro, exam3.test.failOutro);
  assert.deepEqual(v.practice, []);
  v = r.dispatch({ type: 'restart' });
  assert.equal(v.stepIndex, 0);
  assert.equal(v.phase, 'task');
  assert.deepEqual(v.test, { correct: 0, answered: 0, total: 11, passScore: 9, passed: null });
});

test('progress: a passed test marks done, test and badge', () => {
  const s = fakeStorage();
  let p = progress.readLessonProgress(s);
  p = progress.markTestPassed(s, p, exam);
  assert.deepEqual(progress.readLessonProgress(s), { done: { 'l1-zkouska': true }, tests: { l1: true }, badges: { l1: true }, teacher: 'owl' });
  assert.equal(progress.markTestPassed(s, p, byId('l1-vez')), p, 'not a test: nothing');
});

test('level 2 test: 10/10, 8/10 pass; 7/10 fails with its own outro and no practice; restart', () => {
  let { r, v } = takeExam([], exam2);
  assert.deepEqual(v.test, { correct: 10, answered: 10, total: 10, passScore: 8, passed: true });
  ({ v } = takeExam(['notation', 'vazba'], exam2));
  assert.equal(v.test.correct, 8);
  assert.equal(v.test.passed, true);
  assert.equal(v.outro, exam2.outro);
  ({ r, v } = takeExam(['notation', 'vazba', 'zahajeni'], exam2));
  assert.equal(v.phase, 'lessonDone');
  assert.deepEqual(v.test, { correct: 7, answered: 10, total: 10, passScore: 8, passed: false });
  assert.equal(v.outro, exam2.test.failOutro);
  assert.deepEqual(v.practice, []);
  v = r.dispatch({ type: 'restart' });
  assert.equal(v.stepIndex, 0);
  assert.equal(v.phase, 'task');
  assert.deepEqual(v.test, { correct: 0, answered: 0, total: 10, passScore: 8, passed: null });
});

test('progress: a passed level 2 test marks its own done/test/badge id', () => {
  const s = fakeStorage();
  let p = progress.readLessonProgress(s);
  p = progress.markTestPassed(s, p, exam2);
  assert.deepEqual(progress.readLessonProgress(s), { done: { 'l2-zkouska': true }, tests: { l2: true }, badges: { l2: true }, teacher: 'owl' });
});

test('diploma name: stored only when remembered, cleaned', () => {
  const m = new Map();
  const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  assert.equal(diploma.readDiplomaName(s), null);
  diploma.writeDiplomaName(s, 'Eliška', false);
  assert.equal(m.size, 0);
  diploma.writeDiplomaName(s, '  Eliš\u0007ka \u202eNováková  ', true);
  assert.equal(diploma.readDiplomaName(s), 'Eliška Nováková');
  diploma.writeDiplomaName(s, 'x'.repeat(100), true);
  assert.equal(diploma.readDiplomaName(s).length, diploma.DIPLOMA_NAME_MAX);
  diploma.writeDiplomaName(s, 'Eliška', false);
  assert.equal(diploma.readDiplomaName(s), null);
  const throwing = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  assert.equal(diploma.readDiplomaName(throwing), null);
  const warn = console.warn;
  console.warn = () => {};
  diploma.writeDiplomaName(throwing, 'a', true);
  console.warn = warn;
  assert.equal(diploma.czechDate(new Date(2026, 8, 26)), '26. 9. 2026');
});

// Level 5, first batch (lucena/philidor/bb/kombinace): a few targeted checks beyond the
// generic correct-path loop above.
const chooseAt = (lessonId, stepId, id) => {
  const lesson = byId(lessonId);
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, stepId));
  return r.dispatch({ type: 'choose', id });
};
const squareAt = (lessonId, stepId, square) => {
  const lesson = byId(lessonId);
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, stepId));
  return r.dispatch({ type: 'square', square });
};

test('l5-lucena: a king move that keeps the checks going is explained, then the bridge', () => {
  const v = chooseAt('l5-lucena', 'checks', 'kc5');
  assert.equal(v.phase, 'task');
  assert.match(v.feedback.text, /sebere pěšce b7/);
  assert.equal(chooseAt('l5-lucena', 'checks', 'vb4').phase, 'stepDone');
});

test('l5-lucena: a winning but off-plan rook move is explained kindly', () => {
  const lesson = byId('l5-lucena');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'rook4'));
  const v = r.dispatch({ type: 'move', from: 'd1', to: 'd5' });
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /I to vyhrává/);
});

test('l5-lucena: the promotion offers a choice; a queen wins, a bishop is explained as a draw', () => {
  const lesson = byId('l5-lucena');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'promote'));
  assert.ok(needsPromotion(r.view, 'b7', 'b8'));
  const w = r.dispatch({ type: 'move', from: 'b7', to: 'b8', promotion: 'b' });
  assert.notEqual(w.phase, 'stepDone');
  assert.match(w.feedback.text, /remíza/);
  const r2 = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'promote'));
  assert.equal(r2.dispatch({ type: 'move', from: 'b7', to: 'b8', promotion: 'q' }).phase, 'stepDone');
});

test('l5-philidor: a side check from a5 is explained, then the rook goes far behind', () => {
  const v = chooseAt('l5-philidor', 'switch', 'a5');
  assert.equal(v.phase, 'task');
  assert.match(v.feedback.text, /hrozí mat/);
  assert.equal(chooseAt('l5-philidor', 'switch', 'a1').phase, 'stepDone');
});

test('l5-dva-strelci: reachable verify — a square the bishop wall guards is refused', () => {
  const v = squareAt('l5-dva-strelci', 'reach', 'e5');
  assert.equal(v.phase, 'task');
  assert.match(v.feedback.text, /hlídá střelec d4/);
  assert.equal(squareAt('l5-dva-strelci', 'reach', 'e7').phase, 'stepDone');
});

test('l5-dva-strelci: the final mate is Sh6-g7#', () => {
  const lesson = byId('l5-dva-strelci');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'mate'));
  const v = r.dispatch({ type: 'move', from: 'h6', to: 'g7' });
  assert.equal(v.phase, 'stepDone');
});

test('l5-kombinace: both forced queen mates are accepted (Df6+ as played, Dxf7 too)', () => {
  const lesson = byId('l5-kombinace');
  for (const to of ['f6', 'f7']) {
    const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'qf6'));
    assert.equal(r.dispatch({ type: 'move', from: 'f3', to }).phase, 'stepDone', `Df3-${to}`);
  }
});

// Level 4 lessons 8–11 and level 5 lessons 3, 5, 8, 11, 12 (Phase 22, tablebase batch).
const moveAt = (lessonId, stepId, from, to, promotion) => {
  const lesson = byId(lessonId);
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, stepId));
  return r.dispatch({ type: 'move', from, to, promotion });
};

test('l4-zachrana: both drawing queen sacrifices are accepted, a quiet move is explained', () => {
  for (const to of ['g8', 'h8']) assert.equal(moveAt('l4-zachrana', 'evans-queen', 'c8', to).phase, 'stepDone', `Dc8-${to}`);
  const v = moveAt('l4-zachrana', 'evans-queen', 'c8', 'c7');
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /Obětuj dámu se šachem/);
});

test('l4-zachrana: the final position is stalemate, not mate', () => {
  assert.match(chooseAt('l4-zachrana', 'evans-stalemate', 'mat').feedback.text, /není v šachu/);
  assert.equal(chooseAt('l4-zachrana', 'evans-stalemate', 'pat').phase, 'stepDone');
});

test('l4-klicova-pole: only the opposition wins; another king move is explained', () => {
  assert.equal(moveAt('l4-klicova-pole', 'take-opposition', 'e2', 'd3').phase, 'stepDone');
  const v = moveAt('l4-klicova-pole', 'take-opposition', 'e2', 'e3');
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /výhru pustí/);
});

test('l4-trojuhelnik: Kd4 guards c5; another king move is explained', () => {
  assert.equal(moveAt('l4-trojuhelnik', 'triangle-move', 'e5', 'd4').phase, 'stepDone');
  assert.match(moveAt('l4-trojuhelnik', 'triangle-move', 'e5', 'e4').feedback.text, /napadá pěšce c5/);
});

test('l4-prulom: an edge pawn first is explained; b6 is accepted', () => {
  assert.match(moveAt('l4-prulom', 'break', 'a5', 'a6').feedback.text, /prostředním pěšcem/);
  assert.equal(moveAt('l4-prulom', 'break', 'b5', 'b6').phase, 'stepDone');
});

test('l5-tarrasch: the side-on winning rook move is explained kindly', () => {
  const v = moveAt('l5-tarrasch', 'behind-own', 'c1', 'c5');
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /I to vyhrává/);
  assert.equal(chooseAt('l5-tarrasch', 'behind-theirs', 'b1').phase, 'stepDone');
});

test('l5-volny-pesec: Kc4 is explained as a draw; both central king moves win', () => {
  assert.match(moveAt('l5-volny-pesec', 'centre', 'd3', 'c4').feedback.text, /remíza/);
  for (const to of ['d4', 'e4']) assert.equal(moveAt('l5-volny-pesec', 'centre', 'd3', to).phase, 'stepDone');
});

test('l5-nestejnobarevni: only Sg7 builds the fortress', () => {
  assert.equal(moveAt('l5-nestejnobarevni', 'build', 'h6', 'g7').phase, 'stepDone');
  assert.notEqual(moveAt('l5-nestejnobarevni', 'build', 'h6', 'f8').phase, 'stepDone');
});

const exam4 = byId('l4-zkouska');
test('l4 test: 10/10, 8/10 pass; 7/10 fails with its own outro and no practice; restart', () => {
  let { r, v } = takeExam([], exam4);
  assert.deepEqual(v.test, { correct: 10, answered: 10, total: 10, passScore: 8, passed: true });
  assert.equal(v.outro, exam4.outro);
  ({ v } = takeExam(['t-clearance', 't-greek'], exam4));
  assert.equal(v.test.correct, 8);
  assert.equal(v.test.passed, true);
  ({ r, v } = takeExam(['t-clearance', 't-greek', 't-key'], exam4));
  assert.deepEqual(v.test, { correct: 7, answered: 10, total: 10, passScore: 8, passed: false });
  assert.equal(v.outro, exam4.test.failOutro);
  assert.deepEqual(v.practice, []);
  v = r.dispatch({ type: 'restart' });
  assert.equal(v.stepIndex, 0);
  assert.deepEqual(v.test, { correct: 0, answered: 0, total: 10, passScore: 8, passed: null });
});

const exam5 = byId('l5-zkouska');
test('l5 test: 11/11, 9/11 pass; 8/11 fails with its own outro and no practice; restart', () => {
  let { r, v } = takeExam([], exam5);
  assert.deepEqual(v.test, { correct: 11, answered: 11, total: 11, passScore: 9, passed: true });
  assert.equal(v.outro, exam5.outro);
  ({ v } = takeExam(['t-lucena', 't-outside'], exam5));
  assert.equal(v.test.correct, 9);
  assert.equal(v.test.passed, true);
  ({ r, v } = takeExam(['t-lucena', 't-outside', 't-exchange'], exam5));
  assert.deepEqual(v.test, { correct: 8, answered: 11, total: 11, passScore: 9, passed: false });
  assert.equal(v.outro, exam5.test.failOutro);
  assert.deepEqual(v.practice, []);
  v = r.dispatch({ type: 'restart' });
  assert.equal(v.stepIndex, 0);
  assert.deepEqual(v.test, { correct: 0, answered: 0, total: 11, passScore: 9, passed: null });
});

test('progress: passing the level 4 and 5 tests stores their own badges', () => {
  const s = fakeStorage();
  let p = progress.readLessonProgress(s);
  p = progress.markTestPassed(s, p, exam4);
  p = progress.markTestPassed(s, p, exam5);
  const got = progress.readLessonProgress(s);
  assert.deepEqual(got.badges, { l4: true, l5: true });
  assert.deepEqual(got.tests, { l4: true, l5: true });
});

// Level 6 (Phase 22).
test('l6-klicova-pole: both key squares are accepted, the pawn push is explained as a draw', () => {
  for (const to of ['d6', 'e6']) assert.equal(moveAt('l6-klicova-pole', 'step-in', 'd5', to).phase, 'stepDone', `Kd5-${to}`);
  const v = moveAt('l6-klicova-pole', 'step-in', 'e5', 'e6');
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /remíza/);
  assert.match(moveAt('l6-klicova-pole', 'rook-pawn-key', 'a6', 'b6').feedback.text, /c8/);
});

test('l6-reti: only the diagonal king move is accepted', () => {
  assert.equal(moveAt('l6-reti', 'diagonal', 'h8', 'g7').phase, 'stepDone');
  assert.notEqual(moveAt('l6-reti', 'diagonal', 'h8', 'h7').phase, 'stepDone');
});

test('l6-saavedra: the queen promotion is explained as stalemate, the rook wins', () => {
  const q = moveAt('l6-saavedra', 'rook', 'c7', 'c8', 'q');
  assert.notEqual(q.phase, 'stepDone');
  assert.match(q.feedback.text, /pat/);
  assert.match(moveAt('l6-saavedra', 'rook', 'c7', 'c8', 'n').feedback.text, /sebere jezdce/);
  assert.equal(moveAt('l6-saavedra', 'rook', 'c7', 'c8', 'r').phase, 'stepDone');
  assert.equal(chooseAt('l6-saavedra', 'trick', 'pat').phase, 'stepDone');
});

test('l6-vancura: the side-on check is explained kindly, the rook behind the pawn is not enough', () => {
  const v = moveAt('l6-vancura', 'build', 'f1', 'f4');
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /drží remízu/);
  assert.match(moveAt('l6-vancura', 'build', 'f1', 'a1').feedback.text, /prohrává/);
  assert.equal(moveAt('l6-vancura', 'check', 'f6', 'f5').phase, 'stepDone');
});

test('l6-lehka-figura-pesec: both knight moves in time are accepted', () => {
  for (const to of ['d2', 'e3']) assert.equal(moveAt('l6-lehka-figura-pesec', 'knight-stop', 'f1', to).phase, 'stepDone', `Jf1-${to}`);
  assert.notEqual(moveAt('l6-lehka-figura-pesec', 'knight-stop', 'f1', 'g3').phase, 'stepDone');
});

test('l6-vzajemna-nevyhoda: Kc5 wins, attacking d5 from d6 is explained', () => {
  assert.equal(moveAt('l6-vzajemna-nevyhoda', 'reach', 'c6', 'c5').phase, 'stepDone');
  assert.match(moveAt('l6-vzajemna-nevyhoda', 'reach', 'c6', 'd6').feedback.text, /Kxd4/);
});

test('l6-obranny-tah: the natural recapture is explained', () => {
  const lesson = byId('l6-obranny-tah');
  const r = createLessonRunner(lesson, { animalId: null }, stepIndex(lesson, 'king'));
  const v = r.dispatch({ type: 'move', from: 'b7', to: 'c6' });
  assert.notEqual(v.phase, 'stepDone');
  assert.match(v.feedback.text, /věž a8/);
});

const exam6 = byId('l6-zkouska');
test('l6 test: 11/11, 9/11 pass; 8/11 fails with its own outro and no practice; restart', () => {
  let { r, v } = takeExam([], exam6);
  assert.deepEqual(v.test, { correct: 11, answered: 11, total: 11, passScore: 9, passed: true });
  assert.equal(v.outro, exam6.outro);
  ({ v } = takeExam(['t-mate4', 't-zugzwang'], exam6));
  assert.equal(v.test.correct, 9);
  assert.equal(v.test.passed, true);
  ({ r, v } = takeExam(['t-mate4', 't-zugzwang', 't-reti'], exam6));
  assert.deepEqual(v.test, { correct: 8, answered: 11, total: 11, passScore: 9, passed: false });
  assert.equal(v.outro, exam6.test.failOutro);
  assert.deepEqual(v.practice, []);
  v = r.dispatch({ type: 'restart' });
  assert.equal(v.stepIndex, 0);
  assert.deepEqual(v.test, { correct: 0, answered: 0, total: 11, passScore: 9, passed: null });
});

test('progress: passing the level 6 test stores its own badge', () => {
  const s = fakeStorage();
  let p = progress.readLessonProgress(s);
  p = progress.markTestPassed(s, p, exam6);
  assert.deepEqual(progress.readLessonProgress(s).badges, { l6: true });
});

console.log(`test-lesson-runner: ${passed} passed${process.exitCode ? ', FAILURES above' : ''}`);
