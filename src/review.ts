/**
 * Post-game review (Phase 5B): pure functions over the SAN history and the per-ply
 * feedback records. Positions come from replaying SAN through chess.js; situations come
 * from chess.js move flags; texts come from `commentary.ts`. Nothing here touches the DOM
 * or the engine.
 */
import { Chess, type Color } from 'chess.js';
import { CAPTURED_ACCUSATIVE, DEFAULT_VOICE, OPENING, REACTIONS, TEMPLATES, type Situation } from './commentary';
import type { Glyph } from './feedback';

/** What the app remembers about one ply: play-time feedback (human plies) and, after a
 *  whole-game analysis, both sides' glyphs plus evals (see games.ts PlyData). */
export interface PlyRecord {
  glyph: Glyph | null;
  /** SAN of the engine's better move, kept for `?!`, `?` and `??` when known. */
  betterSan: string | null;
  evalCp?: number;
  bestSan?: string | null;
}

/** A king's voice: its noise and its "ouch"; null = no character (classic pieces). */
export type SpeakerVoice = { sound: string; hurt: string } | null;

export interface Bubble {
  speaker: Color;
  text: string;
}

export interface PlyCommentary {
  /** The mover's king speaks; null only when `ply` is out of range. */
  main: Bubble | null;
  /** The other king's reaction (blunder, brilliancy, being mated). */
  reaction: Bubble | null;
}

/** The position after the first `ply` moves of `sans` played from `startFen` (0 = start). */
export function positionAt(startFen: string, sans: readonly string[], ply: number): Chess {
  const chess = new Chess(startFen);
  for (let i = 0; i < Math.min(ply, sans.length); i++) chess.move(sans[i]);
  return chess;
}

const GLYPH_SITUATION: Record<Glyph, Situation> = {
  '!!': 'brilliant',
  '!': 'great',
  '!?': 'interesting',
  '?!': 'inaccuracy',
  '?': 'mistake',
  '??': 'blunder',
};

/**
 * Situation of the move that produced position `ply` (i.e. `sans[ply - 1]`), most
 * specific first: end of game > glyph > promotion > castling > en passant > captures >
 * check > first move > quiet.
 */
export function situationOf(
  after: Chess,
  moveFlags: string,
  captured: string | undefined,
  ply: number,
  record: PlyRecord | null,
): Situation {
  if (after.isCheckmate()) return 'mate';
  if (after.isStalemate()) return 'stalemate';
  if (after.isGameOver()) return 'draw';
  if (record?.glyph) {
    const glyphSituation = GLYPH_SITUATION[record.glyph];
    const needsBetter = glyphSituation === 'inaccuracy' || glyphSituation === 'mistake' || glyphSituation === 'blunder';
    if (!needsBetter || record.betterSan) return glyphSituation;
    // Better move unknown: say something true about the move instead of a broken template.
  }
  if (moveFlags.includes('p')) return 'promotion';
  if (moveFlags.includes('k') || moveFlags.includes('q')) return 'castle';
  if (moveFlags.includes('e')) return 'enPassant';
  if (captured === 'q') return 'queenCapture';
  if (captured === 'r') return 'bigCapture';
  if (captured) return 'capture';
  if (after.inCheck()) return 'check';
  if (ply <= 2) return 'firstMove';
  return 'quiet';
}

/** Deterministic pick: the same game always tells the same story, neighbours differ. */
export function pick<T>(list: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return list[h % list.length];
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

function voice(v: SpeakerVoice): { zvuk: string; bolest: string } {
  return { zvuk: v?.sound ?? DEFAULT_VOICE.sound, bolest: v?.hurt ?? DEFAULT_VOICE.hurt };
}

/**
 * Commentary for position `ply` of the game: the mover's bubble for `sans[ply - 1]`,
 * or the opening line at ply 0 (spoken by the side to move).
 */
export function commentaryFor(
  startFen: string,
  sans: readonly string[],
  ply: number,
  records: ReadonlyArray<PlyRecord | null | undefined>,
  voiceOf: (color: Color) => SpeakerVoice,
): PlyCommentary {
  if (ply < 0 || ply > sans.length) return { main: null, reaction: null };
  if (ply === 0) {
    const speaker: Color = new Chess(startFen).turn();
    const text = fill(pick(OPENING, `open:${sans.length}:${sans[0] ?? ''}`), voice(voiceOf(speaker)));
    return { main: { speaker, text }, reaction: null };
  }

  const before = positionAt(startFen, sans, ply - 1);
  const move = before.move(sans[ply - 1]); // `before` is now the position after the move
  const speaker = move.color;
  const other: Color = speaker === 'w' ? 'b' : 'w';
  const record = records[ply - 1] ?? null;
  const situation = situationOf(before, move.flags, move.captured, ply, record);
  const seed = `${ply}:${move.san}`;
  const values = {
    san: move.san,
    better: record?.betterSan ?? '',
    captured: move.captured ? CAPTURED_ACCUSATIVE[move.captured] ?? 'figuru' : 'figuru',
    ...voice(voiceOf(speaker)),
  };
  const main: Bubble = { speaker, text: fill(pick(TEMPLATES[situation], seed), values) };

  let reaction: Bubble | null = null;
  const reactionValues = voice(voiceOf(other));
  if (situation === 'mate') {
    reaction = { speaker: other, text: fill(pick(REACTIONS.mated, seed), reactionValues) };
  } else if (record?.glyph === '??') {
    reaction = { speaker: other, text: fill(pick(REACTIONS.blunder, seed), reactionValues) };
  } else if (record?.glyph === '!!') {
    reaction = { speaker: other, text: fill(pick(REACTIONS.brilliant, seed), reactionValues) };
  } else if (move.captured && !before.isGameOver()) {
    reaction = { speaker: other, text: fill(pick(REACTIONS.captured, seed), reactionValues) };
  }
  return { main, reaction };
}
