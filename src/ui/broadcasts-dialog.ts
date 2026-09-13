/**
 * "Turnaje" dialog (Phase 16): Lichess broadcasts — search → rounds → games → review.
 * Three views in one dialog with `← zpět`; a running round refreshes every 30 s while
 * its games are shown. All text through `textContent`.
 */
import { LichessError, fetchRoundGames, fetchRounds, searchBroadcasts, type BroadcastGame, type BroadcastRound, type BroadcastTour } from '../lichess';
import type { GameRecord } from '../games';

export interface BroadcastsDialogDeps {
  dialog: HTMLDialogElement;
  /** Opens a record in the review; resolves false when its moves do not replay. */
  open: (record: GameRecord) => Promise<boolean>;
}

const REFRESH_MS = 30_000;

export function buildBroadcastsDialog(deps: BroadcastsDialogDeps): { open: () => void } {
  const { dialog } = deps;
  dialog.classList.add('broadcasts-dialog');
  dialog.replaceChildren();

  const h2 = el('h2', 'Turnaje');
  const note = el(
    'p',
    'Živé i dohrané partie z turnajů, které někdo přenáší na Lichess — celostátní mládežnické šampionáty, Czech Open, extraliga. Krajské přebory tam většinou nejsou.',
    'us-note',
  );
  const back = button('← zpět', 'bc-back');
  back.hidden = true;
  const title = el('h3', '', 'bc-title');
  const searchRow = document.createElement('div');
  searchRow.className = 'games-cc-row';
  const query = document.createElement('input');
  query.type = 'text';
  query.maxLength = 60;
  query.placeholder = 'hledej turnaj (třeba Czech)';
  query.autocomplete = 'off';
  query.spellcheck = false;
  const searchBtn = button('Hledat', 'us-save');
  searchRow.append(query, searchBtn);
  const message = el('p', '', 'us-msg');
  message.setAttribute('role', 'status');
  const list = document.createElement('ul');
  list.className = 'games-list bc-list';
  const closeBtn = button('Zavřít', 'us-close');
  const actions = document.createElement('div');
  actions.className = 'us-actions';
  actions.append(closeBtn);
  dialog.append(h2, note, back, title, searchRow, message, list, actions);

  type View = { kind: 'search' } | { kind: 'rounds'; tour: BroadcastTour } | { kind: 'games'; tour: BroadcastTour; round: BroadcastRound };
  let view: View = { kind: 'search' };
  let refreshTimer: number | null = null;
  let generation = 0;

  const setMessage = (text: string, isError = false): void => {
    message.textContent = text;
    message.classList.toggle('us-error', isError);
  };
  const fail = (err: unknown): void => {
    setMessage(err instanceof LichessError ? err.message : 'Načtení z Lichess se nepovedlo.', true);
    if (!(err instanceof LichessError)) console.error('Lichess broadcast failed', err);
  };
  const fmtDate = (ms: number): string => new Date(ms).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const fmtDateTime = (ms: number): string => new Date(ms).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const stopRefresh = (): void => {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = null;
  };

  const show = (next: View): void => {
    view = next;
    generation++;
    stopRefresh();
    list.replaceChildren();
    setMessage('');
    back.hidden = next.kind === 'search';
    searchRow.hidden = next.kind !== 'search';
    title.textContent = next.kind === 'search' ? '' : next.kind === 'rounds' ? next.tour.name : `${next.tour.name} · ${next.round.name}`;
    if (next.kind === 'rounds') void loadRounds(next.tour);
    if (next.kind === 'games') void loadGames(next.tour, next.round);
  };

  const renderTours = (tours: BroadcastTour[]): void => {
    list.replaceChildren(
      ...tours.map((t) => {
        const li = document.createElement('li');
        const info = document.createElement('div');
        info.className = 'games-info';
        const when = t.dates.length > 0 ? t.dates.map(fmtDate).filter((d, i, a) => a.indexOf(d) === i).join(' – ') : '';
        info.append(el('span', t.name, 'games-who'), el('span', [t.location, when].filter(Boolean).join(' · '), 'games-meta'));
        const openBtn = button('Kola', 'games-open');
        openBtn.addEventListener('click', () => show({ kind: 'rounds', tour: t }));
        li.append(info, openBtn);
        return li;
      }),
    );
    if (tours.length === 0) setMessage('Nic nenalezeno. Zkus jiné slovo (turnaje bývají pojmenované anglicky).');
  };

  const loadRounds = async (tour: BroadcastTour): Promise<void> => {
    const gen = generation;
    setMessage('Načítám kola…');
    try {
      const { rounds } = await fetchRounds(tour.id);
      if (gen !== generation) return;
      setMessage(rounds.length === 0 ? 'Turnaj zatím nemá žádné kolo.' : '');
      list.replaceChildren(
        ...rounds.map((r) => {
          const li = document.createElement('li');
          const info = document.createElement('div');
          info.className = 'games-info';
          const state = r.ongoing ? 'hraje se' : r.finished ? 'dohráno' : r.startsAt ? `začíná ${fmtDateTime(r.startsAt)}` : 'ještě nezačalo';
          info.append(el('span', r.name, 'games-who'), el('span', state, 'games-meta'));
          const openBtn = button('Partie', 'games-open');
          openBtn.addEventListener('click', () => show({ kind: 'games', tour, round: r }));
          li.append(info, openBtn);
          return li;
        }),
      );
    } catch (err) {
      if (gen === generation) fail(err);
    }
  };

  const renderGames = (games: BroadcastGame[], round: BroadcastRound): void => {
    list.replaceChildren(
      ...games.map((g) => {
        const li = document.createElement('li');
        const info = document.createElement('div');
        info.className = 'games-info';
        const plies = g.record?.sans.length ?? 0;
        const result = g.result === '*' ? (plies > 0 ? `hraje se · ${Math.ceil(plies / 2)}. tah` : 'ještě nezačalo') : g.record ? g.result : `${g.result} · bez zápisu tahů`;
        info.append(el('span', `${g.board ? g.board + ' · ' : ''}${g.white} × ${g.black}`, 'games-who'), el('span', result, 'games-meta'));
        const openBtn = button('Otevřít', 'games-open');
        openBtn.disabled = g.record === null;
        openBtn.addEventListener('click', () => {
          if (!g.record) return;
          void deps.open(g.record).then((ok) => {
            if (ok) dialog.close();
            else setMessage('Tuhle partii se nepodařilo přehrát.', true);
          });
        });
        li.append(info, openBtn);
        return li;
      }),
    );
    if (games.length === 0) setMessage(round.finished ? 'Z tohohle kola Lichess nemá žádné partie.' : 'Kolo ještě nezačalo — partie se objeví, až se začne hrát.');
  };

  const loadGames = async (tour: BroadcastTour, round: BroadcastRound, silent = false): Promise<void> => {
    const gen = generation;
    if (!silent) setMessage('Načítám partie…');
    try {
      const games = await fetchRoundGames(round.id);
      if (gen !== generation) return;
      setMessage(games.length > 0 ? `${games.length} partií${round.ongoing ? ' · obnovuje se každých 30 s' : ''}.` : '');
      renderGames(games, round);
      if (round.ongoing || (!round.finished && games.some((g) => g.result === '*'))) {
        refreshTimer = window.setTimeout(() => void loadGames(tour, round, true), REFRESH_MS);
      }
    } catch (err) {
      if (gen === generation) fail(err);
    }
  };

  const search = (): void => {
    const gen = ++generation;
    setMessage('Hledám…');
    list.replaceChildren();
    searchBtn.disabled = true;
    searchBroadcasts(query.value)
      .then((tours) => {
        if (gen !== generation) return;
        setMessage(tours.length > 0 ? `${tours.length} turnajů.` : '');
        renderTours(tours);
      })
      .catch((err) => {
        if (gen === generation) fail(err);
      })
      .finally(() => {
        searchBtn.disabled = false;
      });
  };

  searchBtn.addEventListener('click', search);
  query.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      search();
    }
  });
  back.addEventListener('click', () => {
    if (view.kind === 'games') show({ kind: 'rounds', tour: view.tour });
    else show({ kind: 'search' });
  });
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', stopRefresh);

  return {
    open(): void {
      if (view.kind !== 'search') show({ kind: 'search' });
      if (query.value.trim() === '') query.value = 'Czech';
      dialog.showModal();
      if (list.childElementCount === 0) search();
    },
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
