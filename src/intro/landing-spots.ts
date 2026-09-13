/**
 * Geometry and timing of the intro (Phase 8). The board in `public/splash/plate.jpg` is
 * drawn in perspective, so landing spots are measured points, not a computed grid.
 *
 * Plate: 1024×1536. Board (the blue squares) measured on the image: top edge y≈985 from
 * x≈205 to 835, bottom edge y≈1240 from x≈35 to 975 — a trapezoid; rows are drawn nearly
 * affine, so the two ranks used here are interpolated linearly between the two edges.
 * All values are fractions of the plate's width/height so they survive any fitting.
 */

export const PLATE = { width: 1024, height: 1536 } as const;

const BOARD = { top: 985, bottom: 1240, topLeft: 205, topRight: 835, bottomLeft: 35, bottomRight: 975 } as const;

export interface LandingSpot {
  /** Fraction of the plate width / height where the piece's base sits. */
  x: number;
  y: number;
  /** Piece box width as a fraction of the plate width (a square's width on that rank). */
  size: number;
  /** Which rank the spot is on (drawing order: far first). */
  rank: 'far' | 'near';
}

/** Left→right files a–h of one rank, from its y (in plate px) between the board's edges. */
function rank(yPx: number, which: 'far' | 'near'): LandingSpot[] {
  const t = (yPx - BOARD.top) / (BOARD.bottom - BOARD.top);
  const left = BOARD.topLeft + (BOARD.bottomLeft - BOARD.topLeft) * t;
  const right = BOARD.topRight + (BOARD.bottomRight - BOARD.topRight) * t;
  const square = (right - left) / 8;
  return Array.from({ length: 8 }, (_, file) => ({
    x: (left + square * (file + 0.5)) / PLATE.width,
    y: yPx / PLATE.height,
    size: square / PLATE.width,
    rank: which,
  }));
}

const ROW_H = (BOARD.bottom - BOARD.top) / 8;
/** Far rank (the dark side) and near rank (the light side), base line slightly below the square centre. */
export const FAR_RANK = rank(BOARD.top + ROW_H * 0.72, 'far');
export const NEAR_RANK = rank(BOARD.bottom - ROW_H * 0.22, 'near');

/** Back-rank formation, files a–h. */
export const FORMATION = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'] as const;

/** Timing in milliseconds from the moment the plate is shown. */
export const TIMING = {
  /** Landing starts, accelerating: 16 pieces, spacing shrinking from ~330 ms to ~35 ms. */
  landings: [200, 530, 810, 1040, 1220, 1360, 1470, 1560, 1630, 1690, 1740, 1780, 1815, 1848, 1880, 1910],
  landingDuration: 380,
  beat: 2050, // final zoom + flash
  crossfade: 2300, // splash starts fading in
  crossfadeDuration: 450,
  /** Preload budget for the plate + pieces; missed → straight to the splash. */
  preloadBudgetMs: 1200,
  splashFadeOut: 220,
} as const;
