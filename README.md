# Zvířecí šachy (nejen) pro děti

Live: **https://zvirecisachy.cz** · feedback form linked in the app's footer.

*Working title until 2026-09-13: ŠACH KVÁK MEK!!!*

## Licence

Copyright (C) 2026 Jiří Neoral. The program is free software under the **GNU GPL-3.0 or
later** (`LICENSE`; `"license"` in both `package.json`s) — the consequence of
bundling `@lichess-org/chessground` (GPL-3.0-or-later) and shipping Stockfish.js
(GPL-3.0), and a deliberate choice: the app is meant to stay free for children. The
**artwork is not under the GPL** — see `LICENSE-ARTWORK.md`. Third-party notices:
Stockfish (`public/engine/LICENSE-GPL-3.0.txt` after `npm ci`), chessground (GPL-3.0),
chess.js (BSD-2), cburnett pieces (CC BY-SA 3.0), Lichess puzzles (CC0) — the notices
ship with the site as `THIRD-PARTY-NOTICES.txt` (linked in the footer). Privacy notice for
players: `public/soukromi.html` (`Soukromí` in the footer).

A chess app for children (and anyone else): a Stockfish opponent with a seven-step
ladder, animal piece sets, a campaign, puzzles, endgame training, saved games with
analysis, tournament broadcasts, and a game with a friend over a link. Only legal moves
are accepted, and the game ends correctly (checkmate, stalemate, insufficient material,
threefold repetition, fifty-move rule). All rules come from `chess.js`;
`@lichess-org/chessground` only renders the board.

## Commands

```powershell
npm install
```

```powershell
npm run dev
```

```powershell
npm run build
```

## Engine

