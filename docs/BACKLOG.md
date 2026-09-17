# Backlog — deferred decisions

Items here are **not** to be implemented until explicitly picked up. They are
recorded so that the design does not accidentally foreclose them.

---

## GATE — stop before anything that needs a server

*2026-09-17: opened once, deliberately, for R10 (a move relay for "play with a friend";
`worker/`, Phase 20). Everything below still applies to every other item.*

This project deliberately has no backend. It is a static site on GitHub Pages:
no database, no accounts, no user data leaving the browser, no hosting cost,
no GDPR surface, no content moderation duty. That is not a limitation to be
engineered around — it is the reason the project stays a hobby rather than an
obligation.

**Before starting any backlog item, check whether it can be done entirely in
the browser.** Browser-local storage (`localStorage`, IndexedDB) and public
CORS-enabled APIs are in scope. A server of any kind is not.

If an item — or part of one — requires a backend, a shared database, user
accounts, authentication, a CORS proxy, or server-side storage of anything:

1. **Stop. Do not design around it and do not build a partial version that
   quietly assumes one later.**
2. Report which specific part needs it and why the browser cannot do it.
3. Propose the largest useful subset that works with no server at all.
4. Wait for my decision.

Many items on this list are *partly* server-free. Splitting them so the
server-free part ships is usually the right answer — but that split is my call,
not an implementation detail.

(B15 below records the reasoning behind this line in more detail.)

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

## B3 — chess.com game import — MERGED into R3 (first, server-free part)

*Kept for the technical notes below; the live item is R3.*

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

## B5 — Goat palette: green belongs to the frogs — MOOT (the full-figure farm pair left the manifest on 2026-09-13; the `Hlavy` library has per-character light/dark variants)

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

## B6 — GPL-3.0 — RESOLVED 2026-09-14: the app is released under GPL-3.0 (`LICENSE`), artwork excluded (`LICENSE-ARTWORK.md`), source repository `jirineoral/zvireci-sachy-app` public, link in the footer
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

## B7 — Two-player mode as a deliberate choice — DONE 2026-09-13 (`Barva` → „dva hráči (bez počítače)“: both colours movable, no engine, no feedback, undo pops one ply, games excluded from `Bilance`; the campaign switches the preference back to random)
Phase 2 gets local two-player play only as the engine-failure fallback. Promoting it to a
real option in the side selector is roughly a select entry plus a branch in
`movableColor()`. Deferred: expected to be used rarely.

## B8 — `history()` cost
`chess.history({verbose:true})` replays the whole game; it is called in `sync()` for
`lastMove` and again in `render()`. Two full replays per move. Invisible in a 40-move
game, potentially not in B3 (chess.com import). Fix when something feels slow: keep the
`Move` object returned by `chess.move()` and pass it into `sync()`.

