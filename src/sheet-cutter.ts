/**
 * Whole-sheet cutter (Phase 18): finds the twelve busts of a character sheet (two rows
 * of six on a plain background, dark row on top, light row below — docs/vlastni-sada.md)
 * and returns each as a 256×256 RGBA image, placed like the library's pieces. A port of
 * the geometry of scripts/extract-animals.py over `ImageData`; no DOM, no I/O.
 *
 * Steps: background colour from the border → flood fill of the background from the
 * border (tolerance on the summed RGB distance) → 4-connected foreground components →
 * drop small (text/scraps) → split a component spanning both rows at its emptiest line and
 * one that is much wider than the rest at its thinnest column → two rows by y, six by x →
 * crop, alpha from the flood mask, common scale, bottom-aligned, base-centred.
 */

export const PIECE_CANVAS = 256;
const BG_TOLERANCE = 40; // sum |rgb − bg| of a background pixel (as in the extractor for white sheets)
const MIN_AREA_FRACTION = 0.0015; // components below this share of the image are text or scraps
const TALLEST_FRACTION = 0.94;
const BOTTOM_MARGIN = 8;
const BASE_BAND_FRACTION = 0.12;

export interface CutBust {
  /** 0 = top row (dark), 1 = bottom row (light). */
  row: 0 | 1;
  /** Position in the row, left to right. */
  col: number;
  image: ImageData;
}

export interface CutResult {
  busts: CutBust[];
  /** Components found per row before splitting/merging, for the message. */
  rowCounts: [number, number];
  /** What the cutter saw, for diagnostics: background colour, row split, component boxes. */
  trace: string[];
}

interface Component {
  pixels: Int32Array; // linear indices
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
}

