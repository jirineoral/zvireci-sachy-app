/**
 * chess.js <-> chessground bridge.
 *
 * This is the only module that imports both libraries. chess.js is the
 * authoritative game state; chessground is a view. `sync()` pushes the current
 * chess.js position and legal-move map into chessground, so the board can never
 * accept a move chess.js would not.
 */
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import type { Chess, Color, Square } from 'chess.js';

export interface BoardBridge {
  sync(chess: Chess): void;
}

export function createBoardBridge(
  el: HTMLElement,
  onUserMove: (from: Square, to: Square) => void,
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
        // never appears in a user move.
        after: (orig, dest) => onUserMove(orig as Square, dest as Square),
      },
    },
  });

  return {
    sync(chess: Chess): void {
      const turnColor = toChessgroundColor(chess.turn());
      const lastMove = chess.history({ verbose: true }).at(-1);

      api.set({
        fen: chess.fen(),
        turnColor,
        check: chess.inCheck(),
        lastMove: lastMove ? [lastMove.from, lastMove.to] : undefined,
        movable: {
          color: chess.isGameOver() ? undefined : turnColor,
          dests: legalDests(chess),
        },
      });
    },
  };
}

function toChessgroundColor(color: Color): 'white' | 'black' {
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
