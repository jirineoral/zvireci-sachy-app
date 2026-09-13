# ŠACH KVÁK MEK!!!

A personalized chess app for a young competitive player. Phase 1 was a local
human-vs-human board in the browser; Phase 2 adds a Stockfish opponent with adjustable
strength, side selection, undo and a promotion dialog. Only
legal moves are accepted, and the game ends correctly (checkmate, stalemate,
insufficient material, threefold repetition, fifty-move rule). All rules come from
`chess.js`; `@lichess-org/chessground` only renders the board. Later phases add a
custom piece set (frogs vs. goats) and PWA packaging.

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
(BSD-2-Clause). Whether the GPL reaches the app's own code is an open item (backlog B6).

## Game review

Two kings watch the game beside the board (the active piece set's own kings). Once a game
is over, "Rozbor" replays it ply by ply with comic-strip speech bubbles: Czech, funny,
written for a young club player. Texts are templates in `src/commentary.ts` (tone rules in
its header), chosen deterministically per ply from the move's situation (chess.js flags)
and the feedback glyph; mistakes name the engine's better move. No engine runs during
the review.

## Publishing

The public site is a GitHub Pages build in a separate repository. `npm ci` (not
`npm install`) restores the exact locked dependencies; `npm run build:pages` builds with
the Pages base path and injects the Content Security Policy (`vite.config.ts`);
`node scripts/publish-pages.mjs <pages-working-copy>` replaces the previous build there.
Security notes and the per-phase checklist: [`docs/security-review.md`](docs/security-review.md).

## Piece sets

Piece artwork is data (rules in `public/piece-sets/CONTRACT.md`). The "Hlavy" style is a
character library (`public/piece-sets/animals/`): nineteen characters, each drawn as light
(white) and dark (black) pieces, so the player picks their character, the opponent's
(or random) and a colour (or random — the default); the difficulty levels are named after
the player's character. "Celé figurky" and "Klasické" are fixed pairs; the classic set is
the built-in fallback (chess pieces by Colin M.L. Burnett, CC BY-SA 3.0, via chessground).
New characters come from `scripts/extract-animals.py` (Pillow + numpy).

## Plans

Phase plans, decisions and the deferred-work backlog live in [`docs/`](docs/)
alongside the code.
