#!/usr/bin/env python
"""
Extract the `farm` piece set (cream goats = white, green frogs = black) from the two
AI-generated character sheets in assets/source/ into public/piece-sets/farm/*.png, and
render the quality-gate contact sheet docs/piece-contact-sheet.png.

Usage (from the repo root):
    python scripts/extract-pieces.py                     # all sets: pieces + contact sheets + debug overlays
    python scripts/extract-pieces.py farm-busts          # one set only
    python scripts/extract-pieces.py --dry-run           # only print measurements and pocket candidates

Sets:
  farm        two white-background sheets (goats.png, frogs.png), full pieces on pedestals,
              segmented by pedestal-seeded components (process_sheet).
  farm-busts  one dark-background sheet (farm-busts.png) with both rows (goats on top,
              frogs below), busts without pedestals, Czech labels under each piece;
              segmented by large connected components, labels ignored (process_busts_sheet).

Pipeline (see docs/phase-3-plan.md, Part B):
  1. Background = flood fill from the sheet border with a colour tolerance (the cream
     goat bodies are ~62 from white, so tolerance 40 never eats them; the dark outlines
     stop the fill).
  2. Pieces = connected components of non-background pixels, seeded from the six
     pedestal bases found on the bottom rows (a plain column projection merges
     pawn+knight and bishop+rook on these sheets). Unreached scraps are attached to the
     nearest piece.
  3. Enclosed white pockets (inside the bow, between the horse's legs) are not reached
     by the border fill; they are cleared only from the explicit per-piece seed list
     POCKETS_TO_CLEAR (eye whites and the goat mitre are pure white too and must stay).
  4. De-halo: in the 2 px band next to transparency, only pixels clearly lighter than the
     outline get their alpha reduced and take the outline colour. Outline pixels are
     never touched.
  5. One global scale from the tallest of all twelve pieces; optional documented
     per-role height factors (ROLE_HEIGHT_FACTOR) when the source pawn is far below
     chess convention. Pawn smallest, king tallest and knight ~ bishop are asserted;
     the source art's rook/queen heights are reported, not forced.
  6. Placement on a 256x256 canvas: shared baseline, horizontally centred on the
     pedestal base (not the raw bounding box) plus per-piece NUDGE_X.

Deterministic: same inputs and constants -> byte-identical PNGs.
Requires Pillow (scripts/requirements.txt) and numpy.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {"w": ROOT / "assets/source/goats.png", "b": ROOT / "assets/source/frogs.png"}
OUT_DIR = ROOT / "public/piece-sets/farm"
CONTACT_SHEET = ROOT / "docs/piece-contact-sheet.png"
DEBUG_DIR = ROOT / "assets/source/_debug"  # git-ignored

ROLES = ["P", "N", "B", "R", "Q", "K"]  # left -> right on both sheets

# ---- constants (hand-tuned; see comments) -------------------------------------------
CANVAS = 256
TALLEST_FRACTION = 0.90  # tallest piece = 90 % of the canvas height
BOTTOM_MARGIN = 12  # px below the shared baseline (~4.7 %)
BG_TOL = 40  # sum |rgb - 255| tolerance for the background flood fill
NEAR_WHITE_TOL = 15  # "this is the sheet's white" for pocket detection
BASE_BAND_FRACTION = 0.12  # bottom 12 % of a piece = its pedestal, used for centring
HALO_LUMA_MIN = 140  # fringe pixels lighter than this get de-haloed; outlines (~40-70) never
DEHALO_MODE = "gated"  # "gated" (default) | "erode" (fallback: plain 1 px erosion)
DEHALO_BAND = 2  # px

# Per-role height factors relative to the global scale. 1.0 = no adjustment (the
# contract's default). The first dry run measured pawn:king 0.62 (goats) / 0.58 (frogs),
# above the 0.55 guard, so no adjustment is applied (DoD 10). Applied identically to both sides.
ROLE_HEIGHT_FACTOR = {"P": 1.0, "N": 1.0, "B": 1.0, "R": 1.0, "Q": 1.0, "K": 1.0}
PAWN_KING_MIN_RATIO = 0.55

# Enclosed pockets of sheet background to clear, per piece, as (x, y) in SHEET
# coordinates. Chosen from the numbered candidates printed by --dry-run / the debug
# overlay. Anything not listed keeps its white (eyes, mitre, teeth).
POCKETS_TO_CLEAR: dict[str, list[tuple[int, int]]] = {
    # Bow interiors (upper and lower loop between bow and string). The 150 px spot at
    # (852,267) on the goat bishop is the mitre's white and is deliberately NOT listed.
    "wB": [(883, 334), (899, 454)],
    "bB": [(870, 317), (885, 462)],
}

# Horizontal nudges in final canvas pixels (+ = right), applied after base-centring.
# Tuned on the starting-position screenshot: the bishops' bows and the goat knight's horse
# head extend to the right, leaving the bounding box 7-17 px right of centre when the
# pedestal is centred; a partial correction keeps both the base and the mass near centre.
NUDGE_X = {code: 0 for code in ("wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK")}
NUDGE_X.update({"wN": -3, "wB": -8, "bB": -8})

FARM_LIGHT = (0xDC, 0xE6, 0xF0)
FARM_DARK = (0x8F, 0xA3, 0xBD)

# ---- farm-busts recipe -------------------------------------------------------------------
BUSTS_SOURCE = ROOT / "assets/source/farm-busts.png"
BUSTS_OUT_DIR = ROOT / "public/piece-sets/farm-busts"
BUSTS_CONTACT_SHEET = ROOT / "docs/piece-contact-sheet-busts.png"
BUSTS_ROWS = {"w": (0, 430), "b": (430, None)}  # goats above y=430, frogs below (sheet px)
BUSTS_ORDER = ["P", "R", "N", "B", "Q", "K"]  # left -> right on this sheet
BUSTS_BG_TOL = 36  # background is ~(27,28,29); outlines are near-black (sum diff ~70)
BUSTS_NEAR_BG_TOL = 15
BUSTS_MIN_PIECE_AREA = 5000  # label letters are < 2500 px each
BUSTS_TALLEST_FRACTION = 0.94  # busts are meant to fill the square (mobile legibility)
BUSTS_BOTTOM_MARGIN = 8
BUSTS_NUDGE_X: dict[str, int] = {}  # + = right, tuned on the starting-position screenshot


# ---- helpers ---------------------------------------------------------------------------
def flood(mask: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """4-connected flood inside `mask` starting from `seeds` (both bool arrays)."""
    reach = seeds & mask
    while True:
        grown = reach.copy()
        grown[1:, :] |= reach[:-1, :]
        grown[:-1, :] |= reach[1:, :]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        grown &= mask
        if np.array_equal(grown, reach):
            return reach
        reach = grown


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(px):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def erode(mask: np.ndarray, px: int) -> np.ndarray:
    return ~dilate(~mask, px)


def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    """(x0, y0, x1, y1) inclusive-exclusive of True pixels."""
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def label_components(mask: np.ndarray) -> list[np.ndarray]:
    """All 4-connected components of `mask`, largest first (bool arrays)."""
    remaining = mask.copy()
    comps: list[np.ndarray] = []
    while remaining.any():
        ys, xs = np.where(remaining)
        seed = np.zeros_like(mask)
        seed[ys[0], xs[0]] = True
        comp = flood(remaining, seed)
        comps.append(comp)
        remaining &= ~comp
    comps.sort(key=lambda c: -int(c.sum()))
    return comps


def luma(rgb: np.ndarray) -> np.ndarray:
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


# ---- sheet processing --------------------------------------------------------------------
class Piece:
    def __init__(self, code: str, rgb: np.ndarray, opaque: np.ndarray, origin: tuple[int, int]):
        self.code = code
        self.rgb = rgb  # crop, uint8 HxWx3
        self.opaque = opaque  # crop, bool
        self.origin = origin  # (x, y) of the crop in sheet coordinates
        self.pockets: list[tuple[int, int, int, int, int]] = []  # (idx, area, cx, cy, kept)


def process_sheet(side: str, path: Path, dry_run: bool) -> list[Piece]:
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype(np.int16)
    h, w = rgb.shape[:2]
    diff = np.abs(rgb - 255).sum(axis=2)
    bg_candidate = diff <= BG_TOL

    border = np.zeros((h, w), dtype=bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    background = flood(bg_candidate, border)
    foreground = ~background

    # Six pedestal bases on the bottom rows -> seeds, left to right.
    band = foreground[int(h * 0.85) :, :].any(axis=0)
    runs, start = [], None
    for x, v in enumerate(band):
        if v and start is None:
            start = x
        if not v and start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, w - 1))
    runs = [r for r in runs if r[1] - r[0] > 40]
    if len(runs) != 6:
        sys.exit(f"{side}: expected 6 pedestal runs on the bottom rows, found {len(runs)}: {runs}")

    comps: list[np.ndarray] = []
    for x0, x1 in runs:
        seed = np.zeros((h, w), dtype=bool)
        seed[int(h * 0.85) :, x0 : x1 + 1] = True
        comps.append(flood(foreground, seed))

    # Attach unreached scraps (detached arrowheads etc.) to the nearest piece by bbox distance.
    leftover = foreground.copy()
    for c in comps:
        leftover &= ~c
    for scrap in label_components(leftover):
        sx0, sy0, sx1, sy1 = bbox(scrap)
        best, best_d = 0, None
        for i, c in enumerate(comps):
            cx0, cy0, cx1, cy1 = bbox(c)
            dx = max(cx0 - sx1, sx0 - cx1, 0)
            dy = max(cy0 - sy1, sy0 - cy1, 0)
            d = dx * dx + dy * dy
            if best_d is None or d < best_d:
                best, best_d = i, d
        comps[best] |= scrap

    pieces: list[Piece] = []
    near_white = diff <= NEAR_WHITE_TOL
    for role, comp in zip(ROLES, comps):
        code = side + role
        x0, y0, x1, y1 = bbox(comp)
        # Everything inside the piece's outline that is not sheet background is opaque,
        # including enclosed pockets (handled below).
        sub_bg = background[y0:y1, x0:x1]
        sub_rgb = rgb[y0:y1, x0:x1]
        # Pixels of *other* pieces that fall inside this bbox must not be counted.
        others = np.zeros_like(comp)
        for c in comps:
            if c is not comp:
                others |= c
        opaque = ~sub_bg & ~others[y0:y1, x0:x1]

        piece = Piece(code, sub_rgb.astype(np.uint8), opaque, (x0, y0))

        # Enclosed near-white pockets: candidates for clearing.
        pocket_mask = near_white[y0:y1, x0:x1] & opaque
        candidates = [c for c in label_components(pocket_mask) if c.sum() >= 150]
        seeds = POCKETS_TO_CLEAR.get(code, [])
        for idx, cand in enumerate(candidates):
            ys, xs = np.where(cand)
            cx, cy = int(xs.mean()) + x0, int(ys.mean()) + y0
            clear = any(cand[sy - y0, sx - x0] for sx, sy in seeds if 0 <= sy - y0 < cand.shape[0] and 0 <= sx - x0 < cand.shape[1])
            piece.pockets.append((idx, int(cand.sum()), cx, cy, 0 if clear else 1))
            if clear:
                piece.opaque &= ~cand
        pieces.append(piece)

        if not dry_run:
            DEBUG_DIR.mkdir(parents=True, exist_ok=True)
            dbg = Image.fromarray(piece.rgb).convert("RGBA")
            overlay = Image.new("RGBA", dbg.size, (0, 0, 0, 0))
            ov = np.asarray(overlay).copy()
            ov[~piece.opaque] = (255, 0, 255, 110)
            for idx, cand in enumerate(candidates):
                ov[cand] = (0, 200, 255, 160)
            overlay = Image.fromarray(ov)
            dbg = Image.alpha_composite(dbg, overlay)
            d = ImageDraw.Draw(dbg)
            for idx, area, cx, cy, kept in piece.pockets:
                d.text((cx - x0 + 4, cy - y0 - 6), f"#{idx} {area}px {'keep' if kept else 'CLEAR'}", fill=(255, 0, 0, 255))
            dbg.save(DEBUG_DIR / f"{code}.png")

    return pieces


def process_busts_sheet(dry_run: bool) -> list[Piece]:
    img = Image.open(BUSTS_SOURCE).convert("RGB")
    rgb = np.asarray(img).astype(np.int16)
    h, w = rgb.shape[:2]
    edge = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    bg_color = np.median(edge, axis=0).astype(np.int16)
    diff = np.abs(rgb - bg_color).sum(axis=2)
    border = np.zeros((h, w), dtype=bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    background = flood(diff <= BUSTS_BG_TOL, border)
    foreground = ~background
    print(f"  background colour {tuple(int(c) for c in bg_color)}")

    comps = [c for c in label_components(foreground) if c.sum() >= BUSTS_MIN_PIECE_AREA]
    by_row: dict[str, list[np.ndarray]] = {"w": [], "b": []}
    for c in comps:
        ys, xs = np.where(c)
        cy = ys.mean()
        for side, (y0, y1) in BUSTS_ROWS.items():
            if cy >= y0 and (y1 is None or cy < y1):
                by_row[side].append(c)
    pieces: list[Piece] = []
    near_bg = diff <= BUSTS_NEAR_BG_TOL
    for side, row in by_row.items():
        # Neighbouring busts can touch (the goat queen's and king's outlines do): split the
        # widest component at its thinnest column until the row has six pieces.
        while len(row) < 6:
            widest = max(row, key=lambda c: bbox(c)[2] - bbox(c)[0])
            x0, _, x1, _ = bbox(widest)
            cols = widest.sum(axis=0)
            lo, hi = x0 + (x1 - x0) * 35 // 100, x0 + (x1 - x0) * 65 // 100
            cut = lo + int(np.argmin(cols[lo:hi]))
            left, right = widest.copy(), widest.copy()
            left[:, cut:] = False
            right[:, :cut] = False
            if not left.any() or not right.any():
                sys.exit(f"farm-busts {side}: could not split merged component at x={cut}")
            print(f"  {side}: split merged component (width {x1 - x0}) at x={cut} (junction {int(cols[cut])} px)")
            row.remove(widest)
            row.extend([left, right])
        row.sort(key=lambda c: np.where(c)[1].mean())
        if len(row) != 6:
            sys.exit(f"farm-busts {side}: expected 6 pieces in the row, found {len(row)} (areas {[int(c.sum()) for c in row]})")
    all_final = [c for row in by_row.values() for c in row]
    for side, row in by_row.items():
        for role, comp in zip(BUSTS_ORDER, row):
            code = side + role
            x0, y0, x1, y1 = bbox(comp)
            others = np.zeros_like(comp)
            for c in all_final:
                if c is not comp:
                    others |= c
            opaque = ~background[y0:y1, x0:x1] & ~others[y0:y1, x0:x1]
            piece = Piece(code, rgb[y0:y1, x0:x1].astype(np.uint8), opaque, (x0, y0))
            # Enclosed background pockets: with a dark background nothing drawn is near
            # background colour (pupils are darker, skin/fur lighter), so clear them all.
            pocket_mask = near_bg[y0:y1, x0:x1] & opaque
            candidates = [c for c in label_components(pocket_mask) if c.sum() >= 150]
            for idx, cand in enumerate(candidates):
                ys, xs = np.where(cand)
                piece.pockets.append((idx, int(cand.sum()), int(xs.mean()) + x0, int(ys.mean()) + y0, 0))
                piece.opaque &= ~cand
            pieces.append(piece)
            if not dry_run:
                DEBUG_DIR.mkdir(parents=True, exist_ok=True)
                dbg = Image.fromarray(piece.rgb).convert("RGBA")
                ov = np.zeros((*piece.opaque.shape, 4), dtype=np.uint8)
                ov[~piece.opaque] = (255, 0, 255, 110)
                dbg = Image.alpha_composite(dbg, Image.fromarray(ov))
                dbg.save(DEBUG_DIR / f"busts-{code}.png")
    return pieces


def dehalo(piece: Piece) -> np.ndarray:
    """Returns an RGBA uint8 crop with the de-halo applied."""
    rgb = piece.rgb.astype(np.int16)
    opaque = piece.opaque.copy()
    lum = luma(rgb)
    dark_cut = np.percentile(lum[opaque], 5)
    outline = np.median(rgb[opaque & (lum <= dark_cut)], axis=0).astype(np.int16)

    alpha = np.where(opaque, 255, 0).astype(np.int16)
    out_rgb = rgb.copy()
    if DEHALO_MODE == "erode":
        opaque2 = erode(opaque, 1)
        alpha = np.where(opaque2, 255, 0).astype(np.int16)
    else:
        band = opaque & dilate(~opaque, DEHALO_BAND)
        light = band & (lum > HALO_LUMA_MIN)
        alpha[light] = np.clip(255 - lum[light], 0, 255).astype(np.int16)
        out_rgb[light] = outline
    # Transparent pixels take the outline colour so resampling cannot bleed white in.
    out_rgb[alpha == 0] = outline
    rgba = np.dstack([out_rgb, alpha]).astype(np.uint8)
    return rgba


def measure_heights(rgbas: dict[str, np.ndarray]) -> dict[str, int]:
    heights = {}
    for code, rgba in rgbas.items():
        solid = rgba[..., 3] >= 128
        _, y0, _, y1 = bbox(solid)
        heights[code] = y1 - y0
    return heights


def place(rgba: np.ndarray, scale: float, nudge: int, code: str, bottom_margin: int = BOTTOM_MARGIN) -> Image.Image:
    src = Image.fromarray(rgba, "RGBA")
    solid = rgba[..., 3] >= 128
    x0, y0, x1, y1 = bbox(solid)
    src = src.crop((x0, y0, x1, y1))
    new_w = max(1, round(src.width * scale))
    new_h = max(1, round(src.height * scale))
    small = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
    a = np.asarray(small)[..., 3] >= 128
    sx0, sy0, sx1, sy1 = bbox(a)
    # Base = bottom BASE_BAND_FRACTION of the piece; centre it horizontally.
    band_top = sy1 - max(1, int(round((sy1 - sy0) * BASE_BAND_FRACTION)))
    base_cols = np.where(a[band_top:sy1, :].any(axis=0))[0]
    base_cx = (base_cols.min() + base_cols.max() + 1) / 2
    left = int(round(CANVAS / 2 - base_cx)) + nudge
    top = CANVAS - bottom_margin - sy1
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(small, (left, top))
    fa = np.asarray(canvas)[..., 3] >= 128
    fx0, fy0, fx1, fy1 = bbox(fa)
    if fx0 < 4 or fy0 < 4 or fx1 > CANVAS - 4 or fy1 > CANVAS - 4:
        sys.exit(f"{code}: piece touches the canvas margin (bbox {fx0},{fy0},{fx1},{fy1}); adjust scale/nudge")
    print(f"  {code}: canvas bbox x[{fx0},{fx1}) y[{fy0},{fy1}) height {fy1 - fy0} base-centre nudge {nudge:+d}")
    return canvas


def contact_sheet(files: dict[str, Path], out_path: Path = CONTACT_SHEET) -> None:
    order = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"]
    cell = 40
    big = 96
    pad = 6
    label_h = 14
    width = pad + len(order) * (max(cell, big) + pad)
    rows_h = [cell, cell, cell, big]
    height = pad + sum(r + 2 * label_h + pad for r in rows_h)
    sheet = Image.new("RGB", (width, height), (40, 40, 40))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 11)
    except OSError:
        font = ImageFont.load_default()
    imgs = {code: Image.open(p).convert("RGBA") for code, p in files.items()}

    def row(y: int, size: int, square: tuple[int, int, int], grey: bool, title: str) -> int:
        draw.text((pad, y - 1), title, fill=(200, 200, 200), font=font)
        y += label_h
        x = pad
        for code in order:
            tile = Image.new("RGB", (size, size), square)
            piece = imgs[code].resize((size, size), Image.Resampling.LANCZOS)
            tile.paste(piece, (0, 0), piece)
            if grey:
                tile = tile.convert("L").convert("RGB")
            sheet.paste(tile, (x, y))
            draw.text((x, y + size + 1), code, fill=(200, 200, 200), font=font)
            x += max(cell, big) + pad
        return y + size + label_h + pad

    y = pad
    y = row(y, cell, FARM_LIGHT, False, "40 px on farm light squares")
    y = row(y, cell, FARM_DARK, False, "40 px on farm dark squares")
    y = row(y, cell, FARM_LIGHT, True, "40 px, grayscale(1)")
    row(y, big, FARM_LIGHT, False, "96 px reference")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, optimize=True)
    print(f"contact sheet -> {out_path.relative_to(ROOT)}")


# ---- main --------------------------------------------------------------------------------
def report_ratios(heights: dict[str, int], strict_order: bool) -> None:
    for side in "wb":
        king = heights[side + "K"]
        ratios = {r: heights[side + r] / king for r in ROLES}
        print(f"  {side}: ratio to king " + ", ".join(f"{r} {v:.2f}" for r, v in ratios.items()))
        if strict_order:
            adjusted = {r: heights[side + r] * ROLE_HEIGHT_FACTOR[r] / (king * ROLE_HEIGHT_FACTOR["K"]) for r in ROLES}
            print(f"  {side}: after ROLE_HEIGHT_FACTOR " + ", ".join(f"{r} {v:.2f}" for r, v in adjusted.items()))
            if adjusted["P"] < PAWN_KING_MIN_RATIO:
                print(f"  !! {side}: pawn:king {adjusted['P']:.2f} is below {PAWN_KING_MIN_RATIO} - tune ROLE_HEIGHT_FACTOR (DoD 10)")
            others = [adjusted[r] for r in "NBRQ"]
            if not (adjusted["P"] < min(others) and adjusted["K"] > max(others)):
                sys.exit(f"{side}: pawn must be the smallest and king the tallest piece: {adjusted}")
            if abs(adjusted["N"] - adjusted["B"]) > 0.10 * max(adjusted["N"], adjusted["B"]):
                sys.exit(f"{side}: knight and bishop heights differ by more than 10 %: {adjusted}")
            if not (max(adjusted["N"], adjusted["B"]) < adjusted["R"] < adjusted["Q"]):
                print(f"  note {side}: source proportions deviate from N~B < R < Q (R {adjusted['R']:.2f}, Q {adjusted['Q']:.2f}); shipped as drawn")
        else:
            # Busts: the king (crown + cross) must be the tallest; the rest is the artist's call.
            if heights[side + "K"] < max(heights[side + r] for r in "PNBRQ"):
                sys.exit(f"{side}: king is not the tallest bust: {heights}")


def run_farm(dry_run: bool) -> None:
    pieces: list[Piece] = []
    for side, path in SOURCES.items():
        print(f"{path.name}:")
        pieces.extend(process_sheet(side, path, dry_run))
        for p in pieces:
            if p.code[0] != side:
                continue
            for idx, area, cx, cy, kept in p.pockets:
                print(f"  {p.code} pocket #{idx}: area {area} px, centre ({cx},{cy}) -> {'keep' if kept else 'CLEAR'}")

    rgbas = {p.code: dehalo(p) for p in pieces}
    heights = measure_heights(rgbas)
    tallest = max(heights.values())
    print("source heights:", heights, "tallest:", tallest)
    report_ratios(heights, strict_order=True)
    base_scale = TALLEST_FRACTION * CANVAS / tallest
    if dry_run:
        return
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files: dict[str, Path] = {}
    print("placing:")
    for p in pieces:
        scale = base_scale * ROLE_HEIGHT_FACTOR[p.code[1]]
        canvas = place(rgbas[p.code], scale, NUDGE_X[p.code], p.code)
        out = OUT_DIR / f"{p.code}.png"
        canvas.save(out, optimize=True, compress_level=9)
        files[p.code] = out
    print(f"wrote {len(files)} pieces -> {OUT_DIR.relative_to(ROOT)}")
    contact_sheet(files)


def run_busts(dry_run: bool) -> None:
    print(f"{BUSTS_SOURCE.name}:")
    pieces = process_busts_sheet(dry_run)
    for p in pieces:
        for idx, area, cx, cy, kept in p.pockets:
            print(f"  {p.code} pocket #{idx}: area {area} px, centre ({cx},{cy}) -> CLEAR")
    rgbas = {p.code: dehalo(p) for p in pieces}
    heights = measure_heights(rgbas)
    tallest = max(heights.values())
    print("source heights:", heights, "tallest:", tallest)
    report_ratios(heights, strict_order=False)
    base_scale = BUSTS_TALLEST_FRACTION * CANVAS / tallest
    if dry_run:
        return
    BUSTS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    files: dict[str, Path] = {}
    print("placing:")
    for p in pieces:
        canvas = place(rgbas[p.code], base_scale, BUSTS_NUDGE_X.get(p.code, 0), p.code, BUSTS_BOTTOM_MARGIN)
        out = BUSTS_OUT_DIR / f"{p.code}.png"
        canvas.save(out, optimize=True, compress_level=9)
        files[p.code] = out
    print(f"wrote {len(files)} pieces -> {BUSTS_OUT_DIR.relative_to(ROOT)}")
    contact_sheet(files, BUSTS_CONTACT_SHEET)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv
    wanted = set(args) or {"farm", "farm-busts"}
    if "farm" in wanted:
        run_farm(dry_run)
    if "farm-busts" in wanted:
        run_busts(dry_run)
    if dry_run:
        print("dry run: nothing written")


if __name__ == "__main__":
    main()
