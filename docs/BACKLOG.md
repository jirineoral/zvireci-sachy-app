# Backlog — deferred decisions

Items here are **not** to be implemented until explicitly picked up. They are
recorded so that the design does not accidentally foreclose them.

---

## B1 — Animal library (multiple piece-set pairs) — RESOLVED in Phase 6 (character library, 19 characters, any vs. any)

### Idea
Beyond goats vs. frogs, offer further animal pairs: pigs, dogs, cats, donkeys,
cows, mice. The player picks a pair at the start of a game.

### Status
**Deferred. Do not build.** Phase 3's set mechanism already supports this: a new
pair is a copied folder plus one `sets.json` entry, zero code changes. Build it
only when the actual user (the child) asks for another set — building it
speculatively risks building something nobody wants.

### Design decision taken now (so phase 3 doesn't foreclose it)
Model a set as a **fixed pair**, not as two independently chosen sides.

Rejected alternative — free mix (any animal vs. any animal): animals are not
drawn on a neutral palette. Cream goats vs. a white cow would be visually
indistinguishable, and the board palette is tuned per pair. Free mix would
require every animal in both a light and a dark variant (24 SVGs per animal
instead of 12), or runtime contrast validation that tells the player no.
Fixed pairs keep every combination deliberately art-directed.

Consequence for `sets.json`: each entry carries a `"pair"` field naming the
pairing (e.g. `"pair": "kuzlata-zabky"`) purely as documentation of intent.
It is not read by any code today.

### Prerequisite for any future pair
Style consistency across DALL-E generations is the real cost here, not code.
Before generating a new pair, read `public/piece-sets/PROMPTS.md`, reuse the
**verbatim** prompt text that produced the existing sheets with only the animal
and palette swapped, and attach the existing sheets as style references.
A pair generated from a freshly-written prompt will not match.

---

## B2 — PROMPTS.md — RESOLVED in the MVP release (`docs/PROMPTS.md`, shipped by "Zkopírovat prompt")

Record the exact DALL-E prompts that produced the goat and frog character
sheets, and the splash screen, in `public/piece-sets/PROMPTS.md`. Needed before
B1 is viable. Cheap to do, do it whenever. (The exact per-animal wording of the
Phase 6 sheets was not archived; PROMPTS.md carries the cumulative prompt.)

---

## B3 — chess.com game import

Replay the boy's own tournament games in his own piece set. The chess.com public
API needs no auth: `api.chess.com/pub/player/{username}/games/archives` returns
monthly archive URLs, each containing games with PGN. chess.js loads PGN
directly, so this is a move-list navigator over existing infrastructure.

Deferred until phases 1–6 are done. Likely the highest-value feature in the
whole project — playing yet another chess app is replaceable, replaying *your
own* Saturday tournament game with your own frogs is not.

Phase 1 consequence: none required — the move list renders purely from
`chess.history()`, so a navigator can later drive it from a loaded PGN.

---

## B4 — Bishop artwork mismatch

**RESOLVED 2026-09-12.** Goat bishop regenerated with a mitre; both sides now
mirror each other (mitre + bow). No further action.

---

## B5 — Goat palette: green belongs to the frogs

**OPEN — higher priority after the B4 regeneration.** The goat sheet now carries
green on the bishop's cape, the queen's and king's cloaks, and the king's crown
velvet. The frog king's crown is also green with gold, so at 64px the two kings
share their most prominent visual feature.

Fix: regenerate the goat sheet replacing every green element with deep brown /
burgundy, keeping cream bodies, gold accents and sand bases. Green becomes
exclusive to the frog side.

Verification: render both sheets side by side at ~64px height and identify each
piece, including telling the two kings apart, without hesitation.

Do this before phase 4 ships the artwork. The splash screen does not need
changing.

Consequence for Phase 3 design: the goat side wants a cream/brown/burgundy board,
the frog side a green one → the piece-set manifest must carry `--board-light` /
`--board-dark` values, which is why Phase 1 already exposes them on `.cg-wrap`.

---

## B6 — GPL-3.0 (OPEN — publication made it live, 2026-09-13)
Stockfish.js is GPL-3.0 and the site has been public on GitHub Pages since 2026-09-12.
Done (security review, C6): the GPL text ships next to the engine files
(`engine/LICENSE-GPL-3.0.txt`), attribution with upstream links is in the README and in
the site footer.

Unresolved: whether the GPL propagates to the app's own code. The argument that it does
not for the engine: Stockfish runs in a separate Web Worker and the app talks to it only
by UCI text over `postMessage` — a separate program, not a linked library. That is a
defensible position, not a settled one. Note that the **board library is the stronger
case**: `@lichess-org/chessground` is GPL-3.0-or-later and is bundled *into* the app's
JavaScript, which is ordinary linking. The Pages README currently states that the app is
GPL-3.0 "as a consequence of its dependencies" — that sentence is a statement of intent,
not a legal finding. For a non-commercial project the cheapest resolution is to release
the app under GPL-3.0 explicitly (a LICENSE file in the source repo); nobody has decided
that yet. No legal opinion is sought here; record only.