## B9 — Victory animation (Phase 5 input) — behaviour SHIPPED in Phase 17 as CSS on the spectator kings (jump / slump / nod); the storyboard panels remain content work
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
- Strong opponent levels via `UCI_LimitStrength`/`UCI_Elo` (review item R3 of the
  Phase 2 plan — not the player's R3 below; `UCI_Elo` self-play is also option (a) of R1).

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

## B13 — "Zvířecí šachy": teaching app (one day, maybe) — MERGED into R6

*Kept for the decisions-to-take list below; the live item is R6.*

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

## B14 — User-created piece sets — variant A RESOLVED in the MVP release; whole-sheet upload with in-browser cutting SHIPPED in Phase 18

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

## B16 — Per-set victory cry — RESOLVED in Phase 17 (the character's `sound` opens the win line)

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

## B18 — Win and loss animations under free mix — RULE SHIPPED in Phase 17 (after a win or a loss the opponent's king is not on the screen; `Rozbor` brings it back by the child's choice)

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

---

## Requests from the player (2026-09-13)

These came from the actual user — a child who plays the app daily and dictated
this list unprompted. Treat that as the strongest signal in the whole backlog. His
ordering is preserved in the titles; the suggested build order at the end is the
parent's. **The GATE at the top applies to every item.**

### R1 — Show approximate Elo next to each bot difficulty level — SHIPPED as option (c) in Phase 14 (`Bilance` in `Partie`: own record per level / campaign / opponent; no Elo numbers)
Trivial to display, not trivial to know. After the M5 rework, levels 1–2 play a
weak self-search with randomisation among top-N moves, and nobody has measured
what Elo that actually is. Inventing a number and showing it to a tournament
player is worse than showing nothing — he will notice it is wrong and stop
trusting everything else the app tells him.

Options:
- (a) Measure it: self-play matches against known `UCI_Elo` settings, dozens of
  games per level. Real work, produces a real answer.
- (b) Show honest wide ranges labelled "přibližně".
- (c) **Preferred:** show *his own* win/loss record against each level instead.
  It is true, it computes itself from local game history, and it is more
  interesting to a child than a stranger's rating.

(c) optionally combined with (b). No server: records live in IndexedDB.

### R2 — Puzzles (diagrams) with selectable difficulty — SHIPPED in Phase 10 (3 200 CC0 puzzles in four bands, `Úlohy`)
Best value-to-effort ratio on the whole list.

The Lichess puzzle database is CC0 — roughly 6 million puzzles as CSV, each
with a FEN, the solution moves, a numeric rating and theme tags. Selectable
difficulty therefore comes free with the data, and the licence allows
redistribution without asking.

No database needed: ship a **filtered static subset** (a few thousand puzzles
spanning his rating band) in the repo. Do not ship millions of rows — check the
resulting file size against what is reasonable to serve from Pages, and say
what subset you chose and why.

Infrastructure already exists: board, chess.js, move validation, piece sets.

### R3 — Game database: tournament games, chess.com games, app games, and
eventually live play against real people

Three different things at three very different costs. **Do not treat as one
item.**
- His own chess.com games: public API, no auth, CORS-friendly — **no server**.
  (Merges with the existing B3.) *Shipped in Phase 15: `Chess.com` section in `Partie`.*
- Games played in this app: IndexedDB — **no server**. *(Shipped in Phase 9: auto-saved, listed under `Partie`.)*
- Live play against real people: accounts, matchmaking, a server, moderation,
  GDPR — **this hits the GATE**. Parked, not refused.

The first two must not wait on the third. He explicitly said he does not want
the live-play idea to die quietly — so record it as parked with the reason, not
as rejected.

*Merged from B3 (chess.com import: `api.chess.com/pub/player/{username}/games/archives`,
PGN into chess.js, move-list navigator over existing infrastructure). Live play is the
"above the line" case described in B15.*

### R4 — Analysis view with game replay — SHIPPED in Phase 9 (saved games, PGN paste, whole-game analysis, eval bar, best-move arrow)
Build this **first** despite not being his top priority: it is the shared
infrastructure that R3 and R7 both need, and it has standalone value. Fully
client-side. Overlaps the existing analysis/comic-bubble notes — merge.

*Merged notes: the Phase 5B review already replays a finished game ply by ply with the
kings' comic bubbles (`src/review.ts`, `src/commentary.ts`) and the per-ply feedback
records `{glyph, betterSan}`; R4 generalises it to any game (loaded PGN, app history,
R3 sources) with an eval/analysis view. B18 (the loser must not watch the winning
animal) and B9/B16 (win/loss animations, victory cry) stay separate but constrain how
the review presents a lost game.*

### R5 — Endgame training (given a position, win it or hold the draw) — SHIPPED in Phase 13 (`Koncovky`, 17 engine-checked positions, trainer strength, `skm.endgames`)
Cheaper than it looks. A list of FENs, the existing engine as the opponent, and
a goal check on the result (win required / draw sufficient). Roughly a day. No
server.

### R6 — Lessons, graded: absolute beginner → beginner → lightly advanced →
intermediate → advanced → expert → master
This is B13; merge. The most expensive item on the list and the one where a
mistake teaches many children something wrong. The work is content, not code,
and any generated instruction needs review by someone who actually plays before
it ships. Parked pending feedback from real users.

*Merged from B13: Czech-language, AI-assisted lessons as the differentiator; decisions
to take first — GPL (B6), artwork licensing, and human review of any generated
instruction — remain listed under B13.*

### R7 — Follow live games from real tournaments — SHIPPED (Lichess part) in Phase 16 (`Turnaje`: search → rounds → games → review); chess-results.com stays parked (GATE: needs a proxy)
He linked a chess-results.com tournament page.

chess-results.com has no public API and serves ASPX pages; a browser on our
origin cannot fetch it because of CORS. Making this work needs a proxy, i.e. a
server — **this hits the GATE**.

The realistic alternative is the **Lichess Broadcast API**, which is public and
CORS-friendly, but only carries events somebody chooses to broadcast there —
which will usually not include his regional tournaments. Investigate whether
that is true before assuming; if it is, this item is honestly limited and I
will tell him so rather than leaving it open.

### Suggested build order (mine, not his)
R4 → R2 → R5 → R1 → the two server-free parts of R3 → R6 → R7.

## B19 — Only-move positions in the live feedback — DONE in Phase 14 (forced human move: no analysis A / no glyph; forced reply: analysis B after the reply)

Stockfish answers a position with exactly one legal move immediately, with a depth-1
score. The whole-game analysis (Phase 9) compensates by taking the next position's eval;
the live feedback's analysis A does not, so a human move made from a forced position can
get a glyph based on a shallow "before" eval. Cheap fix: when the human has one legal
move, skip analysis A and treat the move as best. Recorded, not done.

### R8 — Campaign: beat every animal — SHIPPED in Phase 11 (`Kampaň`, 18 opponents, interpolated ladder, reorder/skip/reset, `skm.campaign`)

Requested by the player. Cheapest item on the list and the highest impact:
no new data, no new artwork, no new engine work.

**Why it matters beyond being fun:** it removes the difficulty-selection
problem entirely. The player never picks a number — they just move to the next
opponent and the strength rises with them. That works for a beginner and for an
adult alike, which is exactly what the ladder has never managed on its own.

**Design decisions to take before building:**
- **Order.** "Sorted by intelligence" is the requested framing, but 19 animals
  against 6 difficulty levels means either several animals share a level or the
  ladder gets finer. Finer is better anyway — 19 steps give a campaign a curve,
  6 give it a staircase. And ranking an ant against an octopus is a joke, not a
  fact: **let the player order the animals himself.** He will enjoy doing it
  more than we would enjoy deciding it.
- **Losing costs nothing.** No penalty, no lost progress, just "zkus to znovu".
  A campaign that sends a child backwards is a campaign a child stops playing.
  Allow skipping an opponent after a few losses so nobody is stuck forever.
- **Visible progress.** A grid of all the animals: defeated in colour,
  undefeated greyed out, the next one highlighted. This is the cheapest reward
  mechanism that exists and it is what makes a child want the rest of the set.

**Implementation:** no new system. The campaign is an ordering in `sets.json`
plus a set of "defeated" records in IndexedDB. Fully client-side, no GATE
issue.

**Fits with phase 8:** the victory animation is exactly the moment an animal
gets unlocked.

*(The parent's note: beating "člověk" will not be much of a challenge. Queued after R2.)*

### R9 — Piece-drop animation at the start of every game — SHIPPED in Phase 12 (`Hrát!` drops chessground's piece elements, announcement, skip, setting `Nástup figurek`)

Requested by the player. Reuses the phase 8 intro animation, but driven by the
two animals the player actually chose instead of random ones: pick frog and
goat, those drop in; pick chicken and worm, those do.

**Prerequisite:** phase 8's composition layer must be reusable, not baked into
the intro. If it was written as intro-only, extracting it is the first step and
should be reported as such.

**Constraints that decide whether this is delightful or annoying:**
- **Shorter than the intro.** The intro plays once per session; this plays
  every new game. Target around one second, and **any click skips it
  instantly**. At 2.5 s it becomes something to sit through by the fifth game.
- **Pieces land in the actual starting position** — pawns on ranks 2 and 7,
  pieces on 1 and 8 — not scattered as in the intro. The animation then flows
  into a playable board instead of cutting to one.
- **It must end exactly where the real board is.** Animate the chessground
  piece elements themselves rather than an overlay, or the pieces will land and
  then jump into place.
- **It must not delay the first move.** When the human plays black the engine
  opens; it must not move until the animation finishes, or its move appears
  through falling pieces.
- A setting to disable it, alongside the intro setting.

**Free bonus:** this is the natural place for an opponent announcement —
"ŽÁBA vs. SLEPICE" over the animation. In the campaign (R8) it carries more:
"soupeř 7 z 19".

*Status note (2026-09-13): the phase 8 intro is intro-only — the landing keyframes and
spots live in `src/intro/` and target an overlay over the plate image, not chessground's
piece elements. R9 therefore starts with extracting a reusable "drop" animation that runs
on the real `.cg-wrap piece` elements (chessground positions them with `transform`, so the
drop must compose with that) and the engine's opening move must wait for it (the Phase 8
pre-game `started` flag is the natural hook). Queued after R2 and R8.*

## Pilot feedback (2026-09-14, company Slack — first hours after the teaser)

Recorded verbatim in substance, without names. Items marked **P** are actionable.

- **P1 DONE 2026-09-14 (legend + hint; wasps regenerated with large markers) — Piece roles are hard to tell apart on some characters** (played vosy vs. žraloci:
  "žraloci lepší, ve vosách jsem se ztrácel"; another player mistook the mouse knight for a
  bishop and lost puzzle time). Two separate causes: (a) some sheets have weak markers —
  vosy are the first candidate for regeneration, the mouse helmet/mitre are close in
  silhouette; (b) nobody knows the markers up front. Fix (b) cheaply: a one-line legend
  under the board or in the intro ("věž = hrad na hlavě, jezdec = helma s chocholem,
  střelec = mitra, dáma = koruna, král = koruna s křížem + žezlo"), and a `Klasické`
  hint in the settings ("nepoznáš figurky? přepni Figurky na Klasické"). Fix (a): a
  40 px readability pass per character on the contact sheets; regenerate the worst.
- **P2 DONE 2026-09-14 (`7 · Velmistr`: skill 20, depth 14, 1.5 s) — The strongest level was "rozsekaný" by an adult.** Expected: level 6 is skill 6 /
  depth 6. Add a seventh level `Velmistr` (skill 20, depth 12+) for adults and strong
  juniors; keep the ladder for children unchanged. Also relevant to the campaign's final
  boss.
- **P3 DONE 2026-09-14, in production (feedback OFF by default, `Tahy zpět` 0 / 3× (default) / bez omezení, counter on the button) — "Alert, že figura někoho ohrožuje" felt like a crutch** for a core skill; the
  player would rather have a limited undo (a few per game, growing cooldown). The move
  feedback *is* switchable (`Hodnocení tahů: vypnuto`) — it was not discovered. Fix:
  say so in the intro/settings; consider a "trénink" preset (feedback off, undo limited
  to N per game) as one switch rather than two.
- **P4 — Company-branded set requested (own faces).** Answer given: the whole-sheet
  upload (Phase 18) does it per user; a shared branded set would need consent from each
  person — not for the public library.
- **P5 DONE 2026-09-17 (Phase 19: trays beside the spectator kings + `+N` for the
  leading side) — Captured pieces / material balance** (form, 2026-09-14: "nemám přehled,
  kolik a jaké figurky mi soupeř vyhodil a vice versa; na chess.com vidím, že vedu +3").
- Positive: "super iniciativa, předávám synátorovi", "super roztomilé". People used the
  Slack thread, not the form — remind them of the form once (done in the thread).

## Analytics — Cloudflare Web Analytics (DONE 2026-09-17)

DNS for `zvirecisachy.cz` is on Cloudflare (Free, DNS only — GitHub Pages still
terminates TLS); the public build carries the Web Analytics beacon (`--mode pages`).
Daily page views / visits, no cookies, no visitor id; the redirect domain
`zvireci-sachy.cz` stays on Forpsi (it only 301s). See `docs/security-review.md`.

## O1 — Cloudflare Rate Limiting rule for `hra.zvirecisachy.cz` — DONE 2026-09-17 (via the zone rulesets API: block 10 s after 30 requests / 10 s per IP; a game's handful of upgrades passes, a 40-request burst is cut)

The relay's only mitigation for the Workers Free ceiling (100 000 requests/day for the
whole account): one zone rule (Free plan allows one) — *Security → WAF → Rate limiting
rules → Create*: hostname equals `hra.zvirecisachy.cz`, 30 requests / 10 s per IP → Block
for 10 s. Left open on 2026-09-17 because the Cloudflare dashboard tab kept freezing in
the automation; a two-minute click for the owner. Reviewer's note: "the one I would do
the same day".

## Feedback triage (2026-09-17)

The form's responses are linked to a Google Sheet (owner's Drive, not in the repo). Two
columns were added after the form's own: `Stav` (empty = new, `backlog`, `hotovo`,
`odpovězeno`) and `Odkaz` (the P/R item and what was done). Triage = read only the rows
with an empty `Stav`, record the item here, fill both columns. The form's `Individual`
tab shows one respondent at a time when the row is not enough.

