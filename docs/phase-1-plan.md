# Phase 1 — Playable chessboard (plan, rev. 2)

## Context
Greenfield weekend project **ŠACH KVÁK MEK!!!** — foundation for a personalized chess app
for a young tournament player. This phase delivers a local human-vs-human board in
the browser. Later phases add a manifest-driven custom piece set (frogs vs. goats, with
its own board palette), an engine opponent and PWA packaging — so piece styling, board
colours and the chess.js↔chessground bridge must be isolated now.

Project dir `(project directory)` is empty.
Toolchain present: Node 24.13, npm 11.6. Versions verified on the registry 2026-09-12:
`chess.js@1.4.0`, `@lichess-org/chessground@10.1.1` (the unscoped `chessground` is deprecated on npm since 2025-10-05; API and `canMove` verified identical in the installed d.ts/dist), `vite@8.3.0`, `typescript@7.0.2`.

## Model policy (applies to this and every later phase)
- Plan / architecture / non-obvious debugging → strongest model. **This plan is that step.**
- Implementing this approved plan → cheaper/faster model. The plan below names files,
  signatures and acceptance criteria; the coding is mechanical.
- Diff review + running the Definition of Done → strongest model again.
- Rule for the implementing model: **any decision not written in this plan → stop and say
  so; do not improvise.** Escalating is expected.
- Fresh session per phase; carry this plan file, not the transcript.

## Non-negotiables (from the brief)
- **Zero hand-rolled rules.** Every legality/end-of-game answer comes from `chess.js`.
  chessground only ever receives a `dests` map that chess.js produced; chessground's own
  `canMove` (verified in the installed 10.1.1 `dist/board.js`) refuses any drop not in that map, so illegal
  drops snap back with no code of ours.
- chess.js is the single source of truth; after every move the board is re-synced from
  `chess.fen()`, never from what chessground thinks happened.
- Vanilla TS, Vite, npm. Shell commands given to the user: PowerShell, no `&&`.
  (npm script bodies in `package.json` may use normal npm syntax; keep them simple.)
- Project name **ŠACH KVÁK MEK!!!** in `index.html <title>` and `<h1>`;
  `package.json` `"name": "sach-kvak-mek"` (npm forbids spaces/diacritics/`!` in `name`)
  with `"description": "ŠACH KVÁK MEK!!!"` carrying the real name. No other name anywhere.

## Scaffold (hand-written, not `npm create vite`)
`create-vite` asks interactive questions that don't work in a non-interactive shell and
adds demo code we'd delete. The scaffold is a handful of tiny files written directly.

```
package.json          "private": true; scripts: dev=vite, build=tsc --noEmit && vite build, preview=vite preview
                      EXACT versions, no ^ or ~:
                        dependencies:    chess.js 1.4.0, @lichess-org/chessground 10.1.1
                        devDependencies: vite 8.3.0, typescript 7.0.2
tsconfig.json         strict, target ES2022, module ESNext, moduleResolution bundler,
                      noEmit, isolatedModules, include ["src"]
index.html            lang="cs"; <title>ŠACH KVÁK MEK!!!</title>; <div id="app">;
                      <script type="module" src="/src/main.ts">
src/
  main.ts             imports the 3 CSS files (order: board → pieces → app), builds the
                      DOM skeleton, `new GameController(...)`
  game-controller.ts  the ONE stateful object: owns Chess instance + BoardBridge + UI refs
  board-bridge.ts     chess.js <-> chessground bridge (only module that imports both)
  game-status.ts      pure fn: Chess -> { over: boolean; text: string }, reads chess.js flags only
  ui/move-list.ts     pure render: string[] SAN -> numbered rows, autoscroll to bottom
  ui/status.ts        pure render: status text into the status element
  styles/
    board.css         @import chessground base + brown; --board-light/--board-dark vars (see below)
    pieces.css        @import '@lichess-org/chessground/assets/chessground.cburnett.css'  ← phase-3 swap point
    app.css           page layout (board left, panel right), typography; nothing chess-specific
```

`pieces.css` is the only file that knows where piece images come from; game logic never
references asset paths.

### `board.css` — palette as custom properties (review note 2)
The vendor brown theme paints dark squares as a 20 %-black SVG overlay on
`background-color`, so its dark colour is *not* independently settable. Keep the import
for its highlight/coordinate styling, but override the board face:

