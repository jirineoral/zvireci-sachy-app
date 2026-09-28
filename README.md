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

```powershell
npm run check:lessons   # mechanical checks of the lesson data (FENs, answers, stars, text lint)
npm run test:lessons    # the lesson runner driven through every lesson in node
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

## The computer takes its time

The engine's move lands 1–2 seconds after yours even when the search itself took 300 ms
(pilot feedback: an instant reply read as "it is not thinking" and pulled children into
blitzing). The board stays locked with `přemýšlím…`; a new game or undo during the pause
discards the reply.

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

## Lessons

`Lekce` (the first mode button) opens the course map: levels, lessons with ticks, the next
lesson highlighted, nothing locked (`Tohle umím` marks a lesson done). The child picks a
teacher: the owl (default; an emoji placeholder until the drawing exists) or the animal
they play. A lesson runs on the main board in 4–8 short steps — look (`show`), play the
move (`move`: every correct answer is accepted, a wrong one is explained: „tvůj král by
byl v šachu“, „tady by ti věž vzala jezdce“), eat all the stars with one piece (`collect`)
or pick an answer (`choose`), or play a mini-game (`mini`: pěšcová válka, seber všechny
pěšce) against a deliberately weak local move picker with its own win condition (the
mini-games have no kings, so they cannot go through chess.js or Stockfish;
`src/lessons/mini.ts`). Pieces are named with their chess name and how they look in
the child's set („věž (u tebe kůzle s hradem na hlavě)“). The last step points to practice:
a game at a level, puzzles of a band and theme, or an ending.

Lessons are data in `src/lessons/*.ts`, reviewed in git; `npm run check:lessons` must pass
before shipping (legal and consistent FENs, complete lists of accepted moves — incl.
Stockfish for "best move" tasks — collect limits solvable, choose answers verified with
chess.js where possible (šach / mat / pat, „smí rošádovat?“), mini-games beatable by a
careful-beginner bot, Czech text lint). Progress lives in the browser (`skm.lessons`).

Each level ends with a test (`lesson.test`): ~10 tasks, one attempt each, no hints, the
score at the end. Passing earns the level's badge (course map) and a printable diploma
(„Diplom“: the child types a name, which is never sent anywhere and is stored — as
`skm.diplomaName` — only when „Zapamatuj si moje jméno“ is ticked; „Vytisknout“ prints the
sheet alone on an A4 landscape page). Level 1 (lessons 1–18) is complete; plan and
curriculum in `docs/phase-21-plan.md`.

### Sova čte nahlas (read-aloud)

For children who cannot read yet (U1, `docs/BACKLOG.md`), a 🔊 „Přečíst“ button next to the
teacher's text plays a pre-recorded clip of it; the setting „Sova čte nahlas“ (`skm.speak`,
default off) plays it automatically on every new step instead. All levels (1–5) are recorded;
a lesson without audio for its current text — the dynamically composed wrong-move
explanations, or a piece set other than „kůzlata“ on a first-piece-mention sentence — simply
hides the button, never an error.

The audio is generated deterministically by `scripts/lesson-audio/build.mjs`, reusing the
lesson-video pipeline's TTS call (`scripts/lesson-video/tts.ps1`, Windows SAPI, Czech voice
„Microsoft Jakub“) and its notation pronunciation, now the single source of truth in
`src/lessons/pronounce.ts`. The clips themselves are **not** committed to git — they are
uploaded to the same Cloudflare R2 bucket/domain as the lesson videos
(`https://videa.zvirecisachy.cz`, prefix `lesson-audio/`) and served straight from there; only
the small `src/lessons/audio-manifest.json` (text → content hash, a few hundred KB) is
committed, and it is imported straight into the JS bundle — no runtime fetch for it, and no
CDN cache to invalidate when it changes, because a new build simply ships the new one.

```
node scripts/lesson-audio/build.mjs                 # all 5 levels into scripts/lesson-audio/out/
node scripts/lesson-audio/build.mjs --levels 1,2,3  # a subset (additive: unrelated levels' audio is kept)
node scripts/lesson-audio/build.mjs --dry-run       # list the extracted texts, no TTS
node scripts/lesson-audio/build.mjs --report-only   # counts/MB per level, no TTS

node scripts/r2-upload.mjs             # upload scripts/lesson-audio/out/ to R2 (idempotent)
node scripts/r2-upload.mjs --dry-run   # just say what would be uploaded
```

Output under `scripts/lesson-audio/out/` (gitignored) is content-addressed —
`<hash>.{ogg,m4a}`, named by a hash of the voice and the normalised text — so an unchanged
step is never re-synthesised and an edited text produces a new file and a new manifest entry
automatically; re-running `build.mjs` for a set of levels also prunes manifest entries/files
that those levels no longer need (keeping anything other levels still use) and writes the
manifest with sorted keys. `r2-upload.mjs` HEADs each file's public URL first and only
uploads what is missing — safe to re-run after every `build.mjs` run, with
`Cache-Control: public, max-age=31536000, immutable` (correct for content-addressed names).
`src/lessons/voice.ts` looks the currently shown text up in the bundled manifest and plays
with the same `fetch()` + `decodeAudioData()` + shared `AudioContext` pattern as the sound
effects (`src/sounds.ts`) — same "never throws" contract, but this fetch is cross-origin (R2,
CORS-enabled for our own origins) rather than same-origin, and needs the network — it is not
cached by the service worker, so a clip simply won't play offline instead of erroring.

## Puzzles

`Úlohy` offers 3 200 tactics puzzles in four bands (začátečník 400–999 … těžší 1800–2300),
a subset of the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0),
selected and shipped as one static file by `scripts/build-puzzles.py`. Lichess semantics:
the opponent's move plays itself, then you find the solution; the two kings comment.
A theme select (Czech names of the Lichess tags, default „všechna témata“) narrows the band,
e.g. začátečník + „mat 1. tahem“. Progress lives in the browser (`skm.puzzles`).

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
(custom domain `hra.zvirecisachy.cz` in `wrangler.toml`; logs off). When a message shape
changes, deploy the Worker first and the site after it (the client drops messages it does
not recognise). The dev server can
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

## Sounds

Short, soft, low-volume cues for own move, the opponent's move, a capture, check, a win,
a loss/draw (gentle, never mocking), a solved puzzle, a correct/wrong lesson step and the
piece drop at kickoff. `src/sounds.ts` fetches same-origin files from `public/sounds/` and
decodes them with the Web Audio API (`decodeAudioData`); nothing plays until the first
`pointerdown`/`keydown` on the page (iOS/Safari autoplay rules — this also keeps the intro
splash silent until the child has actually touched something), and any failure (blocked
audio, an old browser, a bad fetch) is swallowed silently — a missing sound effect must
never break the game. Setting `Zvuky` (`skm.sounds`, default on).

The files are synthesised, not recorded or downloaded: `python scripts/make-sounds.py`
regenerates all ten from sine waves and filtered noise (stdlib `wave` + `math` only) into
`public/sounds/` — own work, same licence as the code (see that script's header). It
writes `.ogg` (Opus, for Chrome/Firefox) and `.m4a` (AAC, the fallback Safari/iOS
actually plays) when `ffmpeg` is on `PATH`, or a plain `.wav` otherwise; `sounds.ts` tries
`.ogg`, then `.m4a`, then `.wav`, so either output works. The whole set is ≈ 50 kB.
Re-run the script and commit the changed files under `public/sounds/` after editing it.

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

`Koncovky` sets up a textbook endgame position against the engine at full strength, with
a goal — win it, or hold the draw. 78 positions are grouped category → type → 6–7
positions of increasing difficulty (`src/endgames.ts`, `docs/phase-23-plan.md`): **Maty**
(dáma a král, věž a král, dvě věže, dva střelci, střelec a jezdec — pro odvážné),
**Pěšcové koncovky** (král a pěšec, pravidlo čtverce, průlom), **Věžové koncovky**
(Lucena, Philidor, věž proti pěšci), **Dáma proti pěšci**. Most ladders were generated
programmatically (random legal placement or, for Lucena/Philidor, a template around the
known motif) and picked to spread evenly across the tablebase's mate distance (or, for
draw goals, how forgiving the position is). Every position is checked by
`scripts/check-endgames.mjs` (`npm run check:endgames`): the Lichess tablebase for
positions with 7 pieces or fewer, local Stockfish at depth 20 otherwise. Progress lives
in the browser (`skm.endgames`), per position; a solved position keeps a ✓ and `Další
pozice` jumps to the next one in its type.

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

## Instalace / offline

The site is an installable PWA (backlog R12, step 1): "Přidat na plochu" / "Nainstalovat"
in the browser puts a `Zvířecí šachy` icon on the phone's home screen or in the desktop's
app list, opening full-screen with no browser chrome (`public/manifest.webmanifest`; icons
generated from the goat king's own artwork by `python scripts/make-icons.py`).

A hand-written service worker (`scripts/sw-template.js`, filled in per build by
`scripts/build-sw.mjs` into `dist/sw.js`, registered from `src/pwa.ts` in production
builds only) precaches the app shell (the JS/CSS bundle, `index.html`, the manifest, the
icons, `compat.js`, `soukromi.html`, `THIRD-PARTY-NOTICES.txt` and the small Stockfish
loader script — under 1 MB) so the app opens and a game against the engine starts with no
network at all. The Stockfish `.wasm` (~7 MB) and piece sets/lessons/puzzles/sounds/splash
images are cached the first time they are used instead of being precached — once a
character or a lesson has been opened while online, it keeps working offline. Nothing
cross-origin (chess.com, Lichess, the friend relay, Cloudflare Analytics) is ever cached.
Every deploy gets its own cache name (derived from the build's contents) and the old one
is deleted on activate, so a new version reaches players with nothing to clear by hand —
when one is ready, a small banner ("Je tu nová verze hry — Obnovit") offers to reload;
it never reloads on its own mid-game. Details and the CSP change:
`docs/security-review.md`, 2026-09-28.

## Publishing

The public site (https://zvirecisachy.cz, custom domain on GitHub Pages) is a build in a
separate repository. `npm ci` (not `npm install`) restores the exact locked dependencies;
`npm run build:pages` builds for the site root (`--mode pages`) and injects the Content
Security Policy and the Cloudflare Web Analytics beacon (`vite.config.ts` — public site
only; page views and visits per day, no cookies, no visitor id; open the site once with
`#bezmereni` to stop counting your own browser, `#mereni` to undo it);
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