## Principle — play without an account, always (2026-09-14)

Anonymous play is the baseline and stays. An account (a sync code or a sign-in) is an
optional add-on whose only job is carrying what already lives in IndexedDB (games,
campaign, endgames, record) between devices. Nothing in the app may require it.
The owner's reason, worth keeping in mind for every later design: a child must be able
to play safely in an after-school club, a café or on a shared PC without typing any
credentials anywhere — no account means nothing to leak. A sync code, if it comes, must
be treated the same way (never required, nothing behind it a stranger could misuse).

## R10 — Play with a friend (link over WhatsApp/SMS)

Wanted: send a link, the friend opens it, the two boards are paired (TeamViewer-style).
Technically this is a **WebRTC DataChannel** — moves go browser-to-browser, no server
sees the game. The catch is the introduction: the two browsers must exchange a few
hundred bytes each way (SDP offer/answer, ICE) before they can talk.

- **Variant A — no server at all:** the link carries the offer (~1–2 kB, still fits a
  message); the friend's app produces an *answer code* that has to be sent back as a
  second message; then they connect. Works, but a two-step exchange a parent can do and
  a ten-year-old cannot; and ~15–20 % of home/mobile networks (symmetric NAT) cannot
  connect directly without a TURN relay. Fine for two children on one Wi-Fi.
