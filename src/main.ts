import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';

import { createEngine } from './engine';
import { GameController } from './game-controller';
import { requireElement } from './ui/dom';

const app = requireElement<HTMLDivElement>(document, '#app');

app.innerHTML = `
  <div class="board"></div>
  <aside class="panel">
    <h1>ŠACH KVÁK MEK!!!</h1>
    <div class="controls">
      <label>Obtížnost <select class="difficulty"></select></label>
      <label>Hraju za <select class="side"></select></label>
    </div>
    <div class="status"></div>
    <ol class="move-list"></ol>
    <div class="buttons">
      <button type="button" class="new-game">Nová hra</button>
      <button type="button" class="undo">Zpět</button>
    </div>
  </aside>
  <dialog class="promotion-dialog"></dialog>
`;

const ENGINE_WORKER_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;

// The controller owns engine-failure handling (before and after the handshake). It is
// constructed after the engine, hence the late binding.
let controller: GameController | undefined;
const engine = createEngine(ENGINE_WORKER_URL, (err) => {
  if (controller) controller.engineFailed(err);
  else console.error('Engine failed before the controller existed', err);
});

controller = new GameController(
  {
    board: requireElement<HTMLElement>(app, '.board'),
    status: requireElement<HTMLElement>(app, '.status'),
    moveList: requireElement<HTMLElement>(app, '.move-list'),
    newGameButton: requireElement<HTMLButtonElement>(app, '.new-game'),
    undoButton: requireElement<HTMLButtonElement>(app, '.undo'),
    difficultySelect: requireElement<HTMLSelectElement>(app, '.difficulty'),
    sideSelect: requireElement<HTMLSelectElement>(app, '.side'),
    promotionDialog: requireElement<HTMLDialogElement>(app, '.promotion-dialog'),
  },
  engine,
);

