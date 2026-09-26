// Node test of the lesson runner (src/lessons/runner.ts): drives every lesson through its
// correct answers, then checks wrong answers, explanations, text resolution, the board
// adapter glue and progress storage. Run: npm run test:lessons
import './ts-hooks.mjs';
import assert from 'node:assert/strict';

const { COURSE, allLessons } = await import('../src/lessons/course.ts');
const { createLessonRunner, renderToBoard, needsPromotion } = await import('../src/lessons/runner.ts');
const { parsePlacement, pseudoTargets } = await import('../src/lessons/geometry.ts');
const { resolveText } = await import('../src/lessons/text.ts');
const progress = await import('../src/lessons/progress.ts');

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

// 1. Every lesson end to end with correct answers.
for (const level of COURSE) {
  for (const lesson of level.lessons) {
    test(`${lesson.id}: correct path`, () => {
      const r = createLessonRunner(lesson, { animalId: 'kuzlata' });
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
      assert.ok(r.view.outro);
      assert.equal(r.view.canNext, false);
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

// 2b. Level 2: every task step also gets a wrong answer (explained, never a bare „špatně“).
for (const lesson of COURSE.find((l) => l.level === 2)?.lessons ?? []) {
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

console.log(`test-lesson-runner: ${passed} passed${process.exitCode ? ', FAILURES above' : ''}`);