```css
@import '@lichess-org/chessground/assets/chessground.base.css';
@import '@lichess-org/chessground/assets/chessground.brown.css';

.cg-wrap {
  --board-light: #f0d9b5;
  --board-dark:  #b58863;
}
/* 2×2-square tile, top-left light so that a8 is light and a1/h8 dark */
cg-board {
  background-color: var(--board-light);
  background-image: conic-gradient(
    var(--board-dark)  25%,
    var(--board-light) 0 50%,
    var(--board-dark)  0 75%,
    var(--board-light) 0
  );
  background-size: 25% 25%;
}
```
Phase 3 changes the palette by setting the two variables on the same element; nothing in
TS knows the colours. **DoD check:** a1 dark, h1 light (verify visually).

## Module design

### `board-bridge.ts`
```ts
export interface BoardBridge { sync(chess: Chess): void; }
export function createBoardBridge(
  el: HTMLElement,
  onUserMove: (from: Square, to: Square) => void,
): BoardBridge
```
- Creates the `Chessground` instance once. Fixed config:
  `orientation: 'white'`, `coordinates: true`,
  `animation: { enabled: true, duration: 200 }` (review note 6 — chessground diffs the new
  FEN against the old pieces and animates the rook on castling for free; if a visible
  desync ever appears, that is a bug to report, not a reason to silently switch it off),
  `premovable: { enabled: false }`, `drawable: { enabled: false, visible: false }`,
  `movable: { free: false, showDests: true, events: { after: (o, d) => onUserMove(o, d) } }`.
- `sync(chess)` calls `api.set({...})` with:
  - `fen: chess.fen()`
  - `turnColor: chess.turn() === 'w' ? 'white' : 'black'`
  - `check: chess.inCheck()`
  - `lastMove`: `[from, to]` of the last entry of `chess.history({ verbose: true })`, or `undefined`
  - `movable.color`: side to move, or `undefined` when `chess.isGameOver()`
  - `movable.dests`: `Map<Key, Key[]>` built from `chess.moves({ verbose: true })`
    (multiple promotion moves collapse to one destination square — dedupe).
- Nothing else in the app touches the chessground `Api`.

### `game-controller.ts` — `class GameController`
- Constructor takes the board element, status element, move-list element, new-game button.
  Fields: `chess: Chess`, `board: BoardBridge`. No module-level mutable state anywhere.
- `handleUserMove(from, to)` (review note 1 — no bare catch):
  ```ts
  try {
    // TODO(phase-2): promotion dialog — auto-promote to queen for now.
    // chess.js ignores `promotion` on non-promotion moves, so passing it always is safe.
    this.chess.move({ from, to, promotion: 'q' });
  } catch (err) {
    console.error(`Move ${from}->${to} rejected by chess.js`, err);
  }
  this.board.sync(this.chess);   // always re-sync from chess.js, success or failure
  this.render();
  ```
- `newGame()`: `chess.reset()` → sync → render.
- `render()`: `renderMoveList(el, chess.history())`, `renderStatus(el, gameStatus(chess))`.

### `game-status.ts` — `gameStatus(chess): { over: boolean; text: string }`
Priority order, each a chess.js call (names to be **re-verified against
`node_modules/chess.js/dist/types/chess.d.ts` after install** — review note 5; the names
below are what the 1.4.0 tarball declares today):
1. `isCheckmate()` → `"Šach mat — vyhrává bílý/černý"` (winner = opposite of `turn()`)
2. `isStalemate()` → `"Remíza — pat"`
3. `isInsufficientMaterial()` → `"Remíza — nedostatečný materiál"`
4. `isThreefoldRepetition()` → `"Remíza — trojí opakování"`
5. `isDrawByFiftyMoves()` → `"Remíza — pravidlo 50 tahů"`
6. otherwise `"Na tahu: bílý/černý"` + `" — šach!"` if `inCheck()`
No position inspection of our own. (UI strings in Czech to match the app name; the
implementing model must not translate identifiers or comments — code stays English.)

## UI
- Two-column flex layout: 560 px board, right panel with `<h1>ŠACH KVÁK MEK!!!</h1>`,
  status line, scrollable move list (`<ol>`-based rows `N. white black`,
  `scrollTop = scrollHeight` after each render) and a **Nová hra** button.
- Side to move is shown in the status line; chessground additionally only lets the side to
  move pick up pieces (`movable.color`).
- Desktop Chromium only; no responsive work this phase.

## Explicitly NOT doing
Engine, custom pieces, sound, PWA, persistence, clocks, board flip, undo, promotion
dialog, test framework, i18n. Anything beyond the numbered requirements waits for review.

