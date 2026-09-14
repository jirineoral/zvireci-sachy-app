/**
 * chess.js <-> chessground bridge.
 *
 * This is the only module that imports both libraries. chess.js is the
 * authoritative game state; chessground is a view. `sync()` pushes the current
 * chess.js position and legal-move map into chessground, so the board can never
 * accept a move chess.js would not. Whether — and for whom — the board is movable
 * is decided by the controller and passed in; the bridge does not judge game state.
 */
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import type { Chess, Color, Square } from 'chess.js';
import { GLYPH_CLASS, type Glyph } from './feedback';

export type BoardColor = 'white' | 'black';

export interface BoardSyncOptions {
  orientation: BoardColor;
  /** Which colour may pick up pieces; `null` locks the board. */
  movableColor: BoardColor | null;
  /** Move-feedback glyph to badge onto a square (the last human move's destination). */
  annotation?: { square: Square; glyph: Glyph } | null;
  /** Review: the engine's best move for the shown position, drawn as a green arrow. */
  arrow?: { from: Square; to: Square } | null;
  /** Puzzle hints: squares to circle. */
  hints?: Square[];
}

/** Badge colours per glyph (chess.com palette). Kept here because the badge is drawn as SVG. */
const GLYPH_COLOR: Record<Glyph, string> = {
  '!!': '#1baca6',
  '!': '#5b8baf',
  '!?': '#d7a52a',
  '?!': '#f7c631',
  '?': '#ffa459',
  '??': '#fa412d',
};

/** A round badge in the top-right corner of the square (chessground draws customSvg in a 100×100 box). */
function glyphBadge(glyph: Glyph): string {
  if (!(glyph in GLYPH_CLASS)) return ''; // the only string that reaches innerHTML: never anything but our six glyphs
  const size = glyph.length === 2 ? 30 : 34;
  return (
    `<g class="move-glyph move-glyph-${GLYPH_CLASS[glyph]}">` +
    `<circle cx="76" cy="24" r="21" fill="${GLYPH_COLOR[glyph]}" stroke="#fff" stroke-width="3"/>` +
    `<text x="76" y="25" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="700" font-size="${size}" fill="#fff">${glyph}</text>` +
    `</g>`
  );
}

export interface BoardBridge {
  sync(chess: Chess, opts: BoardSyncOptions): void;
}

export function createBoardBridge(
  el: HTMLElement,
  onUserMove: (from: Square, to: Square) => Promise<void>,
): BoardBridge {
  const api: Api = Chessground(el, {
    orientation: 'white',
    coordinates: true,
    animation: { enabled: true, duration: 200 },
    premovable: { enabled: false },
    drawable: { enabled: false, visible: true }, // visible: needed for the autoShapes glyph badge; enabled: no user drawing
    movable: {
      free: false,
      showDests: true,
      events: {
        // chessground keys are chess.js squares except the "a0" spare, which
        // never appears in a user move. Explicitly fire-and-forget: the promise is
        // owned here and its failure is logged, never left unhandled.
        after: (orig, dest) => {
          void onUserMove(orig as Square, dest as Square).catch((err) =>
            console.error('handleUserMove failed', err),
          );
        },
      },
    },
  });

  return {
    sync(chess: Chess, opts: BoardSyncOptions): void {
      const lastMove = chess.history({ verbose: true }).at(-1);

      api.set({
        fen: chess.fen(),
        orientation: opts.orientation,
        turnColor: toBoardColor(chess.turn()),
        check: chess.inCheck(),
        lastMove: lastMove ? [lastMove.from, lastMove.to] : undefined,
        movable: {
          color: opts.movableColor ?? undefined,
          dests: legalDests(chess),
        },
        drawable: {
          autoShapes: [
            ...(opts.hints ?? []).map((square) => ({ orig: square, brush: 'yellow' })),
            ...(opts.arrow ? [{ orig: opts.arrow.from, dest: opts.arrow.to, brush: 'green' }] : []),
            ...(opts.annotation ? [{ orig: opts.annotation.square, customSvg: { html: glyphBadge(opts.annotation.glyph) } }] : []),
          ],
        },
      });
    },
  };
}

export function toBoardColor(color: Color): BoardColor {
  return color === 'w' ? 'white' : 'black';
}

/** Legal-move map for chessground, straight from chess.js. */
function legalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const move of chess.moves({ verbose: true })) {
    const targets = dests.get(move.from) ?? [];
    // The four promotion moves share one destination square; dedupe.
    if (!targets.includes(move.to)) targets.push(move.to);
    dests.set(move.from, targets);
  }
  return dests;
}
