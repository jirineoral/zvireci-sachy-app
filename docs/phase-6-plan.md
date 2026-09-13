# Phase 6 — Zvířecí knihovna: any animal vs. any animal, random colour (plan, rev. 1)

Thirteen sides instead of two: the eleven new busts sheets in `assets/source/` (had,
jezevčíci, jiřík = táta, kočky, kravka, mravenec, myška, oslíci, slépka, tučňáci, žralok) plus
the goats and frogs already extracted. Every sheet carries a **dark** row (top) and a
**light** row (bottom) of the same character, so any character can play either colour. The
player picks their character, optionally the opponent's, and a colour — with **náhodně**
(random) as the default for both the colour and the opponent. This closes backlog B1.

Model policy unchanged: plan and review with the strongest model, implementation with a
cheaper one, DoD executed item by item. Decisions not written here are escalated.

## Verified facts (2026-09-13)
- 11 new sheets, all 1774×887 RGB on a **white** background (~254), same 2×6 layout and
  Czech labels as the busts sheets, order P R N B Q K left→right; **dark row on top, light
  row below** on every sheet. `jiřík_aka_člověk.png` is the user (light row = natural
  colours, dark row = grey-blue). `žralok` light row is *blue* rather than cream; `tučňáci`
  light row is white-on-white (outlines carry it).
- The busts recipe assumes a dark background and clears every enclosed near-background
  pocket. On white sheets that rule would punch holes into eye whites and white fur, so it
  cannot be reused as is. A probe over four sheets shows 4–14 enclosed near-white pockets
  (≥ 150 px) per sheet, roughly 100 in total — a reviewable number.
- Piece-set CSS today is one stylesheet per set defining both colours; a set is a
  *pair*. `@lichess-org/chessground` selectors are `.cg-wrap piece.<role>.<color>`; a
  selector with a higher specificity (an extra class on `<html>`) overrides them and the
  bundled cburnett rules without touching the bundled CSS.
- Phase 5A families/animals (`skm.pieceFamily`, `skm.animal`) and 5B spectators
  (`animalOf(color)`, `SOUND`) are the integration points; the controller owns `humanColor`
  and `setHumanColor()` = new game.

## Decisions (veto in review, not during implementation)

### Data
1. **A character library replaces the pair sets for the "Hlavy" style.** New folder
   `public/piece-sets/animals/` with one folder per character and a manifest:
   ```
   public/piece-sets/animals/animals.json
   public/piece-sets/animals/<id>/light/{K,Q,R,B,N,P}.png   256×256, the character as WHITE pieces
   public/piece-sets/animals/<id>/dark/{K,Q,R,B,N,P}.png    the character as BLACK pieces
   public/piece-sets/animals/<id>/pieces.css                scoped rules, see 4
   ```
   `animals.json`:
   ```json
   { "board": { "light": "#dce6f0", "dark": "#8fa3bd" },
     "animals": [
       { "id": "kuzlata",  "name": "kůzlata",   "za": "kůzlata",   "sound": "Mééé!" },
       { "id": "zabky",    "name": "žáby",      "za": "žáby",      "sound": "Kvák!" },
       { "id": "had",      "name": "hadi",      "za": "hady",      "sound": "Sss!" },
       { "id": "jezevcici","name": "jezevčíci", "za": "jezevčíky", "sound": "Haf!" },
       { "id": "kocky",    "name": "kočky",     "za": "kočky",     "sound": "Mňau!" },
       { "id": "kravky",   "name": "kravky",    "za": "kravky",    "sound": "Bú!" },
       { "id": "mravenci", "name": "mravenci",  "za": "mravence",  "sound": "Cvak!" },
       { "id": "mysky",    "name": "myšky",     "za": "myšky",     "sound": "Píp!" },
       { "id": "oslici",   "name": "oslíci",    "za": "oslíky",    "sound": "Íá!" },
       { "id": "slepice",  "name": "slepice",   "za": "slepice",   "sound": "Kokodák!" },
       { "id": "tucnaci",  "name": "tučňáci",   "za": "tučňáky",   "sound": "Kvák-kvák!" },
       { "id": "zraloci",  "name": "žraloci",   "za": "žraloky",   "sound": "Chňap!" },
       { "id": "tata",     "name": "táta",      "za": "tátu",      "sound": "Hm!" }
     ] }
   ```
   `za` is the accusative used after "Hraju za …" / "Soupeř: …"; `name` is the nominative
   for everything else; `sound` feeds `{zvuk}` in the review bubbles. Validation like
   `sets.json`: `id` `/^[a-z0-9-]+$/`, strings non-empty, invalid entries dropped with a
   warning, a broken manifest = the library is unavailable and "Hlavy" falls back to the
   built-in pieces (the Phase 3 rule). **The user's character is listed as "táta"** —
   say so if you prefer a diminutive.
