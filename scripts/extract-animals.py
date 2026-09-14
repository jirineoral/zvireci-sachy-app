#!/usr/bin/env python
"""
Extract the character library (Phase 6): every character as light pieces (white side)
and dark pieces (black side) into public/piece-sets/animals/<id>/{light,dark}/<role>.png,
plus the scoped stylesheet per character and the review contact sheets.

Usage (from the repo root):
    python scripts/extract-animals.py              # all characters
    python scripts/extract-animals.py had kocky    # some characters
    python scripts/extract-animals.py --dry-run    # measurements and pocket verdicts only

Sources: assets/source/animals/<id>.png, 1774x887 busts sheets with two rows of the same
character. New sheets are on a WHITE background with the dark row on top and the light row
below; the goats and frogs come from the two dark-background sheets of Phase 3/4 (see
SOURCES for the row mapping). Layout per row: P R N B Q K left to right, Czech labels
under each bust (ignored by area).

Pipeline (docs/phase-6-plan.md, decision 11):
  1. Background = border flood fill with a colour tolerance; the dark outlines stop it.
  2. Busts = connected components of the foreground larger than MIN_PIECE_AREA, six per
     row; touching neighbours are split at the thinnest column.
  3. Enclosed pockets of near-background colour: on a dark sheet all are cleared (nothing
     drawn is that dark and flat); on a white sheet a pocket is cleared only when it is
     FLAT white (mean >= FLAT_MEAN on every channel, std <= FLAT_STD) - drawn whites in
     this art are shaded. Every candidate is printed with its verdict; POCKET_OVERRIDES
     corrects individual verdicts by (character, side, role, index).
  4. De-halo (gated), one scale per character from its tallest bust, shared baseline,
     base-centred placement - all reused from extract-pieces.py.

Deterministic: same inputs + constants -> byte-identical PNGs.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "assets/source/animals"
OUT_DIR = ROOT / "public/piece-sets/animals"
DEBUG_DIR = ROOT / "assets/source/_debug/animals"  # git-ignored
CONTACT_SHEETS = [ROOT / "docs/piece-contact-sheet-animals-1.png", ROOT / "docs/piece-contact-sheet-animals-2.png"]

# Shared helpers from the Phase 3 script (hyphenated file name -> load by path).
_spec = importlib.util.spec_from_file_location("extract_pieces", ROOT / "scripts/extract-pieces.py")
ep = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(ep)

ROLES_ON_SHEET = ["P", "R", "N", "B", "Q", "K"]  # left -> right
ROW_SPLIT = 430  # sheet px: top row above, bottom row below (by centroid)
LABEL_SEARCH = (390, 470)  # sheet px: where the top row's text labels are looked for
MIN_PIECE_AREA = 5000
WHITE_BG_TOL = 40  # sum |rgb-254| for the border flood on white sheets
DARK_BG_TOL = 36
NEAR_TOL = 15  # "sheet colour" for pocket candidates
POCKET_MIN_AREA = 150
FLAT_MEAN = 250  # a pocket is sheet white only if flat: every channel mean >= this ...
FLAT_STD = 4.0  # ... and the per-channel std averages <= this
TALLEST_FRACTION = 0.94
BOTTOM_MARGIN = 8
BOARD_LIGHT = (0xDC, 0xE6, 0xF0)
BOARD_DARK = (0x8F, 0xA3, 0xBD)

# Character -> where its light and dark rows come from. "top"/"bottom" = sheet row.
# New sheets: dark on top, light below. The goats/frogs sheets hold two characters each.
SOURCES: dict[str, dict[str, tuple[str, str]]] = {
    "kuzlata": {"light": ("farm-busts.png", "top"), "dark": ("farm-busts-inverse.png", "top")},
    "zabky": {"light": ("farm-busts-inverse.png", "bottom"), "dark": ("farm-busts.png", "bottom")},
}
for _id in ["had", "jezevcici", "clovek", "kocky", "kravky", "mravenci", "mysky", "oslici", "slepice", "tucnaci", "zraloci", "mouchy", "vosy", "lamy", "pstrosi", "veverky", "zizaly"]:
    SOURCES[_id] = {"light": (f"{_id}.png", "bottom"), "dark": (f"{_id}.png", "top")}

# Sheets without the Czech piece labels between the rows (the layout is the same: dark row
# on top, light row below, P R N B Q K left to right — see docs/vlastni-sada.md).
UNLABELLED_SHEETS = {"veverky.png"}

# Verdict overrides: (character, side, role, pocket index) -> True = clear, False = keep.
# Filled in from the DoD review of the printed verdicts / debug overlays.
POCKET_OVERRIDES: dict[tuple[str, str, str, int], bool] = {}


# ---- fast connected components (BFS over pixel coordinates) -----------------------------
def components(mask: np.ndarray, min_area: int = 1) -> list[np.ndarray]:
    """4-connected components of `mask` with at least `min_area` pixels, largest first."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    comps: list[np.ndarray] = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        queue = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while queue:
            y, x = queue.popleft()
            pts.append((y, x))
            if y > 0 and mask[y - 1, x] and not seen[y - 1, x]:
                seen[y - 1, x] = True
                queue.append((y - 1, x))
            if y < h - 1 and mask[y + 1, x] and not seen[y + 1, x]:
                seen[y + 1, x] = True
                queue.append((y + 1, x))
            if x > 0 and mask[y, x - 1] and not seen[y, x - 1]:
                seen[y, x - 1] = True
                queue.append((y, x - 1))
            if x < w - 1 and mask[y, x + 1] and not seen[y, x + 1]:
                seen[y, x + 1] = True
                queue.append((y, x + 1))
        if len(pts) >= min_area:
            comp = np.zeros_like(mask, dtype=bool)
            py, px = zip(*pts)
            comp[list(py), list(px)] = True
            comps.append(comp)
    comps.sort(key=lambda c: -int(c.sum()))
    return comps


