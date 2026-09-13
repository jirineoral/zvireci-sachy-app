# Phase 11 — Campaign: beat every animal (R8) (plan, rev. 1)

Requested by the player. No new data or artwork; the character library, the ladder and
the game record already exist. Everything stays in the browser (`localStorage`), so the
GATE is not touched.

## Decisions (veto in review)
1. **One campaign = the library's characters minus the player's own**, in an order the
   player controls. The default order is a joke "by intelligence": žížaly → mouchy →
   mravenci → vosy → slepice → pštrosi → myšky → žáby → kůzlata → oslíci → kravky → lamy →
   tučňáci → hadi → žraloci → kočky → jezevčíci → šavlozubé veverky → **člověk** (final
   boss). ▲/▼ buttons on every tile reorder; the order is persisted.
2. **Strength = the ladder interpolated over the campaign.** Step `i` of `n` opponents
   plays at `x = 1 + 5·i/(n−1)` on the existing 1–6 ladder, linearly interpolating skill,
   depth, movetime, `topMoves` and `topWindowCp` between the two neighbouring levels
   (`interpolateDifficulty(x)` in `difficulty.ts`). 18 steps give a curve instead of a
   staircase; the table in `difficulty.ts` stays the single place that defines strength.
   The difficulty select is disabled while the campaign runs and shows the level the step
   is closest to.
3. **Losing costs nothing.** A win marks the opponent defeated; any other result counts
   one attempt. After **3 failed attempts** a `Přeskočit` button appears; a skipped
   opponent is passed (grey with a ⤼ mark) and can be replayed later from the grid.
   `Začít znovu` (with confirm) clears progress but keeps the order.
4. **Campaign mode** lives in `main.ts` (view/wiring), not in the controller: the manager
   gets `forceOpponent(id | null)` (not persisted) and the controller gets
   `setDifficultyOverride(d | null)`. `Hrát: <soupeř>` in the dialog = force + override +
   `newGame()` + `startPlaying()`. While the campaign is active `Nová hra` is a rematch
   against the current campaign opponent (or the next one after a win); the `Soupeř` and
   `Obtížnost` selects are disabled; changing `Hraju za` keeps the campaign (progress is
   keyed by opponent id) and recomputes the next opponent. `Ukončit kampaň` restores the
   normal preferences. Loading a saved game, puzzles and the review do not touch the
   campaign; their records are ignored (`source !== 'app'` or not the campaign opponent).
5. **UI:** `Kampaň` button in the button row → `<dialog class="campaign-dialog">` with a
   grid of the opponents (king image of the light variant; defeated in colour with ✓, next
   highlighted, the rest greyscale), `Hrát: hadi (7/18)`, `Přeskočit` (when allowed),
   `Ukončit kampaň`, `Začít znovu`, `Zavřít`. Under the matchup line a `.campaign-bar`
   shows `Kampaň 7/18 · soupeř hadi` with `Další: kočky` after a win and `Kampaň…`.
   The game-over bubble stays the review's.
6. **Persistence:** `localStorage['skm.campaign']` = `{ order, defeated, skipped, losses }`,
   validated on read (unknown ids dropped, missing ids appended in default order, numbers
   clamped). Whether the campaign is *active* is session state (not stored): after a
   reload the player opens `Kampaň` and presses `Hrát` again.

