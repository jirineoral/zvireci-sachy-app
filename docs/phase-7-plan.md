# Phase 7 — MVP for a public release (plan, rev. 1)

Five items from the brief (M1–M5), nothing else; ideas go to `docs/BACKLOG.md`. Decisions
below are the ones the brief left open; everything else follows the brief literally.

## Decisions

### M1 / M2 — user piece sets
1. **Where**: a button `Vlastní figurky…` in "Nastavení" opens a `<dialog class="user-sets">`
   (the panel has no room for twelve file inputs). The dialog holds: a picker of the
   user's sets (`Nová sada` + saved ones), a name field, twelve slots
   (`bílý král … černý pěšec`, each a file input + 64 px preview or "chybí"), the buttons
   `Uložit a použít`, `Smazat sadu`, `Zavřít`, the prompt block (M3) and the storage
   sentence (M2). No new dependency.
2. **Model**: a user set is `{ id, name, pieces: Partial<Record<'wK'…'bP', Blob>> }`. Missing
   slots show the built-in classic piece (that is what "upload fewer, fill later" means on
   the board); the dialog marks them "chybí".
3. **Import pipeline** (`src/image-import.ts`): size cap 20 MB per file → sniff the first
   bytes (`89 50 4E 47 0D 0A 1A 0A` PNG, `FF D8 FF` JPEG; anything else — SVG included —
   is rejected before decoding, regardless of extension or `File.type`) → decode with
   `createImageBitmap` (failure = "poškozený obrázek") → reject above 40 megapixels
   ("moc velký obrázek") → draw into a 256×256 canvas (contain, centred, transparent) →
   `canvas.toBlob('image/png')`. **What is stored and displayed is always our own
   re-encoded PNG, never the uploaded bytes** — a second line of defence behind the sniff.
4. **Applying** (`src/piece-sets.ts`): a user set is a family of kind `user` in the
   "Figurky" selector (`Moje: <name>`). It is styled through a constructed stylesheet
   (`new CSSStyleSheet()` + `document.adoptedStyleSheets`) with the same scoped rules as
   the characters, `html.skm-user-<id> .cg-wrap piece.<role>.<color> { background-image:
   url(blob:…) }` — CSSOM, so it is not blocked by `style-src 'self'`; the CSP gains
   `blob:` in `img-src` (object URLs created only by our own code from re-encoded PNGs).
   Object URLs are revoked when a set is replaced or deleted. Board palette = the farm
   palette. Character selects are disabled ("—") for user sets, like other pair styles.
5. **Storage** (`src/user-sets.ts`): IndexedDB `skm`, store `userSets` keyed by `id`,
   values `{ id, name, createdAt, pieces }` with blobs. If `indexedDB.open` throws/fails
   (private window, blocked storage, quota), the store degrades to an in-memory map for
   the session with `console.warn`; the dialog says so in one sentence.
   `skm.pieceFamily` may point at a user family; on load user sets are read before the
   families are built, so a reload restores the selected user set.
6. **Deleting** the active set falls back to the first built-in family; deleting asks
   `confirm()` (native dialog, no new UI).
7. **Messages** (plain Czech, in the dialog, never `alert`): `Tenhle soubor není PNG ani
   JPG.`, `Obrázek se nepodařilo načíst (poškozený soubor).`, `Obrázek je moc velký
   (max. 20 MB / 40 Mpx).`, `Nahraj aspoň jednu figurku.` A failed file leaves its slot
   unchanged; the current set on the board is never touched until `Uložit a použít`
   succeeds.

### M3 — the prompt
8. `docs/PROMPTS.md` is the single source; `src/prompts.ts` imports it with Vite's
   `?raw` and extracts the fenced block tagged `prompt`. The prompt is in **English**
   (image models follow it more reliably) with the placeholders `{ZVÍŘE}` and
   `{PALETA}` and a Czech note above it; both variants (světlá / tmavá) are two
   paragraphs of the same block, so one copy carries everything. `Zkopírovat prompt`
   uses `navigator.clipboard.writeText` with a `<textarea>` fallback when the clipboard
   API is unavailable.

### M4 — licensing
9. Already shipped in the security review (GPL text next to the engine, footer, README);
   this phase adds the AI-artwork sentence to the footer and README and re-checks.

### M5 — bottom of the ladder
10. Measured first (see results); mechanism changed to "random among the engine's top N
    within a centipawn window" — the window is the one refinement over the brief's
    "top N": it keeps the opponent from choosing a candidate that is far worse than the
    rest when the position demands one move (a hanging piece), which is exactly the
    coherence the brief asks for.

