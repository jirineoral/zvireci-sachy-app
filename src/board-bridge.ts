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

export type BoardColor = 'white' | 'black';

export interface BoardSyncOptions {
  orientation: BoardColor;
  /** Which colour may pick up pieces; `null` locks the board. */
  movableColor: BoardColor | null;
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
    drawable: { enabled: false, visible: false },
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