- **Variant B — a one-click link (GATE):** a minimal signalling service holds the offer
  for a minute and hands the answer back — one Azure Function + a table with TTL, no
  accounts, no personal data (the payload is a connection description), the game itself
  stays P2P. This is the smallest possible first server component and arguably a better
  first one than sync: the child gets more out of it.

**GATE opened by the owner on 2026-09-17 for variant B** — as a WebSocket relay (a
Cloudflare Worker + one Durable Object per game; free at our scale, works on every
network) rather than P2P + signalling. **SHIPPED in Phase 20** (2026-09-17: `Kamarád`,
`#hra=` links, relay at `hra.zvirecisachy.cz`; three-round colleague review, see
`docs/security-review.md`). Plan and DoD: `docs/phase-20-plan.md`.

## R11 — Social media presence (owner, 2026-09-14)

"Bude potřeba podchytit sociální sítě — Facebook a Instagram, nebo co to dnes ty mláďata
používají." Parked as a task, not a feature. Notes for when it starts:
- The audience is split: **parents and coaches** are on Facebook (Czech chess groups,
  school-parent groups, ŠSČR club pages) — that is where a children's app gets shared;
  the **children themselves** (10–15) are on YouTube, TikTok and Instagram Reels, where a
  15-second clip of the piece drop / a king's tantrum works better than any text.