## Backlog — deferred decisions (NOT Phase 1 work; recorded so the design doesn't foreclose them)

- **B1 — Animal library (more piece-set pairs: pigs, dogs, cats, donkeys, cows, mice).
  Deferred. Do not build** until the actual user asks for another set. Phase 3's set
  mechanism must make a new pair = copied folder + one `sets.json` entry, zero code.
  *Decision taken now:* a set is a **fixed pair**, never two independently chosen sides
  (free mix rejected: art is not on a neutral palette, cream goats vs. white cow would be
  indistinguishable, and the board palette is tuned per pair). Each `sets.json` entry
  carries a documentary `"pair"` field (e.g. `"pair": "kuzlata-zabky"`), unread by code.
  Prerequisite for any new pair: reuse the **verbatim** DALL-E prompt from
  `public/piece-sets/PROMPTS.md` with only animal + palette swapped, existing sheets as
  style references. A freshly written prompt will not match.
- **B2 — `public/piece-sets/PROMPTS.md`.** Record the exact DALL-E prompts that produced
  the goat and frog sheets and the splash screen. Needed before B1 is viable; cheap; do
  whenever.
- **B3 — chess.com game import.** Replay the boy's own tournament games in his own piece
  set. Public API, no auth: `api.chess.com/pub/player/{username}/games/archives` →
  monthly archive URLs → games with PGN; chess.js loads PGN directly, so this is a
  move-list navigator over existing infrastructure. Deferred until phases 1–6 are done;
  likely the highest-value feature in the project.
  *Phase 1 consequence:* none required — the move list already renders purely from
  `chess.history()`, so a navigator can later drive it from a loaded PGN.

## Carried forward to Phase 3 (not Phase 1 work — recorded here so it isn't lost)
- **B4 — bishop artwork mismatch: RESOLVED 2026-09-12.** Goat bishop regenerated with a
  mitre; both sides mirror each other (mitre + bow). No further action.
- **B5 — goat palette: OPEN, do before Phase 4 ships the artwork.** Green is exclusive to
  the frog side. Regenerate the goat sheet replacing every green element (bishop's cape,
  queen's and king's cloaks, king's crown velvet) with deep brown / burgundy; keep cream
  bodies, gold accents, sand bases. Verification: render both sheets side by side at
  ~64 px height and identify every piece — especially the two kings — without hesitation.
  Splash screen unchanged.
- Consequence for Phase 3 design: the goat side wants a cream/brown/burgundy board, the
  frog side a green one → the piece-set manifest must carry `--board-light` /
  `--board-dark` values, which is why Phase 1 already exposes them on `.cg-wrap`.

## Commands (PowerShell)
```powershell
npm install
```
```powershell
npm run dev
```
```powershell
npm run build
```

## Verification (Definition of Done)
After `npm run dev`, open the Vite URL in the in-app browser and play each line using
chessground's click-click input:
1. **Scholar's Mate** 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7# → status shows checkmate /
   white wins, move list ends `Qxf7#`, no piece can be picked up afterwards.
2. **Castling both sides**: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O (kingside); new game,
   1.d4 d5 2.Nc3 Nc6 3.Bf4 Bf5 4.Qd2 Qd7 5.O-O-O O-O-O (queenside both colours). Rook
   ends on the correct square, rook move is animated (not teleported), SAN `O-O`/`O-O-O`.
3. **En passant**: 1.e4 a6 2.e5 d5 3.exd6 — d5 pawn removed, SAN `exd6`.
4. **Pinned piece**: 1.e4 e5 2.Nf3 d6 3.Bb5+ Nc6 (knight now pinned to the king), then
   any White move (4.d3): selecting the c6 knight
   shows **no** destination dots; dragging it to e5/d4/b4 snaps back; move list unchanged.
5. **Illegal drop** e2→e5 at move 1 snaps back, move list stays empty.
6. **Promotion (auto-queen)** (review note 3): 1.e4 d5 2.exd5 c6 3.dxc6 Nf6 4.cxb7 Nc6
   5.bxa8=Q → a white queen appears on a8, SAN contains `=Q`.
7. **Threefold repetition** (review note 4): 1.Nf3 Nf6 2.Ng1 Ng8 3.Nf3 Nf6 4.Ng1 Ng8 →
   status reports the repetition draw and the board locks.
8. **Board colours**: a1 is dark, h1 light; changing `--board-light` in devtools recolours
   the board live.
9. **New game** resets board, move list and status.
10. `npm run build` passes (`tsc --noEmit` strict + vite build).
