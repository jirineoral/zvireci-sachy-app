// Lesson video: lesson data -> storyboard (segments, narration, board views, annotations).
// Pure and deterministic: no timing here beyond fixed shot lengths; the narration lengths
// are filled in by build.mjs after TTS. Every derived arrow is checked against the rules:
// chess.js for legal positions, src/lessons/geometry.ts for king-less diagrams.
import '../ts-hooks.mjs';
import { Chess } from 'chess.js';
import { ordinalF, pronounce, spokenOptions } from './pronounce.mjs';

const { COURSE, findLesson } = await import('../../src/lessons/course.ts');
const { resolveText, PIECE_NAMES } = await import('../../src/lessons/text.ts');
const { parsePlacement, placementOf, pseudoTargets, attacks, moved } = await import('../../src/lessons/geometry.ts');

export const TIMING = {
  titleLead: 0.5,
  titleTail: 0.8,
  titleMin: 3.0,
  lead: 0.3, // silence before the owl speaks in a segment
  tail: 0.7, // silence after
  questionTail: 0.4,
  think: 2.5, // the pause after a question, before the solution
  arrowLead: 0.8, // solution arrow shown on the position before the move
  anim: 0.4, // one move animation
  collectArrow: 0.45,
  collectAnim: 0.35,
  solutionTail: 1.0,
  endCard: 4.0,
};

const SUCCESS_DEFAULT = 'Výborně!';
const COLLECT_DONE_DEFAULT = 'Všechny hvězdy jsou tvoje!';
const MINI_NOTE = 'Tuhle hru si zahraj v aplikaci.';
const ATTACK_WORDS = /napad|útok|útočí|vidlič|šach|hroz/i;

export function levelTitle(level) {
  return COURSE.find((l) => l.level === level)?.title ?? '';
}

const placementOfFen = (fen) => fen.trim().split(/\s+/)[0];
const turnOfFen = (fen) => fen.trim().split(/\s+/)[1] ?? 'w';

function isLegalPosition(step) {
  return !step.diagram;
}

/** Squares of enemy pieces attacked by the piece on `sq` (after a move), verified. */
function attackedEnemies(fen, sq, diagram) {
  const board = parsePlacement(fen);
  const me = board.get(sq);
  if (!me) return [];
  const targets = attacks(board, sq).filter((t) => board.get(t) && board.get(t).color !== me.color);
  if (diagram) return targets;
  const chess = new Chess(fen);
  // chess.js cross-check: the attacker set of each target must contain `sq`.
  return targets.filter((t) => chess.attackers(t, me.color).includes(sq));
}

function checkArrows(fen) {
  const chess = new Chess(fen);
  if (!chess.inCheck()) return [];
  const us = chess.turn();
  const them = us === 'w' ? 'b' : 'w';
  const king = chess.findPiece({ type: 'k', color: us })[0];
  return chess.attackers(king, them).map((from) => ({ from, to: king, brush: 'red', derived: 'check (chess.js)' }));
}

/** The move of a `move` step, played with chess.js (or geometry for a diagram). */
function playMove(step, uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci[4];
  if (!isLegalPosition(step)) {
    const board = parsePlacement(step.fen);
    if (!pseudoTargets(board, from).includes(to)) throw new Error(`${step.id}: ${uci} is not a move in the diagram`);
    const after = moved(board, from, to, promotion);
    return { fenAfter: `${placementOf(after)} ${turnOfFen(step.fen)} - - 0 1`, moves: [{ from, to }], captured: board.has(to) ? to : null, san: uci };
  }
  const chess = new Chess(step.fen);
  const m = chess.move({ from, to, promotion }); // throws on an illegal move
  const moves = [{ from, to }];
  let captured = m.captured ? to : null;
  if (m.flags.includes('k') || m.flags.includes('q')) {
    const rank = from[1];
    const [rf, rt] = m.flags.includes('k') ? ['h', 'f'] : ['a', 'd'];
    moves.push({ from: `${rf}${rank}`, to: `${rt}${rank}` });
  }
  if (m.flags.includes('e')) captured = `${to[0]}${from[1]}`;
  return { fenAfter: chess.fen(), moves, captured, san: m.san };
}