/** Cuts a sheet. Returns fewer than 12 busts when the layout was not recognised (the caller says so). */
export function cutSheet(sheet: ImageData): CutResult {
  const { width: w, height: h, data } = sheet;
  const n = w * h;

  // Background colour: median of the border pixels.
  const border: number[][] = [[], [], []];
  const push = (i: number): void => {
    border[0].push(data[i * 4]);
    border[1].push(data[i * 4 + 1]);
    border[2].push(data[i * 4 + 2]);
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < 4; y++) push(y * w + x);
    for (let y = h - 4; y < h; y++) push(y * w + x);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 4; x++) push(y * w + x);
    for (let x = w - 4; x < w; x++) push(y * w + x);
  }
  const bg = border.map((ch) => median(ch));
  const trace: string[] = [`bg ${bg.join(',')} size ${w}x${h}`];

  // Background mask by flood fill from the border.
  const near = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(data[i * 4] - bg[0]) + Math.abs(data[i * 4 + 1] - bg[1]) + Math.abs(data[i * 4 + 2] - bg[2]);
    if (d <= BG_TOLERANCE || data[i * 4 + 3] < 128) near[i] = 1; // transparent counts as background
  }
  const background = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const seed = (i: number): void => {
    if (near[i] && !background[i]) {
      background[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i + w < n) seed(i + w);
  }

  // Foreground components (4-connected), bounded by size.
  const minArea = Math.max(200, Math.round(n * MIN_AREA_FRACTION));
  const label = new Int32Array(n); // 0 = unvisited/background
  let comps: Component[] = [];
  for (let start = 0; start < n; start++) {
    if (background[start] || label[start]) continue;
    const id = comps.length + 1;
    const pixels: number[] = [];
    sp = 0;
    stack[sp++] = start;
    label[start] = id;
    while (sp > 0) {
      const i = stack[--sp];
      pixels.push(i);
      const x = i % w;
      const visit = (j: number): void => {
        if (!background[j] && !label[j]) {
          label[j] = id;
          stack[sp++] = j;
        }
      };
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (i >= w) visit(i - w);
      if (i + w < n) visit(i + w);
    }
    if (pixels.length >= minArea) comps.push(component(Int32Array.from(pixels), w));
  }
  trace.push(`components ${comps.length}: ${comps.map((c) => `[${c.x0}-${c.x1} ${c.y0}-${c.y1} n${c.pixels.length}]`).join(' ')}`);
  if (comps.length === 0) return { busts: [], rowCounts: [0, 0], trace };

  // Row split: the y that best separates the centroids (largest gap between sorted centroids
  // near the middle), falling back to the image middle.
  const rowSplit = splitY(comps, h);
  trace.push(`rowSplit ${Math.round(rowSplit)}`);
  // A component spanning both rows (a crown's cross touching a base above): cut at the
  // emptiest line near the split.
  comps = comps.flatMap((c) => (c.y0 < rowSplit - h * 0.07 && c.y1 > rowSplit + h * 0.07 ? cutAtLine(c, w, rowSplit, Math.round(h * 0.09)) : [c]));
  comps = comps.filter((c) => c.pixels.length >= minArea);

  const rows: [Component[], Component[]] = [[], []];
  for (const c of comps) rows[c.cy < rowSplit ? 0 : 1].push(c);
  const rowCounts: [number, number] = [rows[0].length, rows[1].length];
  trace.push(`rows ${rowCounts.join('/')}`);

  // Per row: scraps (a stray tail, a letter) are anything under a quarter of the row's
  // largest component; two busts touching → one wide component, split at its thinnest
  // column until six; more than six → the six largest.
  for (const r of [0, 1] as const) {
    let row = rows[r];
    if (row.length === 0) continue;
    const largest = Math.max(...row.map((c) => c.pixels.length));
    row = row.filter((c) => c.pixels.length >= largest * 0.25);
    let guard = 0;
    while (row.length < 6 && guard++ < 6) {
      const widest = row.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
      const parts = cutAtColumn(widest, w);
      if (parts.length < 2) break;
      row.splice(row.indexOf(widest), 1, ...parts);
    }
    if (row.length > 6) row = row.sort((a, b) => b.pixels.length - a.pixels.length).slice(0, 6);
    row.sort((a, b) => a.cx - b.cx);
    rows[r] = row;
  }

  // Crops with alpha from the flood mask (enclosed pockets of the sheet colour stay, like
  // the extractor's light sheets), then a common scale.
  const crops: { row: 0 | 1; col: number; crop: ImageData; solidH: number }[] = [];
  for (const r of [0, 1] as const) {
    rows[r].slice(0, 6).forEach((c, col) => {
      const cw = c.x1 - c.x0;
      const ch = c.y1 - c.y0;
      const crop = new ImageData(cw, ch);
      const own = new Uint8Array(cw * ch);
      for (let k = 0; k < c.pixels.length; k++) {
        const i = c.pixels[k];
        own[(Math.floor(i / w) - c.y0) * cw + (i % w) - c.x0] = 1;
      }
      // Enclosed non-background pixels inside the bbox that belong to no other component
      // (pockets) are opaque too; pixels of other components are not.
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y + c.y0) * w + x + c.x0;
          const o = (y * cw + x) * 4;
          const mine = own[y * cw + x] === 1;
          crop.data[o] = data[i * 4];
          crop.data[o + 1] = data[i * 4 + 1];
          crop.data[o + 2] = data[i * 4 + 2];
          crop.data[o + 3] = mine ? 255 : 0;
        }
      }
      fillPockets(crop, background, w, c);
      crops.push({ row: r, col, crop, solidH: ch });
    });
  }
  const tallest = Math.max(1, ...crops.map((c) => c.solidH));
  const scale = (PIECE_CANVAS * TALLEST_FRACTION) / tallest;
  const busts = crops.map((c) => ({ row: c.row, col: c.col, image: place(c.crop, scale) }));
  trace.push(`after split: ${rows.map((r) => r.map((c) => `[${c.x0}-${c.x1} ${c.y0}-${c.y1}]`).join(' ')).join(' | ')}`);
  return { busts, rowCounts, trace };
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}

function component(pixels: Int32Array, w: number): Component {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1,
    sx = 0,
    sy = 0;
  for (let k = 0; k < pixels.length; k++) {
    const i = pixels[k];
    const x = i % w;
    const y = (i - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    sx += x;
    sy += y;
  }
  return { pixels, x0, y0, x1: x1 + 1, y1: y1 + 1, cx: sx / pixels.length, cy: sy / pixels.length };
}

/** Largest gap between the sorted centroid ys within the middle half of the image; else the middle. */
function splitY(comps: Component[], h: number): number {
  const ys = comps.map((c) => c.cy).sort((a, b) => a - b);
  let best = h / 2;
  let bestGap = 0;
  for (let i = 1; i < ys.length; i++) {
    const gap = ys[i] - ys[i - 1];
    const mid = (ys[i] + ys[i - 1]) / 2;
    if (gap > bestGap && mid > h * 0.25 && mid < h * 0.75) {
      bestGap = gap;
      best = mid;
    }
  }
  return best;
}

/** Splits at the row with the fewest pixels within ±band of `y`. */
function cutAtLine(c: Component, w: number, y: number, band: number): Component[] {
  const lo = Math.max(c.y0, Math.round(y - band));
  const hi = Math.min(c.y1, Math.round(y + band));
  if (hi - lo < 2) return [c];
  const counts = new Int32Array(hi - lo);
  for (let k = 0; k < c.pixels.length; k++) {
    const yy = Math.floor(c.pixels[k] / w);
    if (yy >= lo && yy < hi) counts[yy - lo]++;
  }
  let cut = lo;
  let min = Infinity;
  for (let i = 0; i < counts.length; i++) if (counts[i] < min) (min = counts[i]), (cut = lo + i);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let k = 0; k < c.pixels.length; k++) (Math.floor(c.pixels[k] / w) < cut ? upper : lower).push(c.pixels[k]);
  return [upper, lower].filter((p) => p.length > 0).map((p) => component(Int32Array.from(p), w));
}

