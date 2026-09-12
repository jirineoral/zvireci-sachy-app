# Piece-set contract

A piece set is **data**: one folder under `public/piece-sets/<id>/` plus one entry in
`public/piece-sets/sets.json`. Adding a set changes no TypeScript. This file is everything a
new set needs to satisfy; you should not have to read the code.

## Manifest entry

```json
{
  "id": "farm",
  "name": "Kůzlata vs. žabky",
  "pair": "kuzlata-zabky",
  "board": { "light": "#dce6f0", "dark": "#8fa3bd" }
}
```

- `id` — folder name; lowercase letters, digits and hyphens only.
- `name` — shown in the "Figurky" selector.
- `pair` — documents which animal pairing the set belongs to (backlog B1). No code reads it.
- `board.light` / `board.dark` — the board colours. They are **part of the set**, not a user
  setting, because readability depends on the pieces' palette (cream goats vanish on a
  classic cream/brown board).
- `stylesheet` — normally absent, meaning `piece-sets/<id>/pieces.css`. The single exception
  is `"stylesheet": null`, used only by the built-in `cburnett` entry: selecting it removes
  the set stylesheet so the styling bundled into the app shows through. No other set should
  use it.

The **first entry** is the default for a first visit. The chosen set is remembered in
`localStorage` (`skm.pieceSetId`); an unknown stored id falls back to the first entry, and
a missing or broken manifest falls back to the built-in classic pieces. A broken set must
never produce an unplayable board — worst case the classic pieces appear and an error is
logged.

## Folder contents

```
public/piece-sets/<id>/
  pieces.css
  wK.* wQ.* wR.* wB.* wN.* wP.*
  bK.* bQ.* bR.* bB.* bN.* bP.*
```

- Filenames exactly `wK wQ wR wB wN wP bK bQ bR bB bN bP`, case-sensitive, one extension
  per set (`.png` for raster, `.svg` for vector).
- `pieces.css` is the only place that knows filenames and extensions. It contains twelve
  rules of the form

  ```css
  .cg-wrap piece.pawn.white { background-image: url(wP.png); }
  ```

  (roles `pawn knight bishop rook queen king`, colours `white black`). Image URLs are
  relative to the stylesheet. Chessground sizes the image with `background-size: cover`
  into a square box; a set may restate `background-size: contain; background-position:
  center; background-repeat: no-repeat;` on `.cg-wrap piece`, but must not rely on
  anything in `src/`.

## Artwork rules

- **Square canvas.** Raster: 256×256 PNG with alpha (the browser scales down; this keeps
  pieces sharp on high-DPI screens). Vector: square `viewBox`, `0 0 64 64`.
- **One scale factor for all twelve pieces** is the default: relative sizes must match
  real pieces (a pawn is smaller than a king; both kings are the same height). A documented
  per-role adjustment is permitted when the source art's proportions differ sharply from
  chess convention (for example a pawn under ~55 % of the king's height). It must be applied
  identically to both sides and preserve the ordering pawn < knight ≈ bishop < rook <
  queen < king. Record it in the extraction script.
- **Bottom-aligned on a shared baseline.** The tallest piece stands at roughly 90 % of the
  canvas height; every piece's bottom sits on the same line with a small margin (≈ 4–5 %)
  below so it does not touch the square edge.
- **Identifiable at 40 px.** Test by rendering at 40 px, not by looking at the full-size
  file. Outlines must stay visibly continuous at 40 px on both the light and the dark
  square colour of the set.
- **Sides distinguishable under `filter: grayscale(1)`.** In particular the two kings.
- **Transparent background, no white halo** around the outline, no opaque fringe or
  leftover background outside the silhouette.
- Horizontal centring follows the body/base, not the raw bounding box (a knight's head or
  a bishop's bow extending to one side must not shift the piece off its square).

## Quality gate

Before a set ships, render all twelve pieces in a row at 40 px on the set's light squares,
again on its dark squares, and once more in greyscale (`docs/piece-contact-sheet.png` for
`farm`, produced by `scripts/extract-pieces.py`). If a piece is not identifiable at 40 px,
or the two kings are hard to tell apart in greyscale, the set is not done.

## Provenance and attribution

- `cburnett` (built-in): chess pieces by Colin M.L. Burnett, licensed CC BY-SA 3.0, as
  bundled by `@lichess-org/chessground`.
- `farm`: AI-generated character sheets in `assets/source/goats.png` (white) and
  `assets/source/frogs.png` (black); the twelve PNGs are extracted by
  `scripts/extract-pieces.py`, which holds the hand-tuned per-piece constants. Rerunning it
  reproduces the files.