/** Shortest path (fewest moves) of the collect piece over all stars; landing collects. */
function solveCollect(step) {
  const board0 = parsePlacement(step.fen);
  const n = step.stars.length;
  const full = (1 << n) - 1;
  const key = (sq, mask) => `${sq}|${mask}`;
  const start = { sq: step.piece, mask: 0, board: board0, path: [] };
  const seen = new Set([key(step.piece, 0)]);
  let frontier = [start];
  const limit = step.maxMoves ?? 12;
  for (let depth = 0; depth < limit && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      const targets = pseudoTargets(node.board, node.sq);
      // stars first: a natural, deterministic path
      targets.sort((a, b) => Number(step.stars.includes(b)) - Number(step.stars.includes(a)));
      for (const t of targets) {
        if (node.board.get(t)) continue; // obstacles are never taken
        const i = step.stars.indexOf(t);
        const mask = i >= 0 ? node.mask | (1 << i) : node.mask;
        const k = key(t, mask);
        if (seen.has(k)) continue;
        seen.add(k);
        const child = { sq: t, mask, board: moved(node.board, node.sq, t), path: [...node.path, [node.sq, t]] };
        if (mask === full) return child.path;
        next.push(child);
      }
    }
    frontier = next;
  }
  throw new Error(`${step.id}: no collect path within ${limit} moves`);
}

/** Pieces of the side to move that can go to `sq` in one move (verified). */
function reachers(step, sq) {
  if (isLegalPosition(step)) {
    const chess = new Chess(step.fen);
    return chess.moves({ verbose: true }).filter((m) => m.to === sq).map((m) => m.from);
  }
  const board = parsePlacement(step.fen);
  const side = turnOfFen(step.fen);
  return [...board].filter(([s, p]) => p.color === side && pseudoTargets(board, s).includes(sq)).map(([s]) => s);
}

/** Choose step with stars and one piece: the shortest path to the star, if it exists. */
function starPath(step) {
  if (!step.stars?.length || step.stars.length !== 1) return null;
  const board = parsePlacement(step.fen);
  const side = turnOfFen(step.fen);
  const own = [...board].filter(([, p]) => p.color === side);
  if (own.length !== 1) return null;
  try {
    return solveCollect({ id: step.id, fen: step.fen, piece: own[0][0], stars: step.stars, maxMoves: 4 });
  } catch {
    return null;
  }
}

function boardView(fen, orientation, extra = {}) {
  return {
    placement: placementOfFen(fen),
    orientation: orientation ?? 'white',
    highlights: extra.highlights ?? [],
    shapes: extra.shapes ?? [],
    stars: extra.stars ?? [],
  };
}

const authored = (step) => (step.shapes ?? []).map((s) => ({ from: s.from, to: s.to, brush: s.brush ?? 'green', label: s.label }));

function optionShapes(step, state) {
  return step.options.filter((o) => o.square).map((o) => ({ from: o.square, brush: state(o) }));
}

function chips(step, correctShown) {
  const text = step.options.filter((o) => o.label);
  if (!text.length) return [];
  return text.map((o) => ({ label: o.label, state: correctShown && step.correct.includes(o.id) ? 'correct' : 'idle' }));
}


export function listLessons() {
  return COURSE.flatMap((l) => l.lessons.map((x) => ({ id: x.id, level: x.level, number: x.number, title: x.title })));
}

/**
 * @param {string} lessonId
 * @param {{animal?: string}} opts animal = the white character, for the {piece} texts.
 */