2. **One board palette for the whole library** (the farm palette, top-level `board`).
   Cream, grey, black, brown, blue characters all sit on it in the probe sheets; the DoD
   contact sheet verifies every character on both square colours. If one character fails,
   it gets a per-character `board` override in its entry (the schema allows it, nothing
   uses it yet).
3. **`sets.json` keeps the other styles.** The two pair entries `farm-busts` /
   `farm-busts-inverse` are removed, their PNGs move to `animals/kuzlata` and
   `animals/zabky` (light/dark), and a single entry
   `{ "id": "hlavy", "name": "Hlavy", "family": "hlavy", "library": "animals" }` points at
   the library. `farm` (celé figurky) and `cburnett` stay unchanged, as fixed pairs. The
   CONTRACT documents both kinds: *pair set* (folder with `w*`/`b*`) and *library*.
4. **CSS scoping instead of a stylesheet swap.** Each character's `pieces.css` contains
   ```css
   html.skm-white-had .cg-wrap piece.king.white  { background-image: url(light/K.png); }  /* ×6 */
   html.skm-black-had .cg-wrap piece.king.black  { background-image: url(dark/K.png); }   /* ×6 */
   html.skm-white-had .cg-wrap piece.white, html.skm-black-had .cg-wrap piece.black {
     background-size: contain; background-position: center; background-repeat: no-repeat; }
   ```
   `piece-sets.ts` loads up to two `<link data-piece-set="animal:<id>">` (the white and the
   black character; one link when both are the same character) and sets the two classes
   on `<html>`. Same load/error/swap rules as today (new link loads → old links removed;
   error → link removed, previous styling stays). The board, the promotion dialog and the
   spectators need no change — they all render `.cg-wrap piece.*`.
5. **Same character on both sides is allowed** (light hadi vs. dark hadi is a legitimate,
   readable pairing — the contact sheet shows both rows side by side). "Náhodně" for the
   opponent never picks the player's own character, though; a deliberate choice can.