# ---- sheets ------------------------------------------------------------------------------
class Sheet:
    def __init__(self, path: Path):
        self.path = path
        img = Image.open(path).convert("RGB")
        self.rgb = np.asarray(img).astype(np.int16)
        h, w = self.rgb.shape[:2]
        edge = np.concatenate([self.rgb[:4].reshape(-1, 3), self.rgb[-4:].reshape(-1, 3), self.rgb[:, :4].reshape(-1, 3), self.rgb[:, -4:].reshape(-1, 3)])
        self.bg_color = np.median(edge, axis=0).astype(np.int16)
        self.dark_bg = bool(self.bg_color.sum() < 3 * 128)
        diff = np.abs(self.rgb - self.bg_color).sum(axis=2)
        border = np.zeros((h, w), dtype=bool)
        border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
        self.background = ep.flood(diff <= (DARK_BG_TOL if self.dark_bg else WHITE_BG_TOL), border)
        self.near_bg = diff <= NEAR_TOL
        # Label band of the top row: the letters between the rows are small components.
        letters = [c for c in components(~self.background & ~self.near_bg, 20) if c.sum() < 6000]  # letters or whole words
        bottoms = []
        for c in letters:
            x0, y0, x1, y1 = ep.bbox(c)
            if LABEL_SEARCH[0] <= (y0 + y1) / 2 <= LABEL_SEARCH[1] and y1 - y0 <= 32 and x1 - x0 <= 160:
                bottoms.append(y1)
        if len(bottoms) >= 3:
            self.label_bottom = int(np.percentile(bottoms, 90))  # letters share a baseline (accents and descenders vary a little); a high percentile ignores stray scraps
            print(f"  {path.name}: top-row labels end at y={self.label_bottom} ({len(bottoms)} letters)")
        elif path.name in UNLABELLED_SHEETS:
            self.label_bottom = 0  # no labels on this sheet: nothing to trim above the bottom row
            print(f"  {path.name}: unlabelled sheet, no label band")
        else:
            sys.exit(f"{path.name}: only {len(bottoms)} label letters found between the rows")
        # Busts per row, left to right.
        comps = [c for c in components(~self.background, MIN_PIECE_AREA)]
        # A bust of the bottom row may touch the top row (a crown's cross under a base):
        # such a component spans both rows and is cut at the emptiest line near ROW_SPLIT.
        split_comps: list[np.ndarray] = []
        for c in comps:
            _, y0, _, y1 = ep.bbox(c)
            if y0 < ROW_SPLIT - 60 and y1 > ROW_SPLIT + 60:
                lo, hi = ROW_SPLIT - 80, ROW_SPLIT + 80
                cut = lo + int(np.argmin(c[lo:hi].sum(axis=1)))
                upper, lower = c.copy(), c.copy()
                upper[cut:, :] = False
                lower[:cut, :] = False
                print(f"  {path.name}: component spanning both rows cut at y={cut}")
                split_comps += [comp for comp in components(upper, MIN_PIECE_AREA)] + [comp for comp in components(lower, MIN_PIECE_AREA)]
            else:
                split_comps.append(c)
        self.rows: dict[str, list[np.ndarray]] = {"top": [], "bottom": []}
        for c in split_comps:
            cy = np.nonzero(c)[0].mean()
            self.rows["top" if cy < ROW_SPLIT else "bottom"].append(c)
        for row_name, row in self.rows.items():
            while len(row) < 6:
                widest = max(row, key=lambda c: ep.bbox(c)[2] - ep.bbox(c)[0])
                x0, _, x1, _ = ep.bbox(widest)
                cols = widest.sum(axis=0)
                lo, hi = x0 + (x1 - x0) * 35 // 100, x0 + (x1 - x0) * 65 // 100
                cut = lo + int(np.argmin(cols[lo:hi]))
                left, right = widest.copy(), widest.copy()
                left[:, cut:] = False
                right[:, :cut] = False
                if not left.any() or not right.any():
                    sys.exit(f"{path.name} {row_name}: could not split merged component at x={cut}")
                print(f"  {path.name} {row_name}: split merged component (width {x1 - x0}) at x={cut}")
                row[:] = [c for c in row if c is not widest] + [left, right]
            row.sort(key=lambda c: np.nonzero(c)[1].mean())
            if row_name == "bottom":
                # The top row's text labels sit just above the bottom busts and can touch a
                # crown's cross. Their band is measured from the untouched letters (small
                # components between the rows); a bottom bust keeps nothing above the band's
                # lower edge (at most a few pixels of a cross tip are lost).
                for i, c in enumerate(row):
                    cut = c[: self.label_bottom, :].sum()
                    if cut:
                        print(f"  {path.name} bottom: dropped {int(cut)} px above y={self.label_bottom} (label text / touching tip) from bust #{i + 1}")
                        c[: self.label_bottom, :] = False
            if len(row) != 6:
                sys.exit(f"{path.name} {row_name}: expected 6 busts, found {len(row)} (areas {[int(c.sum()) for c in row]})")
        self.all_busts = [c for row in self.rows.values() for c in row]
        print(f"  {path.name}: background {tuple(int(c) for c in self.bg_color)} ({'dark' if self.dark_bg else 'white'}), 12 busts")