## B7 — Two-player mode as a deliberate choice
Phase 2 gets local two-player play only as the engine-failure fallback. Promoting it to a
real option in the side selector is roughly a select entry plus a branch in
`movableColor()`. Deferred: expected to be used rarely.

## B8 — `history()` cost
`chess.history({verbose:true})` replays the whole game; it is called in `sync()` for
`lastMove` and again in `render()`. Two full replays per move. Invisible in a 40-move
game, potentially not in B3 (chess.com import). Fix when something feels slow: keep the
`Move` object returned by `chess.move()` and pass it into `sync()`.

## B9 — Victory animation (Phase 5 input)
A storyboard exists for both sides (goat headbutt / frog tongue), 6 panels, ~2.5 s each,
produced as a single reference image.

Design corrections required before this is built:
1. **Win and loss must not be the same animation mirrored.** The player plays one side;
   showing him a 2.5 s celebration of his opponent after a loss is the wrong response.
   Win = the current storyboard. Loss = short, quiet, no gloating: the defeated king sits
   down and removes his crown. Different tone, not a different animal.
2. **Skippable on any click, and shorter.** Panels 4 and 5 (crown flying, crown landing)
   are filler; four panels is enough. Target ~1.5 s.
3. Draw only after the piece artwork is final (B5), so the style matches.

Implementation approach (decided): do NOT attempt frame-by-frame animation. Render the
storyboard panels as a **cross-faded sequence of static images with a slow zoom
(Ken Burns)**, plus sound. The existing panels are usable as final assets. Roughly 1–2 h
versus 4–8 h for hand-animated SVG, and visually close to what the storyboard promises.

Open question: whether the frog-tongue and goat-headbutt panels can be regenerated
individually in a matching style, or whether the single sheet must be cut up. Cutting up
the existing sheet is the safe option.

---

## Later-phase candidates recorded from the Phase 2 review
- Undo as black at move 1: disable the button when the resulting position would be the
  engine's turn at ply 0 (R6).
- Promotion dialog: keep the pawn on the destination square while choosing, as Lichess
  does (R5).
- Strong opponent levels via `UCI_LimitStrength`/`UCI_Elo` (R3).

---

## B10 — engine failure detection (RESOLVED in Phase 3)
A missing or corrupt `.wasm` does not raise the worker's `onerror`; before Phase 3 the
fallback was reached only via the 10 s handshake timeout. Phase 3 added a HEAD pre-check
(status, `text/html` SPA-fallback answers, `content-length` ±5 % of the expected size)
before the worker is created, and raised the handshake timeout to 30 s for slow but
legitimate loads. Right-sized corrupt files still fall through to the 30 s timeout —
accepted.

## B11 — vendor the two engine files
`npm i stockfish` installs ~250 MB to ship 7 MB (`stockfish-18-lite-single.js` +
`.wasm`). Before Phase 6 (PWA), consider committing the two files into the repo, dropping
the `stockfish` dependency and the `postinstall` copy step, and keeping the licence text
alongside them (GPL-3.0 — see B6). Record only; nothing in the build changes until then.
Note `ENGINE_WASM_BYTES` in `src/main.ts` must track the vendored file.

## B12 — bounded re-cancel loop (RESOLVED in Phase 3)
`beginTransition()` re-cancels at most twice; on the third attempt it logs
`console.error` and breaks out instead of hanging.

## B13 — "Zvířecí šachy": teaching app (one day, maybe)

Not scope. Not a commitment. Recorded so that today's decisions don't
foreclose it.

The idea: the animal-set gamification plus Czech-language, AI-assisted chess
lessons for children. Non-commercial. The differentiator would be Czech, not
the animals — English chess tutorials for kids are abundant, Czech ones are
not. The animals are why a child stays; the lessons are what it's for.

**Infrastructure this would need, already being built for other reasons:**
move feedback (?? ? ?! !? ! !!), the game replay component (B9/B3), swappable
piece sets, the difficulty ladder.

**Decisions to take before it becomes real — cheap now, expensive later:**
- GPL-3.0. Stockfish is GPL; a widely-shared app makes the propagation
  question live rather than academic. Either keep `engine.ts` behind a narrow
  enough interface that the engine is replaceable, or simply release the whole
  app as GPL-3.0 — costs nothing for a non-commercial project. (See B6: the
  bundled chessground raises the same question independently of the engine.)