The opponent is [Stockfish 18](https://github.com/official-stockfish/Stockfish) in the
WebAssembly packaging of [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js)
(single-threaded "lite" build, npm package `stockfish`), licensed under the **GPL-3.0**.
`npm install` copies the engine files and the GPL text into `public/engine/`, so the
published site ships `engine/LICENSE-GPL-3.0.txt` next to the binaries and credits the
engine in its footer. The board is [chessground](https://github.com/lichess-org/chessground)
(GPL-3.0-or-later) and the rules are [chess.js](https://github.com/jhlywa/chess.js)
(BSD-2-Clause). The app itself is GPL-3.0 (see Licence above).

## Helpers are off by default

After the pilot's first feedback, the move feedback (`Hodnocení tahů`) starts **off** and
take-backs are limited to **3 per game** (`Tahy zpět`: žádné / 3× / bez omezení) — a
child should learn to see a hanging piece and to think before moving; adults switch the
helpers on. Both settings persist (`skm.moveFeedback`, `skm.undoLimit`).

## Game review

Two kings watch the game beside the board (the active piece set's own kings). Once a game
is over, "Rozbor" replays it ply by ply with comic-strip speech bubbles: Czech, funny,
written for a young club player. Texts are templates in `src/commentary.ts` (tone rules in
its header), chosen deterministically per ply from the move's situation (chess.js flags)
and the feedback glyph; mistakes name the engine's better move. No engine runs during
the review.

## Intro and splash

On load a ~2.5 s intro drops the real pieces of two randomly drawn characters (user sets
included) onto an empty board, then the splash appears with the title and `HRÁT`. Any
click, tap or key skips it; `prefers-reduced-motion` skips it entirely; the setting
`Intro` (`skm.intro`) turns it off for good and it shows once per browser session. After
`HRÁT` the game waits — choose the character and the colour, then press `Hrát!` (or, as
white, just move). Images: `public/splash/`; geometry and timing: `src/intro/landing-spots.ts`.

## Saved games and analysis

Every finished game is saved in the browser (IndexedDB) and listed under `Partie`, where a
PGN can also be pasted. Any game opens in the review; `Analyzovat partii` evaluates every
position with the local engine and shows an eval bar, the engine's best move as an arrow
and feedback glyphs for both sides — all client-side.

## Puzzles

`Úlohy` offers 3 200 tactics puzzles in four bands (začátečník 400–999 … těžší 1800–2300),
a subset of the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0),
selected and shipped as one static file by `scripts/build-puzzles.py`. Lichess semantics:
the opponent's move plays itself, then you find the solution; the two kings comment.
Progress lives in the browser (`skm.puzzles`).

## Play with a friend over a link

`Kamarád` makes a game and copies its link (`https://zvirecisachy.cz/#hra=<12 random
characters>`); `Sdílet…` opens the phone's share sheet (WhatsApp, SMS…). The friend opens
the link and the two boards are paired: each player moves their own colour, sees their own
piece set, and the bar under the status line says when the other side left or came back. No engine, no
move feedback, no take-backs in this mode — `Odveta` after the game swaps colours. Games
are saved with `mode: 'friend'` and kept out of `Bilance`.

This is the one thing in the app that touches a server: a small Cloudflare Worker
(`worker/`, one Durable Object per game) forwards the moves and keeps the move list so a
reload or a dropped connection resumes; the room is deleted 24 hours after the last
message. It never sees a name, an account or a cookie — only a random room id, a random
seat token per browser (`localStorage` `skm.friend`, forgotten after 24 h or on `Odejít`,
so the link opened again in a fresh tab returns to the same seat) and SAN moves; it
accepts sockets only from the app's own origins. The relay's origin is the only WebSocket
the CSP allows (`vite.config.ts`). Deploy: `cd worker`, `npm ci`, `npx wrangler deploy`
(custom domain `hra.zvirecisachy.cz` in `wrangler.toml`; logs off). The dev server can
point at a local `wrangler dev` through `.env.development.local`
(`VITE_FRIEND_WS=ws://127.0.0.1:8790`, gitignored).

## Two players

`Barva` → „dva hráči (bez počítače)“ turns the board into a plain two-player board (white
below): no engine, no move feedback, undo takes back one ply. Such games are saved but
kept out of `Bilance`.

## Captured pieces

Next to each king sits what that side has captured (drawn by the active piece set) and
`+N` when it leads on material (P 1, N 3, B 3, R 5, Q 9). It follows the position on the
screen — undo, review and loaded games included — and is computed from the game's start
position, so an endgame training starts with empty trays and the real balance.

## Game end

When a game the child played ends, their king reacts: a win makes it jump and shout its
own noise, a loss makes it slump with one quiet line, a draw makes both kings nod. After
a win or a loss the opponent's king is not on the screen at all (a child who just lost
should not watch the other animal); `Rozbor` brings both back. Reduced motion → no
movement.

## Piece drop

`Hrát!` rains the pieces into the starting position (≈ 1 s, chessground's own piece
elements animated with the Web Animations API, so they end exactly where the board has
them) under a `KŮZLATA vs. HADI` announcement — `soupeř 7 z 18` in the campaign. Any
click or key skips it; the engine waits for it. Setting `Nástup figurek` (`skm.pieceDrop`);
reduced motion shows the announcement only.

## chess.com import

In `Partie`, the `Chess.com` section loads a player's games straight from the public
chess.com API (`api.chess.com/pub`, no password, no server in between): pick a month,
open a game in the review or save it among the games. When the username is one of the two
players, the review knows which side is yours. The username is remembered
(`skm.chesscom`); this is one of the few external hosts the CSP allows (with Lichess, the friend relay and, on the public site, Cloudflare's analytics).

## Tournament broadcasts

`Turnaje` searches the public Lichess broadcast API (`lichess.org/api/broadcast`, no
account, no server): tournament → rounds → games → the review. Lichess carries what
somebody chooses to broadcast there — Czech national youth championships, Czech Open,
the Extraliga, the big opens — but not regional youth events or club leagues.
chess-results.com has no API and no CORS, so it stays out (it would need a proxy).
A running round refreshes every 30 s while its list is open; an opened game is a
snapshot. Nothing is stored.

## Your record

`Partie` opens with `Bilance`: wins : draws : losses per difficulty level (named after
your character), for the campaign, and per opponent — computed from the games saved in
this browser. Endgame training and pasted PGNs are left out. No Elo estimates are shown:
nothing has been measured, and a made-up number is worse than none.

## Endgame training

`Koncovky` sets up one of 17 textbook endgames (`src/endgames.ts`: mates with queen, rook,
two rooks, two bishops, bishop + knight; pawn endings; Lucena, Philidor; queen and rook
against a pawn) with a goal — win it, or hold the draw — against the engine at full
strength. Every position was checked with Stockfish at depth 22 before it went in.
Progress lives in the browser (`skm.endgames`).

## Campaign

`Kampaň` lines up every character of the library except your own (18 opponents) in an
order you can rearrange, from žížaly to člověk as the final boss. Each step plays at a
point on the 1–6 ladder interpolated over the campaign (`interpolateDifficulty` in
`src/difficulty.ts`), so the strength rises with every opponent instead of in six jumps.
A win colours the opponent in; a loss costs nothing, and after three failed attempts an
opponent can be skipped. Progress and order live in the browser (`skm.campaign`).

## Your own pieces

`Vlastní figurky…` takes a whole character sheet (two rows of six, dark on top — the
guide's layout) and cuts it in the browser (`src/sheet-cutter.ts`: border flood fill,
connected components, row/column splits, base-centred placement on a 256 canvas — the
same geometry as `scripts/extract-animals.py`); the twelve slots fill in, rows or two
pieces can be swapped, then the set is saved. Single files still work per slot.

"Vlastní figurky…" in the settings takes up to twelve PNG/JPG images (one per piece; the
missing ones show the classic set), downsizes them to 256×256 and keeps them in the
browser's IndexedDB — nothing leaves the device, a set lives in one browser on one device
and is gone when the site data is cleared. Files are sniffed by content (PNG/JPEG
signatures only, never SVG) and re-encoded through a canvas before they reach the page.
"Zkopírovat prompt" copies the image-generation prompt from `docs/PROMPTS.md`.

## Difficulty

Seven levels (`src/difficulty.ts`): Stockfish with a Skill Level and a depth cap; the two
weakest levels draw their move at random among the engine's best few candidates so they
play weakly but coherently. Levels 1–6 are the children's ladder (named after the player's
character; the campaign interpolates over them); level 7 `Velmistr` is the engine at full
strength for adults, added after the pilot's first hour. The levels were tuned by a tournament-playing child and an
adult club-level player — feedback on whether the lower levels suit a real beginner is
especially welcome.

All piece artwork (the character library) is AI-generated.

## Publishing

The public site (https://zvirecisachy.cz, custom domain on GitHub Pages) is a build in a
separate repository. `npm ci` (not `npm install`) restores the exact locked dependencies;
`npm run build:pages` builds for the site root (`--mode pages`) and injects the Content
Security Policy and the Cloudflare Web Analytics beacon (`vite.config.ts` — public site
only; page views and visits per day, no cookies, no visitor id);
`node scripts/publish-pages.mjs <pages-working-copy>` replaces the previous build there.
Security notes and the per-phase checklist: [`docs/security-review.md`](docs/security-review.md).

**Dev site.** Feature work is tested at https://dev.zvirecisachy.cz before it reaches the
public site: `npm run publish:dev-site` builds with `--mode devsite` (a "TESTOVACÍ VERZE"
stripe, `[DEV]` title, feedback link hidden) and pushes to the private repo
`jirineoral/zvireci-sachy-dev` (working copy `%USERPROFILE%\zvireci-sachy-dev`). Flow:
feature branch → `publish:dev-site` → test → merge to `main` → `build:pages` + publish.
The public publish stays a manual, reviewed push.

## Piece sets

Piece artwork is data (rules in `public/piece-sets/CONTRACT.md`). The "Hlavy" style is a
character library (`public/piece-sets/animals/`): nineteen characters, each drawn as light
(white) and dark (black) pieces, so the player picks their character, the opponent's
(or random) and a colour (or random — the default); the difficulty levels are named after
the player's character. "Klasické" is the built-in fallback (chess pieces by Colin M.L.
Burnett, CC BY-SA 3.0, via chessground). The full-figure farm pair (`public/piece-sets/farm/`,
goats vs. frogs) is no longer listed in `sets.json` — the player found two styles of the
same animals confusing — but the files and the extractor stay, one manifest entry away.
New characters come from `scripts/extract-animals.py` (Pillow + numpy); the sheet layout,
a template and the prompt are in [`docs/vlastni-sada.md`](docs/vlastni-sada.md) (Czech).

## Plans

Phase plans, decisions and the deferred-work backlog live in [`docs/`](docs/)
alongside the code.