## Files
```
src/image-import.ts       NEW  sniff, decode, downscale, re-encode
src/user-sets.ts          NEW  IndexedDB store with in-memory fallback
src/prompts.ts            NEW  reads docs/PROMPTS.md?raw
src/ui/user-sets-dialog.ts NEW dialog markup + wiring
src/piece-sets.ts         MOD  user families, constructed stylesheet
src/main.ts               MOD  button, dialog, footer sentence
src/styles/app.css        MOD  dialog styles
src/difficulty.ts, src/game-controller.ts, src/engine.ts  MOD  M5
docs/PROMPTS.md           NEW
vite.config.ts            MOD  img-src blob:
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## M5 — what levels 1 and 2 actually played (measured 2026-09-13)

Method: ten white moves chosen by Stockfish at depth 10 (a strong, consistent opponent),
the level's reply recorded, then every reply scored afterwards at depth 12 as centipawn
loss against the best move. Temporary hook, removed before the commit.

**Before (60 % / 30 % uniformly random legal moves):**
- Level 1: `1…a5 2…e6 3…Bb4+ 4…Bf8 5…c6 6…Ra6?? 7…Nh6 8…Ng4 9…Qf6 10…d5` — average loss
  73 cp, one ≥ 300 (Nh6 after the rook was already lost). Character: quiet pawn pushes
  and a pointless retreat (`Bf8`), then the rook wanders into a bishop (`Ra6`) — nothing
  reacts to threats because the random moves do not look at the board at all.
- Level 2: `1…e6 2…Be7 3…a5 4…b6 5…a4?? 6…c5 7…exd5 8…g6 9…Kf8 10…a3` — average 83 cp,
  one ≥ 300: `a4` pushed a rook-side pawn while `Qf3` was aiming at the a8 rook (`Qxa8`
  next move). Exactly the "three sensible moves, then a piece for nothing" pattern:
  erratic, not weak.

Verdict: random, not weak — an oblivious opponent that rewards nothing.

**Change:** the two levels now run their own weak search (Skill 0, depth 1) with MultiPV
and draw the move uniformly among the top N lines that lie within a centipawn window of
the best: level 1 N = 8 within 250 cp, level 2 N = 5 within 120 cp. When only one move
saves a piece, the window leaves only that move; in quiet positions any of the candidates
may come. Levels 3–6 unchanged (N = 1).

**After:**
- Level 1: `1…Nf6 2…Ng8 3…e6 4…c5 5…Ne7 6…Nf5 7…Nh4 8…Nxg2+ 9…g5 10…Rg8` — average 71 cp,
  none ≥ 300. Character: aimless knight wandering and a speculative `Nxg2+` sac — weak, but
  every move is one a beginner might play, nothing is simply left en prise, and it loses
  the knight to a two-move trap (depth 1 cannot see it), which is what a learner's
  own good move should be rewarded by.
- Level 2: `1…e5 2…Nc6 3…d6 4…Na5? 5…Nc6 6…a5 7…b6 8…Ne7 9…Be6 10…Bg4` — average 52 cp,
  none ≥ 300; `Na5` to the rim loses the knight to `b4`, then coherent development.
  Reads as a weak club beginner.

Not retuned beyond that; no levels added.

## DoD results (executed 2026-09-13)

Tested in the Vite dev server (Chromium) with a temporary hook for the promotion
position and the ladder measurement (removed; `git grep -e SKM_DEBUG -e debugLoadFen
HEAD -- src` empty). Uploads were fed through the real `<input type=file>` `change`
handler with `DataTransfer`, i.e. the production import path.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Twelve PNGs on board + promotion dialog | PASS | Twelve canvas-drawn PNGs (one slot JPEG) → `Moje: Kolečka` selected, board pieces and spectators `url(blob:…)`, the four promotion-dialog pieces `url(blob:…)` |
| 2 | SVG rejected by content | PASS | An SVG with `<script>` named `evil.png` with `type: image/png` → "bílý král: Tenhle soubor není PNG ani JPG." (signature sniff; extension and MIME ignored) |
| 3 | Graceful failures | PASS | Corrupt PNG (valid signature, garbage) → "Obrázek se nepodařilo načíst (poškozený soubor)."; 7000×7000 (49 Mpx) → "Obrázek je moc velký (max. 40 megapixelů)."; 21 MB file → "Soubor je moc velký (max. 20 MB)."; zero files + save → "Nahraj aspoň jednu figurku."; after each the slot still reads "chybí" and the board keeps its current set |
| 4 | Survives reload | PASS | Reload → `skm.pieceFamily = user-…`, selector shows `Moje: Kolečka`, pieces and spectators from blob URLs, character selects disabled |
| 5 | Delete falls back | PASS | Delete (confirm) → IndexedDB empty, family `hlavy` selected and persisted, `adoptedStyleSheets` 0 (object URLs revoked), goats on the board |
| 6 | Blocked IndexedDB | PASS (path test) | `indexedDB.open` made to throw → `openUserSetStore()` returns the memory store (`persistent: false`), save/list work, the dialog shows the session-only sentence. A real private window was not driven (the in-app browser has none); the fallback is the same code path |
| 7 | Prompt | PASS | Button copies the block from `docs/PROMPTS.md` (real click → "Prompt je ve schránce"). Pasted once into ChatGPT (DALL·E) with `a fox` / `cream and warm orange`: **first attempt returned both rows** — light foxes on top, dark foxes below, all six markers correct (collar, tower, helmet with red plume, mitre with cross, crown, taller crown + sceptre), white background, no text. The prompt says "ONE row" and asks for both variants; the model stacked them, which is the better outcome |
| 8 | Licensing | PASS | GPL text at `engine/LICENSE-GPL-3.0.txt`, footer credits + "grafika figurek je vygenerovaná umělou inteligencí", README "Engine" + AI-artwork line; B6 left open |
| 9 | M5 | PASS | See above: measured, changed to top-N-within-window, re-measured; README note added |
| 10 | Build / debug / security | PASS | `tsc` strict, 130 kB JS; grep empty; `npm audit` 0; checklist run appended to `docs/security-review.md` |

Deviations from the brief / plan:
- M5 mechanism is "top N **within a centipawn window**", not plain top N (plan decision 10).
- A wrong file *count* cannot happen by construction (one file per labelled slot); fewer than twelve is allowed by the brief and shown as "chybí", zero is refused.
- Saving while an import is still decoding is blocked by a busy state on the button (found in testing: a slow JPEG would otherwise be left out of the saved set).
- CSP `img-src` gains `blob:` for the user sets (documented in `vite.config.ts` and the security review).
- The prompt asks for one row but also for both variants; DALL·E produced a two-row sheet on the first try — kept as is.
