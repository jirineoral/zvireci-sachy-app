# Phase 5 — Animal × colour choice, and the comic-strip game review (plan, rev. 1)

Two blocks, independent of each other, delivered as separate commits so either can be
vetoed alone:

- **5A — Zvíře × barva.** The player picks *who they are* (kůzlata / žáby) and *which
  colour they play* (bílá / černá). The two busts sheets (light goats / dark frogs and the
  inverse palette) make every combination drawable.
- **5B — Komiksový rozbor.** The two kings sit beside the board as spectators for the whole
  game. After the game ends, an on-demand "Rozbor" replays it ply by ply with comic-strip
  speech bubbles: funny, Czech, written for a ten-year-old club player.

Model policy unchanged: this plan and its review with the strongest model; implementation
with a cheaper one; DoD executed, not asserted. Any decision not written here is escalated,
not improvised.

## Verified facts (2026-09-13, this machine)
- Both busts sheets are extracted (`15bb084`): `public/piece-sets/farm-busts/` (light goats
  white, dark frogs black) and `public/piece-sets/farm-busts-inverse/` (dark goats, light
  frogs), identical layout and scale (kings 239/241 vs 237/241 px on the 256 canvas). The
  inverse folder is **not** in `sets.json` yet.
- On the current farm palette (`#dce6f0` / `#8fa3bd`) the inverse pieces are legible at
  40 px on both square colours and in greyscale (`docs/piece-contact-sheet-busts-inverse.png`).
  Cream frogs behave like today's cream goats; grey goats keep more contrast on the dark
  square than today's green frogs do.
- Piece sets are pure view state (`src/piece-sets.ts`); `humanColor` lives in the
  controller and a colour change already means "new game" (`setHumanColor` → `newGame`).
- The promotion dialog renders pieces through `.cg-wrap piece.<role>.<color>`, so anything
  styled that way follows the active set for free. The spectators in 5B reuse this.
- Per-ply feedback data exists only as `annotations: (Glyph | null)[]`; the pre-move best
  move is discarded after classification (`evaluateHumanMove`).
- Move history is chess.js SAN (`chess.history()`); a position after ply *i* is obtained by
  replaying SAN into a fresh `Chess` — no rule logic of ours.

## Block 5A — Zvíře × barva

### Decisions (veto in review)
1. **The manifest stays flat**; each entry gains two optional fields:
   ```json
   { "id": "farm-busts", "name": "Hlavy", "family": "hlavy",
     "whiteAnimal": "kuzlata", "pair": "kuzlata-zabky", "board": {…} }
   { "id": "farm-busts-inverse", "name": "Hlavy", "family": "hlavy",
     "whiteAnimal": "zabky", … }
   { "id": "farm", "name": "Celé figurky", "family": "cele", "whiteAnimal": "kuzlata", … }
   { "id": "cburnett", "name": "Klasické", "family": "klasicke", "stylesheet": null, … }
   ```
   `family` groups the variants of one drawing style; `whiteAnimal` says which animal the
   white pieces are (`kuzlata` | `zabky`); both absent = a set without animals. Entries
   without `family` form a one-member family named after the `id`. Contract: adding an
   inverse variant is still "a folder plus an entry"; no `.ts` change.