### Settings and game flow
6. **Controls** (in "Nastavení"): `Hraju za` (13 characters, accusative),
   `Soupeř` (`náhodně` + 13 characters), `Barva` (`náhodně` / `bílá` / `černá`),
   `Figurky` (Hlavy / Celé figurky / Klasické), `Obtížnost`, `Hodnocení tahů`. For
   `Celé figurky` and `Klasické` the two character selects are disabled and show `—`
   (5A's implied-animal display goes away: with a library there is no implication).
7. **Persistence**: `skm.animal` (already exists; new ids validated against the library),
   `skm.opponent` (`random` | id), `skm.color` (`random` | `w` | `b`). Defaults:
   `kuzlata` / `random` / `random`. Unknown or garbage values → defaults + `console.warn`.
   `skm.pieceFamily` stays.
8. **Random is resolved once per game**, at `Nová hra` (and at every event that already
   means a new game: colour change). The controller stops owning the colour choice:
   `setHumanColor` is replaced by an option `nextGame: () => { color: Color }` that the
   controller calls inside `newGame()` before resetting; `main.ts` implements it from the
   preferences (random → `Math.random() < 0.5`). The controller reports the outcome through
   `onNewGame(color)` so the view can resolve the opponent and apply the character CSS.
   Changing `Hraju za` or `Soupeř` mid-game is **view-only** as in 5A (pieces swap, game
   continues; if `Soupeř` is `náhodně` the current opponent stays until the next game).
   Changing `Barva` starts a new game (as today).
9. **Spectators and bubbles** follow the resolved pair: `animalOf(color)` returns the
   character id, `{zvuk}` comes from `animals.json` (`SOUND` in `commentary.ts` is replaced
   by a lookup with `Hm!` as the fallback), so every character has a voice.
10. **Random colour and the status line**: nothing new — the status already says who is
    to move; the board orientation follows the drawn colour. The `Barva` select keeps
    showing `náhodně` (it is a preference, not the current colour); the current colour is
    visible from the board and from the spectators.

### Added after the review (user request, 2026-09-13)
14. **Difficulty labels follow the player's character.** `animals.json` entries carry
    `levels` (six names, weakest first, e.g. kůzlata: Kůzle → Kozí král, člověk: Batole →
    Král šachu); the ladder itself (`difficulty.ts`) is unchanged — only the option texts
    of `Obtížnost` are relabelled when the character changes, and the frog names stay the
    default for styles without characters.
15. **"Ouch" voices.** Each character has `hurt` (člověk: "Au!") spoken by its king in the
    review when one of its pieces is captured; the human's `sound` is "Hm!".
16. The user's character is **"člověk"** (`Hraju za člověka`), not "táta".
17. Six more sheets arrived during the phase (`moucha`, `vosa`, `lama`, `pštros`,
    `šavlozubá veverka`, `žížala`) → `mouchy`, `vosy`, `lamy`, `pstrosi`, `veverky`,
    `zizaly`; 19 characters in total.

### Extraction
11. **New recipe `busts-light`** in `scripts/extract-pieces.py` for white-background busts
    sheets: rows `dark` = top, `light` = bottom; border flood with tolerance 40 (outlines
    stop it, as in the farm recipe); **pocket rule**: an enclosed component of near-white
    pixels (sum |rgb−254| ≤ 15, area ≥ 150 px) is cleared iff it is *flat* white (mean
    ≥ 250 on every channel and std ≤ 4) — sheet background is flat, drawn whites in this
    art are shaded. Every candidate is printed with its verdict and drawn on the debug
    overlay; the DoD reviews the overlays and any wrong verdict gets an explicit per-piece
    override list (`POCKET_OVERRIDES`), never a threshold tweak after the fact. De-halo
    `gated` as before. One global scale per character (tallest of its 12), king tallest
    asserted, `BUSTS_TALLEST_FRACTION` unchanged so all characters match the goats/frogs.
12. **Output** goes straight into `public/piece-sets/animals/<id>/{light,dark}/<role>.png`
    (roles `K Q R B N P`, no colour prefix — the folder is the colour) plus the scoped
    `pieces.css`; the goats/frogs are re-emitted into the same layout from the two existing
    dark sheets by the existing busts recipe (row mapping per variant, unchanged art).
    Source files are renamed to ASCII (`assets/source/animals/<id>.png`) so the script and
    git stay diacritics-free; the originals with Czech names are deleted after the copy.
13. **Contact sheets**: one `docs/piece-contact-sheet-animals.png` with, per character,
    the light row and the dark row at 40 px on both square colours + greyscale, plus a
    96 px reference row — 13 characters × 4 rows. The quality gate from CONTRACT applies to
    every character; a character that fails at 40 px is reported and **left out of the
    manifest**, not shipped.

## Files
```
assets/source/animals/<id>.png                 MOVE  13 sheets, ASCII names (kuzlata/zabky = the two dark busts sheets)
public/piece-sets/animals/animals.json         NEW
public/piece-sets/animals/<id>/light|dark/*.png NEW  13 × 12
public/piece-sets/animals/<id>/pieces.css      NEW  generated by the script
public/piece-sets/farm-busts*, farm-busts-inverse  DELETE (moved into the library)
public/piece-sets/sets.json                    MOD   hlavy → library entry; pair entries removed
public/piece-sets/CONTRACT.md                  MOD   library kind, scoped CSS, pocket rule
scripts/extract-pieces.py                      MOD   busts-light recipe, library output, scoped css, animals contact sheet
src/piece-sets.ts                              MOD   library manifest, pair resolution (player/opponent/colour), two links + html classes, new keys
src/main.ts                                    MOD   Hraju za / Soupeř / Barva selects, nextGame/onNewGame wiring
src/ui/controls.ts                             MOD   Barva options (náhodně/bílá/černá) — or the select moves to main.ts entirely
src/game-controller.ts                         MOD   nextGame()/onNewGame options replace setHumanColor
src/commentary.ts, src/review.ts               MOD   sound lookup by character
src/styles/app.css                             MOD   none expected
README.md, docs/BACKLOG.md                     MOD   B1 closed
```
Not touched: `board-bridge.ts`, `engine.ts`, `feedback.ts`, `difficulty.ts`, `tsconfig.json`,
`package.json`.

## Commits
1. `Phase 6: plan`
2. `Phase 6: extract the character library` (script + sources + PNGs + contact sheet + manifest)
3. `Phase 6: character library in the app` (scoped CSS, selects, random colour/opponent)
4. `Phase 6: DoD results`
Then the Pages deploy.

## Explicitly NOT in this phase
New drawings or re-drawing a character that fails the gate; per-character board
palettes beyond the override hook; remembering the last random draw across reloads;
tournament/score keeping; animations; anything in the engine or the feedback thresholds.

## Definition of Done
Artwork
1. `docs/piece-contact-sheet-animals.png` reviewed: every character identifiable at 40 px
   on both square colours, light and dark rows distinguishable from each other in
   greyscale; kings tallest; no white fringe on the dark square (screenshot ×3 zoom on the
   penguins' light row and the shark's blue row, the two hardest cases).
2. Pocket verdicts: the script's printed list and the debug overlays reviewed for all 13
   sheets; wrong verdicts fixed via `POCKET_OVERRIDES` and named in the results.
3. Rerun → byte-identical PNGs (`git status` clean).
App
4. First visit (empty storage): `Hlavy` / `kůzlata` / `náhodně` / `náhodně`; ten
   `Nová hra` presses draw both colours and at least three different opponents; the
   player's character is never drawn as the opponent; the board orientation matches the
   drawn colour; spectators show the drawn pair; `<html>` carries exactly the two classes.
5. Explicit choices: `Hraju za hady`, `Soupeř: žraloky`, `Barva: černá` → dark snakes at the
   bottom, blue sharks at the top, orientation black; swap to `Barva: bílá` → new game,
   light snakes at the bottom, dark sharks at the top. Promotion dialog (temporary
   `debugLoadFen`) shows the pieces of the current pair.
6. Mid-game `Hraju za` / `Soupeř` change: pieces swap, FEN/status/engine indicator
   unchanged; with `Soupeř: náhodně` the opponent stays until the next game.
7. Same character both sides (`kočky` vs `kočky`): one `<link>`, both classes, light vs dark
   readable; `náhodně` never produces it (100 draws in the console).
8. Persistence and garbage: reload keeps animal/opponent/colour preferences; `skm.animal =
   "drak"`, `skm.color = "green"`, a 10 kB `skm.opponent` → defaults + `console.warn`;
   legacy `skm.animal = zabky` still valid.
9. `Celé figurky` / `Klasické`: character selects disabled with `—`, `Barva` still works
   (incl. random); back to `Hlavy` restores the stored characters.
10. Library manifest missing (rename `animals.json`): `Hlavy` shows built-in pieces,
    `console.error`, playable; one character folder missing: that character's link errors,
    the other side still styled, playable.
11. Review bubbles use the pair's sounds (`Sss!`, `Chňap!`, `Hm!` for táta); spectators
    show the pair's kings.
12. Mobile 375 px: the three selects fit the settings panel without horizontal scroll.
13. `npm run build` strict; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty; no
    new dependency; security checklist run (new storage keys validated, no new sinks).

Wrap-up: preview on 4173 rebuilt, Pages redeployed, DoD table appended here with deviations.
