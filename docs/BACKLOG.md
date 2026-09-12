# Backlog — deferred decisions

Items here are **not** to be implemented until explicitly picked up. They are
recorded so that the design does not accidentally foreclose them.

---

## B1 — Animal library (multiple piece-set pairs)

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

## B2 — PROMPTS.md

Record the exact DALL-E prompts that produced the goat and frog character
sheets, and the splash screen, in `public/piece-sets/PROMPTS.md`. Needed before
B1 is viable. Cheap to do, do it whenever.

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