/** Splits at the thinnest column in the middle 30 % of the component's width. */
function cutAtColumn(c: Component, w: number): Component[] {
  const width = c.x1 - c.x0;
  const lo = c.x0 + Math.floor(width * 0.35);
  const hi = c.x0 + Math.ceil(width * 0.65);
  if (hi - lo < 2) return [c];
  const counts = new Int32Array(hi - lo);
  for (let k = 0; k < c.pixels.length; k++) {
    const x = c.pixels[k] % w;
    if (x >= lo && x < hi) counts[x - lo]++;
  }
  let cut = lo;
  let min = Infinity;
  for (let i = 0; i < counts.length; i++) if (counts[i] < min) (min = counts[i]), (cut = lo + i);
  const left: number[] = [];
  const right: number[] = [];
  for (let k = 0; k < c.pixels.length; k++) (c.pixels[k] % w < cut ? left : right).push(c.pixels[k]);
  if (left.length === 0 || right.length === 0) return [c];
  return [component(Int32Array.from(left), w), component(Int32Array.from(right), w)];
}

/**
 * Sheet-coloured pixels inside the crop that the border flood did not reach (the inside of
 * a bow, between a knight's legs) are enclosed pockets. On a light sheet they read as
 * drawn white (an eye, a mitre) more often than as a hole, so the extractor keeps them
 * unless they are flat sheet white; here the rule is simpler: keep them opaque when they
 * are surrounded by the bust on all four sides, i.e. when they are not background.
 */
function fillPockets(crop: ImageData, background: Uint8Array, w: number, c: Component): void {
  const cw = crop.width;
  for (let y = 0; y < crop.height; y++) {
    for (let x = 0; x < cw; x++) {
      const o = (y * cw + x) * 4;
      if (crop.data[o + 3] === 255) continue;
      const i = (y + c.y0) * w + x + c.x0;
      if (!background[i]) crop.data[o + 3] = 255; // non-background, not ours: an enclosed pocket → keep
    }
  }
}

/** Scales the crop and places it on a 256 canvas: bottom margin, base-centred (as the extractor). */
function place(crop: ImageData, scale: number): ImageData {
  const out = new ImageData(PIECE_CANVAS, PIECE_CANVAS);
  const sw = Math.max(1, Math.round(crop.width * scale));
  const sh = Math.max(1, Math.round(crop.height * scale));
  // Base band: the bottom 12 % of the crop's rows; centre its opaque columns.
  const bandTop = Math.max(0, crop.height - Math.max(1, Math.round(crop.height * BASE_BAND_FRACTION)));
  let bx0 = crop.width,
    bx1 = -1;
  for (let y = bandTop; y < crop.height; y++) {
    for (let x = 0; x < crop.width; x++) {
      if (crop.data[(y * crop.width + x) * 4 + 3] >= 128) {
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
      }
    }
  }
  const baseCx = bx1 >= 0 ? ((bx0 + bx1 + 1) / 2) * scale : sw / 2;
  let left = Math.round(PIECE_CANVAS / 2 - baseCx);
  left = Math.min(PIECE_CANVAS - 4 - sw, Math.max(4, left)); // clamp into the margins
  const top = PIECE_CANVAS - BOTTOM_MARGIN - sh;
  // Box-filter resample (area average) — good enough for a 3–4× downscale of cartoon art.
  const fx = crop.width / sw;
  const fy = crop.height / sh;
  for (let y = 0; y < sh; y++) {
    const sy0 = Math.floor(y * fy);
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < sw; x++) {
      const sx0 = Math.floor(x * fx);
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * fx));
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        cnt = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const o = (yy * crop.width + xx) * 4;
          const al = crop.data[o + 3];
          r += crop.data[o] * al;
          g += crop.data[o + 1] * al;
          b += crop.data[o + 2] * al;
          a += al;
          cnt++;
        }
      }
      const ox = left + x;
      const oy = top + y;
      if (ox < 0 || oy < 0 || ox >= PIECE_CANVAS || oy >= PIECE_CANVAS) continue;
      const o = (oy * PIECE_CANVAS + ox) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round(a / cnt);
      }
    }
  }
  return out;
}