2. **UI** (in "Nastavení", replacing today's "Hraju za" and "Figurky"):
   - `Figurky` — one option per family (`Hlavy`, `Celé figurky`, `Klasické`), label = the
     `name` of the family's first entry.
   - `Hraju za` — `kůzlata` / `žáby`. Enabled only when the family has an entry for the
     requested combination; otherwise disabled and showing the animal implied by the colour
     (family `cele`: white = kůzlata), or `—` for `klasicke`.
   - `Barva` — `bílá` / `černá` (today's side select, renamed).
3. **Resolution rule**: the set to display is the family's entry whose `whiteAnimal` is the
   chosen animal when the colour is white, or the *other* animal when the colour is black.
   If the family has no such entry, the family's first entry is used and `Hraju za` is
   disabled (decision 2). The animal list is fixed to the two animals present in the manifest
   (`kuzlata`, `zabky`) — B1's future pairs would extend the manifest, not the code.
4. **Semantics of changes**: `Figurky` and `Hraju za` are view-only — the pieces change
   appearance immediately, the game continues (a child who was the goats and picks the
   frogs simply *is* the frogs now; nothing in the game changes). `Barva` keeps today's
   behaviour: new game, board flips.
5. **Persistence**: `skm.pieceFamily` and `skm.animal` in `localStorage` (validated against
   the manifest / the fixed animal list, fallback = defaults). `skm.pieceSetId` is retired:
   on start, a stored `skm.pieceSetId` is mapped once to its family and then removed.
   Colour is **not** persisted (as today: every visit starts as white).
   Defaults = `hlavy` + `kuzlata` + `bílá` → `farm-busts`, i.e. exactly today's first visit.
6. **Board palette of the inverse set** = the farm palette (verified fact 2). If the DoD
   screenshot says otherwise, the palette changes in `sets.json` only and is reported.
7. **Ownership**: `piece-sets.ts` grows a `resolve(family, animal, humanColor)` and exposes
   families/animals; `main.ts` wires the three selects and passes the controller's colour to
   the resolver on `Barva` change. The controller learns nothing new; `game-controller.ts`
   is touched only to rename `sideSelect` labels if at all.
8. **`CONTRACT.md`** documents `family` / `whiteAnimal` and the resolution rule; README's
   piece-set paragraph updated.

### Files (5A)
```
public/piece-sets/sets.json            MOD  family/whiteAnimal fields; farm-busts-inverse entry (after farm-busts)
public/piece-sets/CONTRACT.md          MOD  the two fields + resolution rule
src/piece-sets.ts                      MOD  families, animals, resolve(), new storage keys, one-time migration
src/main.ts                            MOD  three selects (Figurky, Hraju za, Barva), wiring
src/ui/controls.ts                     MOD  side select relabelled "Barva" (options unchanged)
README.md                              MOD
```
Not touched: `game-controller.ts` logic, `board-bridge.ts`, `engine.ts`, `feedback.ts`.

## Block 5B — Komiksový rozbor

### Decisions (veto in review)
9. **Spectators are the set's own kings.** Two elements outside the board,
   `<div class="spectator cg-wrap"><piece class="king white"></piece></div>` and the black
   one, styled by whatever piece set is active (same mechanism as the promotion dialog).
   No new artwork. The spectator of the pieces that start at the *top* of the board sits
   above it, the other below it (follows orientation, so the child's own king is always
   near them). Desktop: heads ≈ 72 px at the board's left corner above/below; mobile
   (≤ 899 px): ≈ 48 px in the same corners. During play they only sit there (no
   animation — P5 is a later phase); with `cburnett` they are the classic kings.
10. **Entering the review**: a `Rozbor` button appears in the button row only when the game
    is over (`status.over`) and at least one ply was played. It puts the controller into
    `mode: 'review'`: board locked (`movableColor: null`), `Zpět` disabled, `Nová hra`
    exits the review and starts a new game (as always). `Barva` also exits (new game);
    `Figurky`/`Hraju za` keep working (view-only). No engine call is made in review mode
    (analysis A never starts on a finished game; the guard `feedbackActive()` already
    covers it).
11. **Navigation**: `⏮ ◀ ▶ ⏭` buttons under the status line plus keyboard ← → Home End on
    desktop. Position *i* = fresh `Chess` with the first *i* SAN moves replayed; the bridge's
    `sync()` gets that instance, the last move highlighted and the glyph badge of ply *i*
    (if any). The move list highlights ply *i* (`.current`) and scrolls it into view.
    Review starts at ply 0 (the start position) with an opening bubble.
12. **Per-ply record** replaces `annotations: (Glyph | null)[]` with
    `plies: Array<{ glyph: Glyph | null; betterSan: string | null }>`, where `betterSan` is
    the engine's best move (from analysis A) converted to SAN with chess.js on the pre-move
    position, kept only when the glyph is `?!`, `?` or `??`. Undo/new game truncate it as
    today. This is the one controller change beyond the mode flag and costs nothing extra.
13. **Commentary is data** in `src/commentary.ts`: Czech template lists keyed by a
    *situation* derived from chess.js and the ply record only:
    - glyph (`!!`, `!`, `!?`, `?!`, `?`, `??`) for the human's plies;
    - flags for any ply: `capture`, `check`, `castle`, `promotion`, `enPassant`, `mate`,
      `stalemate`, `draw`, `firstMove`, `queenCapture`, `bigCapture` (≥ 5 pawns taken);
    - the game result and who won, for the last bubble.
    Selection: most specific category first (mate > glyph > promotion > castle >
    queenCapture > capture > check > quiet), then a template picked deterministically by
    `(ply, sanLength)` so the same game always tells the same story but consecutive plies
    vary. Templates use `{san}`, `{better}`, `{piece}` placeholders only; all inserted text is
    chess.js SAN or the template's own words, set via `textContent` (never `innerHTML`).
    Minimum **8 templates per category**, ≥ 12 for `quiet` and `capture`.
14. **Who speaks**: the mover's king, always. On a human `??` or `!!` the *other* king gets a
    second, shorter reaction bubble (gloating / grudging respect). Tone rules written into
    the file header: funny, never humiliating (a ten-year-old who just lost is reading it),
    mistakes are framed as "next time" with the better move when known
    (`„Příště zkus {better}, ten by je pěkně překvapil.“`), no sarcasm about the child,
    plenty of sarcasm about the opponent's pieces, frog/goat puns welcome
    (kvák, mek, žabí stehýnka, kozí brada…). Diacritics correct.
15. **Bubble rendering**: one `<div class="bubble">` per spectator, positioned next to the
    head with a CSS tail pointing at it; `hidden` when empty; appears with a 150 ms
    fade (respecting `prefers-reduced-motion`). Text length capped by the template author
    at ~90 characters so the bubble never overlaps the board on a 360 px phone.
16. **Files** — `src/review.ts` (replay position for ply *i*, situation extraction, bubble
    text lookup; pure functions over SAN + ply records), `src/commentary.ts` (data),
    `src/ui/review-controls.ts` (buttons + keyboard), `src/ui/spectators.ts` (heads +
    bubbles). The controller owns the mode and the current ply; `board-bridge.ts` remains
    the only module importing both chess.js and chessground.

### Files (5B)
```
src/commentary.ts                      NEW  Czech templates + tone rules
src/review.ts                          NEW  replay + situation + text selection (pure)
src/ui/spectators.ts                   NEW  heads + bubbles
src/ui/review-controls.ts              NEW  ⏮ ◀ ▶ ⏭ + keys
src/game-controller.ts                 MOD  mode 'play' | 'review', currentPly, plies[] record, Rozbor wiring
src/ui/move-list.ts                    MOD  current-ply highlight; glyph reads the ply record
src/board-bridge.ts                    MOD  none expected (sync already takes any Chess) — report if touched
src/main.ts                            MOD  markup: spectators, Rozbor button, review controls
src/styles/app.css                     MOD  spectators, bubbles, review controls, desktop + mobile
README.md                              MOD
```

## Commits (in order)
1. `Phase 5: plan`
2. `Phase 5A: animal and colour choice` (manifest, piece-sets.ts, selects, contract, README)
3. `Phase 5B: spectators` (heads only — visible during play, no review yet)
4. `Phase 5B: game review with comic bubbles`
5. `Phase 5: DoD results`
Then the Pages deploy.

## Explicitly NOT in this phase
Piece animations/sounds (P5), victory animation (B9), any new engine use in the review
(no "what if" analysis, no eval bar), PGN/chess.com import or export (B3), sharing the
review, persisting games across reloads, a second animal pair (B1), voice output,
changing thresholds in `feedback.ts`, changing the ladder.

## Commands (PowerShell, one per block)
```powershell
npm run build
```
```powershell
npx vite preview --port 4173 --strictPort --host
```

## Definition of Done (browser, real clicks unless stated)
5A
1. First visit (empty `localStorage`): `Hlavy` / `kůzlata` / `bílá`, light goats at the
   bottom, `farm-busts` stylesheet active — identical to today.
2. `Hraju za` → `žáby` with `bílá`: pieces switch to `farm-busts-inverse` immediately
   (light frogs at the bottom), the game position, move list, status and engine indicator
   are unchanged (checked mid-game after `1.e4 e5`), no `console.error`.
3. `Barva` → `černá` with `žáby`: new game, board flipped, set = `farm-busts` (dark frogs
   at the bottom); with `kůzlata` + `černá` → `farm-busts-inverse` (dark goats at the
   bottom). All four combinations screenshot at desktop size; all four legible on a 360 px
   viewport screenshot.
4. `Figurky` → `Celé figurky`: `Hraju za` disabled and showing the implied animal; → `Klasické`:
   disabled showing `—`; back to `Hlavy`: enabled and restored to the stored animal.
5. Reload restores family and animal (`skm.pieceFamily`, `skm.animal`), colour resets to
   white. A legacy `skm.pieceSetId = "farm"` → family `cele`, key removed. Garbage values
   (`skm.animal = "kachna"`, a 10 kB string, `null`) → defaults, `console.warn`, playable.
6. Promotion dialog (temporary `debugLoadFen`, `4k3/P7/8/8/8/8/8/4K3 w`) shows the pieces of
   the resolved set for `žáby` + `bílá`; hook removed before commit.
7. `farm-busts-inverse` folder renamed away → the family falls back to its first entry
   with a `console.error` from the stylesheet load, board playable; restored.
5B
8. Spectators: the opponent's king sits above the board and the child's king below in both
   orientations and all three families; a set switch changes their appearance; on 360 px
   they do not push the board below the fold (screenshot).
9. `Rozbor` is absent during play and after `Nová hra`; present after mate, stalemate and a
   draw by insufficient material (positions via the temporary hook).
10. Review of a real game (~10 plies, level 1): ⏮ ◀ ▶ ⏭ and arrow keys move through every
    ply; the board shows the correct position at each step (FEN cross-checked against a
    chess.js replay), the last move is highlighted, the glyph badge appears exactly on the
    plies that had one during play, the move list highlights the current ply.
11. Bubbles: every ply produces a bubble from the mover's king; a `??` produces a second
    bubble from the other king; a `?`/`??` bubble with a known `betterSan` names it; the
    final ply's bubble states the result. Texts are Czech with correct diacritics; no
    `innerHTML` anywhere in the new files (`git grep innerHTML -- src/review.ts
    src/commentary.ts src/ui/spectators.ts src/ui/review-controls.ts` empty).
12. Determinism: reopening the same review shows the same texts; two different games with
    a quiet first move get different quiet templates (the pick depends on the ply).
13. Mode safety: during review `Zpět` is disabled and the board is not movable; `Nová hra`
    exits review and starts a fresh game; `Barva` exits review; no analysis `go` line
    appears in the UCI log while in review (temporary logging, removed before commit);
    `Rozbor` pressed twice / ▶ at the end / ◀ at the start are no-ops.
14. With feedback turned off for the whole game, the review still works (situation-only
    comments, no glyphs).
15. Mobile (360 × 740, Chromium device mode): the bubble never overlaps the board; the
    review controls are reachable without scrolling past the board.
16. `npm run build` strict; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty; no
    new dependency in `package.json`.

Wrap-up: preview on 4173 rebuilt and left running, Pages redeployed, DoD table appended
here with deviations listed.