- Artwork licensing. Check the image generator's terms for public
  distribution before drawing many more animal sets. The provider's terms, not
  copyright, are the relevant constraint.
- Content accuracy. AI-generated chess lessons are a domain where a mistake
  teaches many children the wrong thing at once. Any lesson content needs a
  human review step by someone who actually plays. Do not ship generated
  instruction unreviewed.

## B14 — User-created piece sets — variant A RESOLVED in the MVP release

Variant A (twelve ready-made images, IndexedDB, delete, prompt button) shipped. Variant B
(cutting twelve pieces out of one uploaded character sheet) is explicitly not planned:
Phase 3/6 showed it needs hand-set cuts, pocket verdicts and per-piece nudges.

Ideas noted while building A, not done: drag-and-drop onto the slots; a "download this set
as a zip" export so a set can move between devices without a server (stays below the B15
line); a per-set board palette; splitting one uploaded 6-piece row into six files with a
simple equal-width cut (a light version of B that would work for the prompt's output).

## B15 — The client-side / server-side boundary

A deliberate architectural line for this project: **anything that runs in the
user's browser is cheap; anything that needs a server is a different project.**

**Below the line (stays free, stays on GitHub Pages, no accounts, no GDPR
surface):**
- `localStorage` for settings — already in use.
- **IndexedDB for user-created piece sets (B14).** This is *not* a server
  database: it is browser-local storage that handles binary blobs, the same
  category as `localStorage`. No backend, no hosting cost, no data reaching me.
  Limitation to state plainly in the UI: a set lives in one browser on one
  device and is lost if the user clears site data.
- Game history within a session, replay, lessons, move feedback — all local.

**Above the line (a different project, not a feature):**
Accounts, leaderboards, cross-device sync, persistent game history, sharing
sets between users. Each pulls in the next: database → hosting → cost →
monetisation → auth → security → GDPR. And in a children's app with
user-uploaded images, content moderation — which is not something to take on
as a hobby.

Not ruled out forever, but it stops being "click a link and play" and becomes a
Czech alternative to chess.com. That is a decision to take deliberately, not to
arrive at by adding one more feature.

## B16 — Per-set victory cry (placeholder)

Referenced by B18 (`victoryCry` per set, played on a win only). Not specified yet.

## B17 — Free animal mix (supersedes the "fixed pair" decision in B1)

**B1's fixed-pair decision is withdrawn.** The child picks their own animal and
their opponent's animal independently — "I play the cat, against the mouse".
That choice is the child's, not a skin selection, and it is a large part of the
appeal. Chicken vs. worm is a feature, not a bug.

**Why the original objection no longer applies.** B1 rejected free mix because
a grey cat against a grey mouse is unreadable. That is solved by every animal
existing in a **light and a dark variant**: the child picks two animals, and
the app assigns one the light variant and one the dark. 19 animals × 2 variants
= 38 sheets, not 361 pairings.

**Requirements:**
- The same animal must be selectable on both sides (cat vs. cat). Children will
  try this immediately; two variants make it work for free.
- Each variant carries a numeric lightness value in `sets.json`. On selection,
  check the two chosen variants differ enough; if not, **offer to swap** ("try
  the dark chicken") rather than refusing the combination.
- Manifest model changes from "set = a pair" to "set = one animal in two
  variants". `farm-busts` stops being a goat+frog pair and becomes two
  independent animals, goat and frog — cleaner, but it is a rebuild.

*Status note (2026-09-13, Phase 6 shipped the same day this entry was written):*
the free mix, the same animal on both sides and the "one animal = light + dark
variant" manifest are implemented (`public/piece-sets/animals/animals.json`,
`docs/phase-6-plan.md`). The variant is assigned by colour — white side always
light, black side always dark — so a chosen pair is readable by construction and
no lightness value or swap offer exists yet. That requirement becomes relevant
only if the child may pick *which* variant plays which colour; open until decided.

## B18 — Win and loss animations under free mix

**Loss shows nothing about the opponent at all.** Not a milder version, not a
restrained version — the winning animal does not appear. Show the child's own
king sitting down and removing his crown, then offer "play again". A child who
has just lost should not watch the other animal in any form. A chicken being
strangled by a worm is exactly the outcome to design out.

**This also removes the combinatorics.** The victory animation shows only the
winner; the loss animation shows only the loser. Neither needs to know the
other animal, so it is 19 animations and not 361. The per-set `victoryCry`
(B16) plays on a win only — never the opponent's on a loss.

*Note (2026-09-13):* the Phase 5B review already shows both kings and lets the
mated king speak ("Prohrál jsem…"); B18's rule — after a loss the opponent's
animal does not appear — will need the review's spectators and reactions to be
revisited when B18 is implemented (e.g. hide the winner's bubbles on a loss, or
gate the review behind the "play again" screen).
