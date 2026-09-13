/**
 * "Kampaň" dialog (Phase 11): the grid of opponents in the player's order (defeated in
 * colour, the next one highlighted, the rest grey), play / skip / reorder / reset. The
 * dialog renders state it is handed; `main.ts` owns the campaign session.
 */
import { canSkip, campaignStep, campaignOpponents, defeatedCount, isPassed, type CampaignState } from '../campaign';
import type { Animal } from '../piece-sets';

export interface CampaignDialogDeps {
  dialog: HTMLDialogElement;
  state: () => CampaignState;
  animals: () => readonly Animal[];
  playerId: () => string;
  /** The opponent currently being played (campaign active), else null. */
  currentOpponent: () => string | null;
  image: (id: string) => string | null;
  play: (opponentId: string) => void;
  skip: (opponentId: string) => void;
  move: (opponentId: string, delta: -1 | 1) => void;
  reset: () => void;
  leave: () => void;
}

export interface CampaignDialog {
  open: () => void;
  render: () => void;
}

export function buildCampaignDialog(deps: CampaignDialogDeps): CampaignDialog {
  const { dialog } = deps;
  dialog.classList.add('campaign-dialog');
  dialog.replaceChildren();

  const h2 = el('h2', 'Kampaň');
  const note = el('p', 'Poraz všechna zvířátka, jedno po druhém. Pořadí si můžeš přeházet šipkami — čím dál, tím silnější soupeř.', 'us-note');
  const progress = el('p', '', 'campaign-progress');
  const grid = document.createElement('ol');
  grid.className = 'campaign-grid';
  const playBtn = button('', 'us-save campaign-play');
  const skipBtn = button('Přeskočit', 'campaign-skip');
  const leaveBtn = button('Ukončit kampaň', 'campaign-leave');
  const resetBtn = button('Začít znovu', 'campaign-reset');
  const closeBtn = button('Zavřít', 'us-close');
  const actions = document.createElement('div');
  actions.className = 'us-actions';
  actions.append(playBtn, skipBtn, leaveBtn, resetBtn, closeBtn);
  dialog.append(h2, note, progress, grid, actions);

  const render = (): void => {
    const state = deps.state();
    const animals = deps.animals();
    const playerId = deps.playerId();
    const current = deps.currentOpponent();
    const opponents = campaignOpponents(state, animals, playerId);
    const next = campaignStep(state, animals, playerId);
    const target = current !== null && !isPassed(state, current) ? campaignStep(state, animals, playerId, current) : next;
    const done = defeatedCount(state, animals, playerId);

    progress.textContent = opponents.length === 0
      ? 'Není proti komu hrát.'
      : next === null
        ? `Poraženo ${done} z ${opponents.length}. Kampaň je hotová — gratulace!`
        : `Poraženo ${done} z ${opponents.length}.`;

    grid.replaceChildren(
      ...opponents.map((a, i) => {
        const li = document.createElement('li');
        li.className = 'campaign-tile';
        const defeated = state.defeated.includes(a.id);
        const skipped = state.skipped.includes(a.id);
        if (defeated) li.classList.add('is-defeated');
        else if (skipped) li.classList.add('is-skipped');
        if (target && target.animal.id === a.id) li.classList.add('is-next');
        if (current === a.id) li.classList.add('is-current');
        const img = document.createElement('img');
        img.alt = '';
        img.width = 64;
        img.height = 64;
        img.decoding = 'async';
        img.loading = 'lazy';
        const src = deps.image(a.id);
        if (src) img.src = src;
        const mark = el('span', defeated ? '✓' : skipped ? '⤼' : '', 'campaign-mark');
        const name = el('span', `${i + 1}. ${a.name}`, 'campaign-name');
        const losses = state.losses[a.id] ?? 0;
        const sub = el('span', defeated ? 'poraženo' : skipped ? 'přeskočeno' : losses > 0 ? `pokusů: ${losses}` : '', 'campaign-sub');
        const up = button('▲', 'campaign-move');
        up.setAttribute('aria-label', `${a.name}: posunout dřív`);
        up.disabled = i === 0;
        up.addEventListener('click', () => deps.move(a.id, -1));
        const down = button('▼', 'campaign-move');
        down.setAttribute('aria-label', `${a.name}: posunout později`);
        down.disabled = i === opponents.length - 1;
        down.addEventListener('click', () => deps.move(a.id, 1));
        const playThis = button('Hrát', 'campaign-play-tile');
        playThis.setAttribute('aria-label', `Hrát proti: ${a.name}`);
        playThis.addEventListener('click', () => {
          deps.play(a.id);
          dialog.close();
        });
        const controls = document.createElement('span');
        controls.className = 'campaign-tile-controls';
        controls.append(up, down, playThis);
        li.append(img, mark, name, sub, controls);
        return li;
      }),
    );

    playBtn.hidden = target === null;
    if (target) playBtn.textContent = `Hrát: ${target.animal.name} (${target.index + 1}/${target.total})`;
    skipBtn.hidden = !(target && canSkip(state, target.animal.id));
    leaveBtn.hidden = current === null;
    resetBtn.disabled = done === 0 && state.skipped.length === 0 && Object.keys(state.losses).length === 0;
  };

  playBtn.addEventListener('click', () => {
    const target = currentTarget();
    if (!target) return;
    deps.play(target);
    dialog.close();
  });
  skipBtn.addEventListener('click', () => {
    const target = currentTarget();
    if (target) deps.skip(target);
  });
  leaveBtn.addEventListener('click', () => {
    deps.leave();
    render();
  });
  resetBtn.addEventListener('click', () => {
    if (window.confirm('Smazat postup kampaně? Pořadí zvířátek zůstane.')) deps.reset();
  });
  closeBtn.addEventListener('click', () => dialog.close());

  const currentTarget = (): string | null => {
    const state = deps.state();
    const current = deps.currentOpponent();
    if (current !== null && !isPassed(state, current)) return current;
    return campaignStep(state, deps.animals(), deps.playerId())?.animal.id ?? null;
  };

  return {
    open(): void {
      render();
      dialog.showModal();
    },
    render,
  };
}

function el(tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  return b;
}