_sheets: dict[str, Sheet] = {}


def sheet(name: str) -> Sheet:
    if name not in _sheets:
        _sheets[name] = Sheet(SRC_DIR / name)
    return _sheets[name]


def cut_piece(character: str, side: str, role: str, sh: Sheet, comp: np.ndarray, dry_run: bool) -> ep.Piece:
    x0, y0, x1, y1 = ep.bbox(comp)
    others = np.zeros_like(comp)
    for c in sh.all_busts:
        if c is not comp:
            others |= c
    opaque = ~sh.background[y0:y1, x0:x1] & ~others[y0:y1, x0:x1]
    piece = ep.Piece(f"{side}{role}", sh.rgb[y0:y1, x0:x1].astype(np.uint8), opaque, (x0, y0))
    pocket_mask = sh.near_bg[y0:y1, x0:x1] & opaque
    for idx, cand in enumerate(components(pocket_mask, POCKET_MIN_AREA)):
        px = sh.rgb[y0:y1, x0:x1][cand]
        mean = px.mean(axis=0)
        std = float(px.std(axis=0).mean())
        if sh.dark_bg:
            clear = True
            why = "dark sheet: every enclosed pocket is background"
        else:
            clear = bool((mean >= FLAT_MEAN).all() and std <= FLAT_STD)
            why = f"mean {tuple(int(m) for m in mean)} std {std:.1f}"
        key = (character, side, role, idx)
        if key in POCKET_OVERRIDES:
            clear = POCKET_OVERRIDES[key]
            why += f" -> OVERRIDE {'clear' if clear else 'keep'}"
        ys, xs = np.nonzero(cand)
        print(f"    {character} {side} {role} pocket #{idx}: area {int(cand.sum())} at ({int(xs.mean()) + x0},{int(ys.mean()) + y0}) -> {'CLEAR' if clear else 'keep'} ({why})")
        piece.pockets.append((idx, int(cand.sum()), int(xs.mean()) + x0, int(ys.mean()) + y0, 0 if clear else 1))
        if clear:
            piece.opaque &= ~cand
    if not dry_run:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        dbg = Image.fromarray(piece.rgb).convert("RGBA")
        ov = np.zeros((*piece.opaque.shape, 4), dtype=np.uint8)
        ov[~piece.opaque] = (255, 0, 255, 110)
        for idx, area, cx, cy, kept in piece.pockets:
            if kept:
                r = 6
                ov[max(0, cy - y0 - r) : cy - y0 + r, max(0, cx - x0 - r) : cx - x0 + r] = (0, 255, 255, 160)
        dbg = Image.alpha_composite(dbg, Image.fromarray(ov))
        dbg.save(DEBUG_DIR / f"{character}-{side}-{role}.png")
    return piece


