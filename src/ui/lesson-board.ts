/**
 * Lessons: the `LessonBoard` adapter (src/lessons/runner.ts) on a chessground `Api`.
 *
 * It takes over the board's move and click events while attached and gives them back on
 * `detach()`, so it can run on the main board's chessground instance (the one
 * board-bridge.ts creates) without the game controller knowing about lessons — as long as
 * the controller does not `sync()` the board meanwhile (see the wiring notes in the
 * Phase 21a report: the controller needs a "lesson mode" that pauses its board sync and
 * the engine). It works just as well on a separate `Chessground()` instance.
 *
 * Only constant SVG (the star) reaches chessground's customSvg; texts on shapes go through
 * chessground's `label`, which it renders as SVG text (no HTML).
 */
import type { Api } from '@lichess-org/chessground/api';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import type { Square } from 'chess.js';
import type { BoardColor, LessonBoard } from '../lessons/runner';
import type { Shape } from '../lessons/types';

export interface LessonBoardHandlers {
  /** A piece was dropped (chessground already shows it there; the next render corrects it). */
  onMove: (from: Square, to: Square) => void;
  /** A square was clicked. */
  onSquare: (square: Square) => void;
}

export interface ChessgroundLessonBoard extends LessonBoard {
  /** Restores the board's previous move/select handlers and clears the lesson's shapes. */
  detach(): void;
}

/** A five-pointed star in chessground's 100×100 square box. Constant: never built from data. */
const STAR_SVG =
  '<polygon points="50,14 60,39 87,40 66,57 73,83 50,68 27,83 34,57 13,40 40,39" ' +
  'fill="#ffd43b" stroke="#b8860b" stroke-width="3" stroke-linejoin="round" opacity="0.95"/>';

export function createChessgroundLessonBoard(api: Api, handlers: LessonBoardHandlers): ChessgroundLessonBoard {
  const previousAfter = api.state.movable.events.after;
  const previousSelect = api.state.events.select;
  let shapes: DrawShape[] = [];
  let stars: DrawShape[] = [];
  let attached = true;

  api.set({
    drawable: { enabled: false, visible: true },
    premovable: { enabled: false },
    movable: {
      free: false,
      showDests: true,
      events: {
        after: (orig, dest) => {
          if (attached) handlers.onMove(orig as Square, dest as Square);
        },
      },
    },
    events: {
      select: (key) => {
        if (attached) handlers.onSquare(key as Square);
      },
    },
  });

  const redraw = (): void => api.setAutoShapes([...shapes, ...stars]);

  return {
    setPosition(fen: string, orientation: BoardColor, turnColor: BoardColor, lastMove: [Square, Square] | null): void {
      api.set({ fen, orientation, turnColor, check: false, lastMove: lastMove ?? undefined, selected: undefined });
      if (!lastMove) api.state.lastMove = undefined;
    },
    setMovable(movable): void {
      api.set({
        movable: {
          color: movable?.color ?? undefined,
          dests: (movable?.dests ?? new Map()) as Map<Key, Key[]>,
        },
      });
    },
    drawShapes(list: readonly Shape[]): void {
      shapes = list.map((s) => ({
        orig: s.from,
        dest: s.to,
        brush: s.brush ?? 'green',
        label: s.label ? { text: s.label } : undefined,
      }));
      redraw();
    },
    showStars(squares: readonly Square[]): void {
      stars = squares.map((sq) => ({ orig: sq, customSvg: { html: STAR_SVG } }));
      redraw();
    },
    detach(): void {
      attached = false;
      api.set({
        movable: { events: { after: previousAfter } },
        events: { select: previousSelect },
      });
      api.setAutoShapes([]);
    },
  };
}