export function buildStoryboard(lessonId, opts = {}) {
  const lesson = findLesson(lessonId);
  if (!lesson) throw new Error(`Unknown lesson id "${lessonId}". Try --list.`);
  const ctx = { animalId: opts.animal ?? 'kuzlata' };
  const T = TIMING;
  const segments = [];
  const say = (screen, extraTts) => ({ screen, tts: pronounce(extraTts ? `${screen} ${extraTts}` : screen) });
  const header = `Lekce ${lesson.number} · ${lesson.title}`;
  const nSteps = lesson.steps.length;

  segments.push({
    id: 'title',
    kind: 'title',
    step: null,
    voice: { screen: `${ordinalF(lesson.number)[0].toUpperCase()}${ordinalF(lesson.number).slice(1)} lekce: ${lesson.title}.`, tts: pronounce(`${ordinalF(lesson.number)} lekce: ${lesson.title}.`) },
    voiceLead: T.titleLead,
    tail: T.titleTail,
    minDur: T.titleMin,
    shots: [{ kind: 'card', card: 'title', fill: true }],
  });

  let lastBoard = null;
  lesson.steps.forEach((step, i) => {
    const text = resolveText(step.text, ctx);
    const counter = `Krok ${i + 1} z ${nSteps}`;
    const orientation = step.orientation ?? 'white';
    const base = { header, counter };
    const stars = step.kind === 'collect' ? [...step.stars] : [...(step.stars ?? [])];
    const notes = [];

    if (step.kind === 'show' || step.kind === 'mini') {
      const shapes = authored(step);
      if (!step.diagram && !shapes.some((s) => s.to) && /napad|šach(?!ovnic)/i.test(step.text)) {
        const derived = checkArrows(step.fen);
        shapes.push(...derived);
        derived.forEach((d) => notes.push(`derived ${d.derived}: ${d.from}->${d.to}`));
      }
      const board = boardView(step.fen, orientation, { shapes, stars });
      const isMini = step.kind === 'mini';
      segments.push({
        id: `${step.id}`,
        kind: 'show',
        step: step.id,
        voice: isMini ? say(text, MINI_NOTE) : say(text),
        voiceLead: T.lead,
        tail: T.tail,
        notes,
        shots: [{ kind: 'still', fill: true, view: { ...base, board, bubble: { text, feedback: isMini ? MINI_NOTE : null } } }],
      });
      lastBoard = board;
      return;
    }

    // ---- tasks: question -> think -> solution -------------------------------------------
    const qShapes = [...authored(step), ...(step.kind === 'choose' ? optionShapes(step, () => 'blue') : [])];
    const qBoard = boardView(step.fen, orientation, { shapes: qShapes, stars });
    const qChips = step.kind === 'choose' ? chips(step, false) : [];
    const textOptions = step.kind === 'choose' ? step.options.filter((o) => o.label).map((o) => o.label) : [];
    const qVoice = textOptions.length ? say(text, `Na výběr máš: ${spokenOptions(textOptions)}`) : say(text);
    const qView = { ...base, board: qBoard, bubble: { text, feedback: null, chips: qChips } };
    segments.push({
      id: `${step.id}-q`,
      kind: 'question',
      step: step.id,
      voice: qVoice,
      voiceLead: T.lead,
      tail: T.questionTail,
      shots: [{ kind: 'still', fill: true, view: qView }],
    });
    segments.push({
      id: `${step.id}-think`,
      kind: 'think',
      step: step.id,
      voice: null,
      shots: [{ kind: 'think', dur: T.think, view: qView }],
    });

    if (step.kind === 'move') {
      const uci = step.accept[0];
      const played = playMove(step, uci);
      const arrow = { from: uci.slice(0, 2), to: uci.slice(2, 4), brush: 'green' };
      notes.push(`solution ${uci} (${played.san}) played by ${isLegalPosition(step) ? 'chess.js' : 'geometry'}${step.accept.length > 1 ? `; other accepted: ${step.accept.slice(1).join(', ')}` : ''}`);
      const successText = step.success ?? SUCCESS_DEFAULT;
      const shapesAfter = [arrow];
      if (ATTACK_WORDS.test(successText)) {
        for (const t of attackedEnemies(played.fenAfter, arrow.to, !isLegalPosition(step))) {
          shapesAfter.push({ from: arrow.to, to: t, brush: 'red' });
          notes.push(`derived attack ${arrow.to}->${t} (${isLegalPosition(step) ? 'chess.js attackers' : 'geometry'})`);
        }
      }
      const before = boardView(step.fen, orientation, { shapes: [...authored(step), arrow], stars });
      const after = boardView(played.fenAfter, orientation, {
        shapes: shapesAfter,
        stars,
        highlights: [{ sq: arrow.from, color: 'last' }, { sq: arrow.to, color: 'last' }],
      });
      segments.push({
        id: `${step.id}-a`,
        kind: 'solution',
        step: step.id,
        voice: say(successText),
        voiceLead: T.arrowLead + T.anim + 0.15,
        tail: T.solutionTail,
        notes,
        shots: [
          { kind: 'still', dur: T.arrowLead, view: qView.board ? { ...qView, board: before } : qView },
          { kind: 'anim', dur: T.anim, view: { ...qView, board: before }, moves: played.moves, after: after },
          { kind: 'still', fill: true, view: { ...base, board: after, bubble: { text, feedback: successText } } },
        ],
      });
      lastBoard = after;
      return;
    }

    if (step.kind === 'collect') {
      const path = solveCollect(step);
      notes.push(`collect path ${path.map(([a, b]) => `${a}-${b}`).join(', ')} (${path.length} moves, geometry BFS${step.maxMoves ? `, max ${step.maxMoves}` : ''})`);
      let fen = step.fen;
      let left = [...step.stars];
      const shots = [];
      for (const [a, b] of path) {
        const arrow = { from: a, to: b, brush: 'green' };
        const before = boardView(fen, orientation, { stars: left, shapes: [arrow] });
        const next = moved(parsePlacement(fen), a, b);
        fen = `${placementOf(next)} ${turnOfFen(fen)} - - 0 1`;
        left = left.filter((s) => s !== b);
        const after = boardView(fen, orientation, { stars: left, highlights: [{ sq: a, color: 'last' }, { sq: b, color: 'last' }] });
        shots.push({ kind: 'still', dur: T.collectArrow, view: { ...qView, board: before } });
        shots.push({ kind: 'anim', dur: T.collectAnim, view: { ...qView, board: before }, moves: [{ from: a, to: b }], after });
      }
      const successText = step.success ?? COLLECT_DONE_DEFAULT;
      const trail = path.map(([a, b]) => ({ from: a, to: b, brush: 'green' }));
      const final = boardView(fen, orientation, { shapes: trail, highlights: [{ sq: path.at(-1)[1], color: 'last' }] });
      shots.push({ kind: 'still', fill: true, view: { ...base, board: final, bubble: { text, feedback: successText } } });
      const lead = path.length * (T.collectArrow + T.collectAnim) + 0.15;
      segments.push({ id: `${step.id}-a`, kind: 'solution', step: step.id, voice: say(successText), voiceLead: lead, tail: T.solutionTail, notes, shots });
      lastBoard = final;
      return;
    }

    if (step.kind === 'choose') {
      const correct = step.options.filter((o) => step.correct.includes(o.id));
      const shapes = [...authored(step), ...optionShapes(step, (o) => (step.correct.includes(o.id) ? 'green' : 'blue'))];
      notes.push(`correct: ${correct.map((o) => o.label ?? o.square).join(', ')}`);
      for (const o of correct.filter((c) => c.square)) {
        const who = reachers(step, o.square);
        if (who.length === 1) {
          shapes.push({ from: who[0], to: o.square, brush: 'green' });
          notes.push(`derived move ${who[0]}->${o.square} (${isLegalPosition(step) ? 'chess.js' : 'geometry'})`);
        }
      }
      const reachesStar = step.correct.includes('ano') || step.correct.includes('ne');
      const sp = reachesStar ? starPath(step) : null;
      if (sp && step.correct.includes('ano')) {
        sp.forEach(([a, b]) => shapes.push({ from: a, to: b, brush: 'green' }));
        notes.push(`derived path to the star: ${sp.map(([a, b]) => `${a}-${b}`).join(', ')} (geometry BFS)`);
      }
      if (!sp && step.correct.includes('ano') && reachesStar && step.stars?.length) notes.push('WARNING: answer "ano" but no star path found');
      if (sp && step.correct.includes('ne')) notes.push(`WARNING: answer "ne" but a star path exists: ${JSON.stringify(sp)}`);
      const explain = lesson.test ? `Správně! ${step.explain}` : step.explain;
      const board = boardView(step.fen, orientation, { shapes, stars });
      segments.push({
        id: `${step.id}-a`,
        kind: 'solution',
        step: step.id,
        voice: say(explain),
        voiceLead: T.lead,
        tail: T.solutionTail,
        notes,
        shots: [{ kind: 'still', fill: true, view: { ...base, board, bubble: { text, feedback: explain, chips: chips(step, true) } } }],
      });
      lastBoard = board;
      return;
    }
    throw new Error(`Unsupported step kind ${step.kind}`);
  });

  const outro = resolveText(lesson.outro, ctx);
  segments.push({
    id: 'outro',
    kind: 'outro',
    step: null,
    voice: say(outro),
    voiceLead: T.lead,
    tail: T.tail + 0.3,
    shots: [{ kind: 'still', fill: true, view: { header, counter: 'Hotovo', board: lastBoard ? { ...lastBoard, shapes: [], highlights: [] } : null, bubble: { text: outro, feedback: null } } }],
  });
  segments.push({ id: 'end', kind: 'end', step: null, voice: null, shots: [{ kind: 'card', card: 'end', dur: T.endCard }] });

  return {
    lesson: { id: lesson.id, level: lesson.level, number: lesson.number, title: lesson.title, levelTitle: levelTitle(lesson.level), test: !!lesson.test },
    animal: ctx.animalId,
    segments,
  };
}

export { PIECE_NAMES };
