# Phase 18 — Upload a whole character sheet; the app cuts it (plan, rev. 1)

Twelve single files are too much for a child (and the guide's whole-sheet layout already
exists), so the `Vlastní figurky…` dialog gets **one upload for the whole sheet**: the
app finds the twelve busts, shows them in a 2 × 6 preview with the roles named, lets the
player fix the order, and saves the set. The Python extractor stays for the library;
the browser cutter is a port of its geometry (flood-filled background, connected
components, base-centred placement on a 256 canvas) written over `ImageData`.

## Decisions (veto in review)
1. **Layout assumed = the guide's**: two rows (dark on top, light below), six busts left
   to right P R N B Q K, plain light background. Anything else is repaired by the player in
   the preview (swap two tiles, flip the rows) rather than guessed.
2. **Algorithm** (`src/sheet-cutter.ts`, pure functions over `ImageData`, no DOM):
   downscale the sheet to ≤ 1800 px wide (memory + speed), estimate the background
   colour from the border, flood-fill the background from the border (tolerance as in the
   extractor), label 4-connected foreground components ≥ 0.15 % of the image, drop text-like
   small ones, split a component that spans both rows at the emptiest line, split a
   component wider than 1.5× the median at its thinnest column, assign to rows by centroid
   (k = 2 on y), sort by x, expect 6 + 6. Each bust: crop, alpha from the flood mask
   (enclosed white pockets stay, like the extractor's light sheets), one common scale so
   the tallest is 94 % of the canvas, bottom-aligned with an 8 px margin, base-centred.
   Output: twelve 256 × 256 PNG blobs through the existing canvas path (same security
   properties as `importPieceImage`: decoded and re-encoded, never the original bytes).
3. **UI**: a `Nahrát celý list` file input above the grid. After cutting, the twelve
   slots of the existing grid are filled (dark row → black pieces, light row → white); a
   line says `Našel jsem 12 figurek — zkontroluj, jestli sedí role, a ulož.` When the count
   is not 12: `Našel jsem N figurek. Zkontroluj mezery mezi figurkami nebo je nahraj po
   jedné.` and the found ones are placed in order, the rest stays empty. Two small tools:
   `Prohodit řady` (light/dark swapped) and click-two-slots-to-swap.
4. **Limits**: file ≤ 8 MB, ≤ 40 Mpx (existing), cutting runs on the main thread with a
   `await` yield per bust so the dialog stays responsive (a 1800 × 900 sheet is ~1.6 M
   pixels; the flood fill and labelling are linear).
5. Nothing is stored beyond the existing `userSets` (IndexedDB); no new key.

## Files
```
src/sheet-cutter.ts          NEW  pure geometry over ImageData
src/image-import.ts          MOD  decodeImage() shared, cut → 12 blobs
src/ui/user-sets-dialog.ts   MOD  whole-sheet input, swap tools, messages
src/styles/app.css           MOD
docs/vlastni-sada.md, README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. `assets/source/animals/veverky.png` uploaded as a whole sheet → 12 slots filled, roles
   right (top row → black, P R N B Q K), pieces visually equal to the library's cut (same
   size class, bottom-aligned); save → the set plays on the board.
2. A sheet with the labels between rows (older style, e.g. `had.png`) → 12 slots, labels
   discarded.
3. A sheet with rows swapped → `Prohodit řady` fixes it; two slots swapped by click.
4. A sheet with two busts touching → the split finds 12; a photo with no busts → the N ≠ 12
   message, dialog usable, nothing saved.
5. Cutting a 1774 × 887 sheet takes < 3 s on the dev machine and the dialog stays
   responsive; memory returns after (no retained ImageData).
6. `npm run build`; no debug code; security checklist (only canvas-encoded PNGs reach
   storage/CSS; the sheet's bytes never do).

## DoD results (executed 2026-09-14)

Dev server, in-app pane; sheets fed to the file input through `DataTransfer`.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | veverky sheet | PASS | 12 slots, top row → black, P R N B Q K in order; piece heights on the canvas 162–240 px vs. the Python extractor's 165–241 for the same sheet; saved set plays |
| 2 | had sheet (labels between rows) | PASS | 12 slots, labels dropped as scraps (< ¼ of the row's largest component) |
| 3 | Rows swapped / two slots | PASS | A sheet with the light row on top → 12 found; `Prohodit řady` → `Řady prohozené`; click king then queen → `Prohozeno: bílý král ↔ bílá dáma` |
| 4 | Touching busts / photo | PASS | Second bust shifted 60 px into the first → still 12 (thinnest-column split); a flat blue 800×600 → `V obrázku jsem žádné figurky nenašel…`, nothing changed |
| 5 | Speed / responsiveness | PASS | Cut itself 90–210 ms for 1774×887; the 12 PNG encodes run in parallel (in the harness each `toBlob` callback is throttled to 1 s, so sequential encoding took 12 s — parallel takes one tick); end to end 1.3–1.5 s here, expected well under 1 s in a foreground tab |
| 6 | Build / debug / security | PASS | `tsc` strict clean; no debug code; checklist run recorded |

Deviations: the whole veverky sheet is one connected component (crown crosses touch the
row below), so the row split relies on the "spans both rows → cut at the emptiest line"
rule rather than on a gap — it works, and is recorded in the cutter's `trace`; a first
test image with clipped tails at the top edge exposed that stray scraps could push a row
over six and block the merge split — fixed by dropping components under ¼ of the row's
largest before splitting.
