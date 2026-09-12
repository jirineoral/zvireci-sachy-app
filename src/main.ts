import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';

import { GameController } from './game-controller';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app root element not found');

app.innerHTML = `
  <div class="board"></div>
  <aside class="panel">
    <h1>ŠACH KVÁK MEK!!!</h1>
    <div class="status"></div>
    <ol class="move-list"></ol>
    <button type="button" class="new-game">Nová hra</button>
  </aside>
`;

new GameController({
  board: app.querySelector<HTMLElement>('.board')!,
  status: app.querySelector<HTMLElement>('.status')!,
  moveList: app.querySelector<HTMLElement>('.move-list')!,
  newGameButton: app.querySelector<HTMLButtonElement>('.new-game')!,
});