MARGIN = 4  # px kept free on every side of the canvas


def scaled(rgba: np.ndarray, scale: float) -> tuple[Image.Image, np.ndarray]:
    src = Image.fromarray(rgba, "RGBA")
    x0, y0, x1, y1 = ep.bbox(rgba[..., 3] >= 128)
    src = src.crop((x0, y0, x1, y1))
    small = src.resize((max(1, round(src.width * scale)), max(1, round(src.height * scale))), Image.Resampling.LANCZOS)
    return small, np.asarray(small)[..., 3] >= 128


def fits(rgba: np.ndarray, scale: float) -> bool:
    _, a = scaled(rgba, scale)
    sx0, sy0, sx1, sy1 = ep.bbox(a)
    return (sx1 - sx0) <= ep.CANVAS - 2 * MARGIN and (sy1 - sy0) <= ep.CANVAS - BOTTOM_MARGIN - MARGIN


def place_fit(rgba: np.ndarray, scale: float, code: str) -> Image.Image:
    """ep.place() with the horizontal position clamped into the canvas margins (base-centred when possible)."""
    small, a = scaled(rgba, scale)
    sx0, sy0, sx1, sy1 = ep.bbox(a)
    band_top = sy1 - max(1, int(round((sy1 - sy0) * ep.BASE_BAND_FRACTION)))
    base_cols = np.where(a[band_top:sy1, :].any(axis=0))[0]
    base_cx = (base_cols.min() + base_cols.max() + 1) / 2
    left = int(round(ep.CANVAS / 2 - base_cx))
    left = min(max(left, MARGIN - sx0), ep.CANVAS - MARGIN - sx1)  # clamp: never past the margins
    top = ep.CANVAS - BOTTOM_MARGIN - sy1
    canvas = Image.new("RGBA", (ep.CANVAS, ep.CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(small, (left, top))
    fa = np.asarray(canvas)[..., 3] >= 128
    fx0, fy0, fx1, fy1 = ep.bbox(fa)
    print(f"  {code}: canvas bbox x[{fx0},{fx1}) y[{fy0},{fy1}) height {fy1 - fy0}")
    return canvas


def stylesheet(character: str) -> str:
    roles = {"K": "king", "Q": "queen", "R": "rook", "B": "bishop", "N": "knight", "P": "pawn"}
    lines = [f"/* {character}: light row = white pieces, dark row = black pieces. Generated by scripts/extract-animals.py. */"]
    lines.append(
        f"html.skm-white-{character} .cg-wrap piece.white, html.skm-black-{character} .cg-wrap piece.black "
        "{ background-size: contain; background-position: center; background-repeat: no-repeat; }"
    )
    for role, name in roles.items():
        lines.append(f"html.skm-white-{character} .cg-wrap piece.{name}.white {{ background-image: url(light/{role}.png); }}")
    for role, name in roles.items():
        lines.append(f"html.skm-black-{character} .cg-wrap piece.{name}.black {{ background-image: url(dark/{role}.png); }}")
    return "\n".join(lines) + "\n"


def run_character(character: str, dry_run: bool) -> dict[str, Path] | None:
    print(f"{character}:")
    pieces: list[ep.Piece] = []
    for side, (sheet_name, row_name) in SOURCES[character].items():
        sh = sheet(sheet_name)
        for role, comp in zip(ROLES_ON_SHEET, sh.rows[row_name]):
            pieces.append(cut_piece(character, side, role, sh, comp, dry_run))
    rgbas = {p.code: ep.dehalo(p) for p in pieces}
    heights = ep.measure_heights(rgbas)
    tallest = max(heights.values())
    print(f"  heights {heights} tallest {tallest}")
    for side in ("light", "dark"):
        king = heights[side + "K"]
        if king < max(heights[side + r] for r in "PNBRQ"):
            print(f"  !! {character} {side}: the king is not the tallest bust (K {king}, tallest other {max(heights[side + r] for r in 'PNBRQ')}) - judge on the contact sheet")
    if dry_run:
        return None
    scale = TALLEST_FRACTION * ep.CANVAS / tallest
    # Wide characters (flies' wings, ants' antennae) may not fit at the height-derived
    # scale: shrink the whole character in 2 % steps until every bust fits with margins.
    while not all(fits(rgbas[p.code], scale) for p in pieces):
        scale *= 0.98
    if scale < TALLEST_FRACTION * ep.CANVAS / tallest:
        print(f"  {character}: scaled down to {scale * tallest / ep.CANVAS:.2f} of the canvas height so the widest bust fits")
    files: dict[str, Path] = {}
    for p in pieces:
        side, role = p.code[: -1], p.code[-1]
        out_dir = OUT_DIR / character / side
        out_dir.mkdir(parents=True, exist_ok=True)
        canvas = place_fit(rgbas[p.code], scale, f"{character} {p.code}")
        out = out_dir / f"{role}.png"
        canvas.save(out, optimize=True, compress_level=9)
        files[p.code] = out
    (OUT_DIR / character / "pieces.css").write_text(stylesheet(character), encoding="utf-8", newline="\n")
    print(f"  wrote 12 pieces + pieces.css -> {(OUT_DIR / character).relative_to(ROOT)}")
    return files


def contact_sheets(all_files: dict[str, dict[str, Path]]) -> None:
    order = [f"{side}{role}" for side in ("light", "dark") for role in ("P", "N", "B", "R", "Q", "K")]
    cell, big, pad, label_h = 40, 96, 6, 14
    try:
        font = ImageFont.truetype("arial.ttf", 11)
    except OSError:
        font = ImageFont.load_default()
    block_h = label_h + 3 * (cell + pad) + big + pad + label_h
    width = pad + len(order) * (big + pad)
    names = list(all_files)
    halves = [names[: (len(names) + 1) // 2], names[(len(names) + 1) // 2 :]]
    for out_path, part in zip(CONTACT_SHEETS, halves):
        sheet_img = Image.new("RGB", (width, pad + len(part) * (block_h + pad)), (40, 40, 40))
        draw = ImageDraw.Draw(sheet_img)
        y = pad
        for character in part:
            imgs = {code: Image.open(p).convert("RGBA") for code, p in all_files[character].items()}
            draw.text((pad, y), f"{character}  -  light row (white pieces) | dark row (black pieces); 40 px light sq / dark sq / grey, then 96 px", fill=(230, 230, 230), font=font)
            y += label_h

            def row(y: int, size: int, square: tuple[int, int, int], grey: bool) -> int:
                x = pad
                for code in order:
                    tile = Image.new("RGB", (size, size), square)
                    piece = imgs[code].resize((size, size), Image.Resampling.LANCZOS)
                    tile.paste(piece, (0, 0), piece)
                    if grey:
                        tile = tile.convert("L").convert("RGB")
                    sheet_img.paste(tile, (x, y))
                    x += big + pad
                return y + size + pad

            y = row(y, cell, BOARD_LIGHT, False)
            y = row(y, cell, BOARD_DARK, False)
            y = row(y, cell, BOARD_LIGHT, True)
            y = row(y, big, BOARD_LIGHT, False)
            x = pad
            for code in order:
                draw.text((x, y - pad), code, fill=(200, 200, 200), font=font)
                x += big + pad
            y += label_h + pad
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sheet_img.save(out_path, optimize=True)
        print(f"contact sheet -> {out_path.relative_to(ROOT)}")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv
    wanted = args or list(SOURCES)
    unknown = [w for w in wanted if w not in SOURCES]
    if unknown:
        sys.exit(f"unknown character(s): {unknown}; known: {', '.join(SOURCES)}")
    all_files: dict[str, dict[str, Path]] = {}
    for character in wanted:
        files = run_character(character, dry_run)
        if files:
            all_files[character] = files
    if dry_run:
        print("dry run: nothing written")
        return
    if len(all_files) == len(SOURCES):
        contact_sheets(all_files)
    else:
        print("partial run: contact sheets not regenerated (run without arguments)")
    manifest = OUT_DIR / "animals.json"
    if manifest.exists():
        listed = {a["id"] for a in json.loads(manifest.read_text(encoding="utf-8"))["animals"]}
        missing = sorted(set(SOURCES) - listed)
        if missing:
            print(f"note: extracted but not in animals.json: {missing}")


if __name__ == "__main__":
    main()
