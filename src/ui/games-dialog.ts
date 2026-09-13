/**
 * "Partie" dialog (Phase 9): saved games (open in the review / delete) and a PGN paste
 * box. All text through `textContent`; PGN is parsed by chess.js only.
 */
import { PgnError, RESULT_LABEL, recordFromPgn, statsFrom, type GameRecord, type GameStore, type Tally } from '../games';

export interface GamesDialogDeps {
  dialog: HTMLDialogElement;
  store: GameStore;
  /** Opens a record in the review; resolves false when its moves do not replay. */
  open: (record: GameRecord) => Promise<boolean>;
  /** Display name of a difficulty level (1–6) — the player's character names (Phase 14). */
  levelLabel: (level: number) => string;
}

export function buildGamesDialog(deps: GamesDialogDeps): { open: () => void } {
  const { dialog, store } = deps;
  dialog.classList.add('games-dialog');
  dialog.replaceChildren();

  const h2 = el('h2', 'Partie');
  const note = el(
    'p',
    store.persistent
      ? 'Dohrané partie se ukládají jen v tomhle prohlížeči na tomhle zařízení. Zmizí, když smažeš data webu.'
      : 'Tenhle prohlížeč ukládání blokuje — partie vydrží jen do zavření záložky.',
    'us-note',
  );
  const stats = document.createElement('section');
  stats.className = 'games-stats';
  const list = document.createElement('ul');
  list.className = 'games-list';
  const empty = el('p', 'Zatím žádná dohraná partie.', 'us-note');
  const message = el('p', '', 'us-msg');
  message.setAttribute('role', 'status');

  const pgnSection = document.createElement('section');
  pgnSection.className = 'games-pgn';
  const pgnArea = document.createElement('textarea');
  pgnArea.rows = 5;
  pgnArea.placeholder = '[White "…"]\n[Black "…"]\n\n1. e4 e5 2. Nf3 Nc6 …  (nebo jen tahy)';
  pgnArea.spellcheck = false;
  const pgnOpen = button('Otevřít PGN', 'us-save');
  const pgnSave = button('Uložit do partií', 'games-save');
  pgnSection.append(el('h3', 'Vložit PGN'), el('p', 'Partie z turnaje nebo z chess.com: vlož PGN (hlavičky nejsou nutné) a otevři ji v rozboru.', 'us-note'), pgnArea, pgnOpen, pgnSave);

  const closeBtn = button('Zavřít', 'us-close');
  const actions = document.createElement('div');
  actions.className = 'us-actions';
  actions.append(closeBtn);
  dialog.append(h2, note, stats, el('h3', 'Uložené partie'), list, empty, message, pgnSection, actions);

  let lastPgnRecord: GameRecord | null = null;

  const setMessage = (text: string, isError = false): void => {
    message.textContent = text;
    message.classList.toggle('us-error', isError);
  };

  const fmtDate = (ms: number): string =>
    new Date(ms).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const renderStats = (games: GameRecord[]): void => {
    const st = statsFrom(games);
    stats.replaceChildren();
    if (st.total.wins + st.total.draws + st.total.losses === 0) return;
    const fmt = (t: Tally): string => (t.wins + t.draws + t.losses === 0 ? '—' : `${t.wins} : ${t.draws} : ${t.losses}`);
    const table = (title: string, rows: [string, Tally, boolean?][]): HTMLElement => {
      const t = document.createElement('table');
      t.className = 'stats-table';
      const cap = document.createElement('caption');
      cap.textContent = title;
      const head = document.createElement('tr');
      for (const h of ['', 'výhry : remízy : prohry']) head.append(el('th', h));
      t.append(cap, head);
      for (const [label, tally, total] of rows) {
        const tr = document.createElement('tr');
        if (total) tr.className = 'stats-total';
        tr.append(el('td', label), el('td', fmt(tally)));
        t.append(tr);
      }
      return t;
    };
    const levelRows: [string, Tally, boolean?][] = [1, 2, 3, 4, 5, 6].map((l) => [deps.levelLabel(l), st.byLevel[l]]);
    levelRows.push(['Kampaň', st.campaign]);
    if (st.unknown.wins + st.unknown.draws + st.unknown.losses > 0) levelRows.push(['starší partie (bez úrovně)', st.unknown]);
    levelRows.push(['celkem', st.total, true]);
    stats.append(el('h3', 'Bilance'), table('Podle obtížnosti', levelRows), table('Podle soupeře', st.byOpponent.map((o) => [o.name, o.tally])));
  };

  const render = async (): Promise<void> => {
    const games = await store.list();
    renderStats(games);
    list.replaceChildren(
      ...games.map((g) => {
        const li = document.createElement('li');
        const info = document.createElement('div');
        info.className = 'games-info';
        const who = g.humanColor === 'w' ? `${g.white} (ty) × ${g.black}` : g.humanColor === 'b' ? `${g.white} × ${g.black} (ty)` : `${g.white} × ${g.black}`;
        info.append(el('span', fmtDate(g.playedAt), 'games-date'), el('span', who, 'games-who'), el('span', `${RESULT_LABEL[g.result]} · ${Math.ceil(g.sans.length / 2)} tahů${g.startEvalCp !== undefined ? ' · zanalyzováno' : ''}`, 'games-meta'));
        const openBtn = button('Otevřít', 'games-open');
        openBtn.addEventListener('click', () => {
          void deps.open(g).then((ok) => {
            if (ok) dialog.close();
            else setMessage('Tuhle partii se nepodařilo přehrát (poškozený záznam).', true);
          });
        });
        const delBtn = button('Smazat', 'games-delete');
        delBtn.addEventListener('click', () => {
          if (!window.confirm('Smazat tuhle partii?')) return;
          void store.remove(g.id).then(render);
        });
        li.append(info, openBtn, delBtn);
        return li;
      }),
    );
    empty.hidden = games.length > 0;
  };

  pgnOpen.addEventListener('click', () => {
    try {
      lastPgnRecord = recordFromPgn(pgnArea.value);
    } catch (err) {
      setMessage(err instanceof PgnError ? err.message : 'PGN se nepodařilo přečíst.', true);
      return;
    }
    const record = lastPgnRecord;
    void deps.open(record).then((ok) => {
      if (ok) dialog.close();
      else setMessage('PGN se nepodařilo přehrát.', true);
    });
  });
  pgnSave.addEventListener('click', () => {
    let record: GameRecord;
    try {
      record = lastPgnRecord && lastPgnRecord.sans.join(' ') === recordFromPgn(pgnArea.value).sans.join(' ') ? lastPgnRecord : recordFromPgn(pgnArea.value);
    } catch (err) {
      setMessage(err instanceof PgnError ? err.message : 'PGN se nepodařilo přečíst.', true);
      return;
    }
    void store
      .save(record)
      .then(render)
      .then(() => setMessage(`Partie ${record.white} × ${record.black} uložená.`))
      .catch((err) => {
        console.warn('Saving the game failed', err);
        setMessage('Partii se nepodařilo uložit (plné nebo blokované úložiště).', true);
      });
  });
  closeBtn.addEventListener('click', () => dialog.close());

  return {
    open(): void {
      setMessage('');
      void render().then(() => dialog.showModal());
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
