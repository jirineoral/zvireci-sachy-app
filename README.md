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

The opponent is [Stockfish.js](https://github.com/nmrugg/stockfish.js) (Stockfish 18,
single-threaded lite WASM build), licensed under the **GPL-3.0**. `npm install` copies
the engine files into `public/engine/`.

## Plans

Phase plans, decisions and the deferred-work backlog live in [`docs/`](docs/)
alongside the code.