- Cheap first step: an Instagram + Facebook page with the splash image, the teaser
  text and short screen recordings (campaign, endgame, "člověk" as the final boss).
- The app side needs only **share-friendly metadata**: `og:title`, `og:description`,
  `og:image` (the splash), `twitter:card`, so a pasted link shows a picture instead of
  bare text — and a small "Sdílet" button (Web Share API on phones, copy link elsewhere).
  Both are a one-hour change; the metadata can be done before any account exists.
- Nothing here touches the GATE or the no-account principle.
- **Why now (owner):** marketing, and to claim the name before someone else does —
  register the handles (`zvirecisachy` / `zvireci.sachy`) on Facebook, Instagram, TikTok,
  YouTube and X even before posting anything; a taken handle is the cheapest thing to
  lose and the hardest to get back.

### R11 quick step — link previews and one sentence about links — DONE 2026-09-17 (`og:*` + `twitter:card` in `index.html`, `public/og.jpg` 1200×630 cut from the splash with the site name, the sentence in the friend bar's waiting state)
`og:title`, `og:description`, `og:image` (a board with animals) in `index.html` so a
shared `#hra=` link previews as Zvířecí šachy in WhatsApp/SMS/Messenger, and the line
"odkaz posílej jen tomu, s kým chceš hrát — kdo ho má, může si sednout ke stolu" in the
friend bar's waiting state. Analysis: `docs/security-review.md`, 2026-09-17.