## Files
```
src/campaign.ts             NEW  state, default order, persistence, next/skip/reorder, step → x
src/difficulty.ts           MOD  interpolateDifficulty(x)
src/game-controller.ts      MOD  setDifficultyOverride, currentDifficulty()
src/piece-sets.ts           MOD  forceOpponent, characterImage
src/ui/controls.ts          MOD  difficultyLocked state
src/ui/campaign-dialog.ts   NEW
src/main.ts, src/styles/app.css  MOD  button, bar, wiring, win/loss detection
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. `Kampaň` → grid of 18 opponents in the default order (player's own character absent),
   first highlighted, all grey; `Hrát: žížaly (1/18)` starts a game against žížaly at the
   step's strength (engine options logged: skill 0, depth 1, MultiPV 8).
2. Winning marks žížaly defeated (in colour, ✓), the bar offers `Další: mouchy`, `Nová hra`
   plays mouchy; the middle step (9/18) plays with interpolated values (between levels
   3 and 4), the last step (člověk) with level 6's values.
3. A loss/draw increments the attempt counter, nothing else changes; after 3 attempts
   `Přeskočit` appears and moves on; the skipped tile is marked and replayable.
4. ▲/▼ reorder persists across reloads; `Začít znovu` asks and clears progress only.
5. Changing `Hraju za` to the current opponent's character skips over it to the next one
   and the step count drops to 17 while that character is selected.
6. `Ukončit kampaň` re-enables the selects, the next `Nová hra` uses the stored
   preferences; a puzzle or a loaded game during the campaign does not change progress.
7. Garbage in `skm.campaign` → defaults; a 375 px viewport shows the grid without
   horizontal scroll.
8. `npm run build`; no debug code; security checklist (ids validated against the
   library; images by constructed same-origin URL; text via `textContent`).

## DoD results (executed 2026-09-13)

Tested on the Vite dev server (in-app pane) with temporary hooks (`debugLoadFen`,
`debugHumanMove`, a UCI command log in `engine.ts`) — removed; grep empty.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Grid + first step | PASS | 18 tiles in the default order, kůzlata (the player) absent, žížaly highlighted; `Hrát: žížaly (1/18)` → UCI `Skill Level 0`, `MultiPV 8`, `go depth 1 movetime 300`; opponent/difficulty selects locked, bar `Kampaň 1/18 · soupeř žížaly` |
| 2 | Win → next | PASS | Fool's-mate position, `Qh4#` as black → `defeated: ["zizaly"]`, bar offers `Další: mouchy`, the finished board keeps žížaly; `Nová hra` → mouchy on the board (`skm-white-mouchy`), `Kampaň 2/18`. Interpolation checked in node: 9/18 → skill 0 / depth 2 / 435 ms (between levels 3 and 4), 17/18 → skill 5 / depth 5 / 912 ms, 18/18 = level 6 exactly |
| 3 | Loss / skip | PASS | Three stalemates → `pokusů: 3`, `Přeskočit` appeared; skip → tile dashed with ⤼, `Hrát: mravenci (3/18)`, bar `Další: mravenci` |
| 4 | Reorder / reset | PASS | ▲ on vosy and ▼ on žížaly reorder the tiles and `skm.campaign.order`; the bar's step number follows; order survives a reload; `Začít znovu` (confirm) clears defeated/skipped/losses only |
| 5 | Own character = opponent | PASS with a corrected expectation | Playing vosy while `Hraju za` → vosy: the campaign moved to mravenci (`Ty: vosy · Soupeř: mravenci`). The total stays **18**, not 17 as the plan said — one character is always excluded, whichever it is |
| 6 | Leave / puzzle | PASS | A puzzle during the campaign left `skm.campaign` untouched and `Zpět do hry` returned to the campaign opponent; `Ukončit kampaň` re-enabled both selects (difficulty back to the stored 3, opponent `náhodně`), bar hidden |
| 7 | Garbage / mobile | PASS | `{"order":["drak",5,"clovek","clovek"],"defeated":"x","skipped":["had","nope"],"losses":{"had":"3","kocky":-2,"mysky":2.7}}` → order člověk + defaults, defeated [], skipped [had], losses {mysky: 2}. 375 px: dialog 337 px wide, two columns, no horizontal scroll |
| 8 | Build / debug / security | PASS | `tsc` strict clean (167 kB JS); grep empty; checklist run recorded in `docs/security-review.md` |

Deviations: (a) DoD 5's "17" was a wrong expectation, see above; (b) a sequencing bug
surfaced and was fixed on the way: `setDifficultyOverride` followed at once by
`newGame()` lost its option reload (the second transition superseded the first) — the
controller now marks the loaded options `stale` and reloads them at the next idle point
(`ensurePlayOptions`), which also covers the plain difficulty select; (c) `Nová hra`
during the campaign lands in the pre-game state (`Hrát!`) like any new game — only the
bar's `Další: …` button starts at once.