## R12 — Native apps (Android, iOS) — long road, decision pending

Owner (2026-09-14): counted on, but far off; pros and cons to be weighed, above all the
legal frame. Notes to make that weighing cheaper when it comes:
- **Two cheap steps first, no store involved:** (1) **PWA** — manifest + service worker
  makes the site installable on both platforms (home-screen icon, full screen, offline
  engine and pieces). Nothing changes legally, nothing is submitted anywhere. (2) If a
  store listing is wanted, a **wrapper** (Capacitor / TWA for Android) ships the same
  web app — one codebase, the web stays the source of truth.
- **The legal frame is the real cost, not the code:** both stores treat an app aimed at
  children as a special category — Google Play "Designed for Families" and Apple's
  Kids Category require a published privacy policy, age-appropriate content rating,
  no third-party analytics/ads SDKs (which our no-account, nothing-sent design already
  satisfies), and a developer account with identity verification (Apple: 99 USD/year,
  Google: one-off 25 USD; a DUNS/organisation may be needed for some listings). GDPR-K /
  the Czech 15-year consent line apply the moment the app stores anything about a child
  server-side — today it stores nothing.
- **GPL and the App Store:** Apple's terms conflict with GPL-3.0 for store-distributed
  binaries (the FSF's view; VLC was pulled over it). Either keep the chessground/Stockfish
  boundary and get a licence exception, replace chessground (B6 variant B), or ship iOS as
  a PWA only. Android/Play has no such conflict.
- Parental controls (Family Link, Screen Time) interact with store apps — age gates,
  purchase/consent prompts, allowed-app lists; a PWA sits outside them, a store app inside.
  Another reason the store step is a decision, not a default.
- **Order decided by the owner:** polish the web version first; mobile only after.
- The web app must stay first-class regardless (the no-account, shared-PC principle).
