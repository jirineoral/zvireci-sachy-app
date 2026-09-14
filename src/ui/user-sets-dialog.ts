/**
 * "Vlastní figurky" dialog (MVP M1–M3): twelve labelled file slots, a name, save / delete,
 * the storage sentence and the prompt button. Files go through `importPieceImage`; a
 * failed file leaves its slot and the board untouched, the message is plain Czech.
 * All text through `textContent`; thumbnails are object URLs on CSSOM style properties.
 */
import { IMPORT_MESSAGES, ImportError, importPieceImage } from '../image-import';
import type { PieceSetManager } from '../piece-sets';
import { copyText, piecePrompt } from '../prompts';
import { PIECE_CODES, PIECE_LABELS, newSetId, type PieceCode, type UserSet, type UserSetStore } from '../user-sets';

export interface UserSetsDialogDeps {
  dialog: HTMLDialogElement;
  store: UserSetStore;
  manager: PieceSetManager;
  /** Called after a set was saved or deleted so the family selector can re-render. */
  onChanged: () => void;
}

const MAX_NAME = 40;

export function buildUserSetsDialog(deps: UserSetsDialogDeps): { open: () => void } {
  const { dialog, store, manager } = deps;
  dialog.classList.add('user-sets-dialog');
  dialog.replaceChildren();

  const h2 = el('h2', 'Vlastní figurky');
  const note = el(
    'p',
    'Figurky se ukládají jen v tomhle prohlížeči na tomhle zařízení — žádný server, nikam se nic neposílá. Zmizí, když smažeš data webu.',
    'us-note',
  );
  const sessionNote = el(
    'p',
    'Tenhle prohlížeč ukládání blokuje (anonymní okno?) — sada vydrží jen do zavření záložky.',
    'us-note us-warn',
  );
  sessionNote.hidden = store.persistent;

  const pick = document.createElement('select');
  pick.className = 'us-pick';
  const nameInput = document.createElement('input');
  nameInput.className = 'us-name';
  nameInput.maxLength = MAX_NAME;
  nameInput.placeholder = 'např. Lišky';
  const controls = document.createElement('div');
  controls.className = 'us-controls';
  controls.append(labelled('Sada', pick), labelled('Název', nameInput));

  const grid = document.createElement('div');
  grid.className = 'us-grid';
  const slots = new Map<PieceCode, { thumb: HTMLElement; input: HTMLInputElement; status: HTMLElement }>();
  for (const code of PIECE_CODES) {
    const slot = document.createElement('label');
    slot.className = 'us-slot';
    const thumb = document.createElement('span');
    thumb.className = 'us-thumb';
    const label = el('span', PIECE_LABELS[code], 'us-label');
    const status = el('span', 'chybí', 'us-status');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.addEventListener('change', () => void onFile(code, input));
    slot.append(thumb, label, status, input);
    grid.appendChild(slot);
    slots.set(code, { thumb, input, status });
  }

  const message = el('p', '', 'us-msg');
  message.setAttribute('role', 'status');

  const saveBtn = button('Uložit a použít', 'us-save');
  const deleteBtn = button('Smazat sadu', 'us-delete');
  const closeBtn = button('Zavřít', 'us-close');
  const actions = document.createElement('div');
  actions.className = 'us-actions';
  actions.append(saveBtn, deleteBtn, closeBtn);

  const promptSection = document.createElement('section');
  promptSection.className = 'us-prompt';
  const copyBtn = button('Zkopírovat prompt', 'us-copy');
  promptSection.append(
    el('h3', 'Jak vyrobit obrázky'),
    el(
      'p',
      'Tlačítko zkopíruje hotový prompt pro generátor obrázků (ChatGPT, Copilot, cokoli s DALL·E). ' +
        'V textu nahraď {ZVÍŘE} a {PALETA}. Výsledek je jeden obrázek se šesti figurkami v řadě — ' +
        'světlou i tmavou variantu si nech vygenerovat zvlášť a rozřež je zatím sám na dvanáct PNG/JPG souborů.',
    ),
    copyBtn,
    guideLine(),
  );

  const hint = el('p', 'Nahraj PNG nebo JPG, nejlépe čtvercové s průhledným pozadím; každý obrázek se zmenší na 256×256. Chybějící figurky doplní klasická sada.', 'us-note');

  dialog.append(h2, note, sessionNote, controls, hint, grid, message, actions, promptSection);

  // ---- draft state -----------------------------------------------------------------------
  let editingId: string | null = null;
  let draft: Partial<Record<PieceCode, Blob>> = {};
  let thumbUrls: string[] = [];
  let userSets: UserSet[] = [];

  const setMessage = (text: string, isError = false): void => {
    message.textContent = text;
    message.classList.toggle('us-error', isError);
  };

  const releaseThumbs = (): void => {
    for (const url of thumbUrls) URL.revokeObjectURL(url);
    thumbUrls = [];
  };

  const renderSlots = (): void => {
    releaseThumbs();
    for (const code of PIECE_CODES) {
      const s = slots.get(code)!;
      const blob = draft[code];
      if (blob) {
        const url = URL.createObjectURL(blob);
        thumbUrls.push(url);
        s.thumb.style.backgroundImage = `url("${url}")`;
        s.status.textContent = 'nahráno';
        s.status.classList.add('us-ok');
      } else {
        s.thumb.style.backgroundImage = '';
        s.status.textContent = 'chybí';
        s.status.classList.remove('us-ok');
      }
      s.input.value = '';
    }
    deleteBtn.hidden = editingId === null;
  };

  const loadDraft = (set: UserSet | null): void => {
    editingId = set?.id ?? null;
    draft = set ? { ...set.pieces } : {};
    nameInput.value = set?.name ?? '';
    renderSlots();
    setMessage('');
  };

  const renderPick = async (): Promise<void> => {
    userSets = await store.list();
    pick.replaceChildren(new Option('Nová sada', ''), ...userSets.map((s) => new Option(s.name, s.id)));
    pick.value = editingId ?? '';
  };

  pick.addEventListener('change', () => {
    loadDraft(userSets.find((s) => s.id === pick.value) ?? null);
  });

  let pending = 0; // imports in flight: saving waits for them (a slow JPEG must not be left out)
  const setBusy = (): void => {
    saveBtn.disabled = pending > 0;
    saveBtn.textContent = pending > 0 ? 'Zpracovávám obrázek…' : 'Uložit a použít';
  };

  async function onFile(code: PieceCode, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    pending++;
    setBusy();
    try {
      const blob = await importPieceImage(file);
      draft = { ...draft, [code]: blob };
      renderSlots();
      setMessage(`${PIECE_LABELS[code]}: nahráno.`);
    } catch (err) {
      const text = err instanceof ImportError ? err.message : IMPORT_MESSAGES.encode;
      input.value = '';
      setMessage(`${PIECE_LABELS[code]}: ${text}`, true);
    } finally {
      pending--;
      setBusy();
    }
  }

  saveBtn.addEventListener('click', () => {
    void (async () => {
      const count = PIECE_CODES.filter((c) => draft[c]).length;
      if (count === 0) {
        setMessage('Nahraj aspoň jednu figurku.', true);
        return;
      }
      const name = nameInput.value.trim().slice(0, MAX_NAME) || `Moje sada ${userSets.length + 1}`;
      const set: UserSet = { id: editingId ?? newSetId(), name, createdAt: Date.now(), pieces: { ...draft } };
      const previous = userSets.find((s) => s.id === set.id);
      if (previous) set.createdAt = previous.createdAt;
      try {
        await store.save(set);
      } catch (err) {
        console.warn('Saving the piece set failed; using it for this session only', err);
        setMessage('Sadu se nepodařilo uložit (plné nebo blokované úložiště) — použiju ji jen do zavření záložky.', true);
      }
      manager.useUserSet(set);
      editingId = set.id;
      await renderPick();
      renderSlots();
      deps.onChanged();
      if (!message.classList.contains('us-error')) setMessage(`Sada „${name}“ je uložená a na desce (${count} z 12 figurek).`);
    })();
  });

  deleteBtn.addEventListener('click', () => {
    void (async () => {
      if (editingId === null) return;
      const set = userSets.find((s) => s.id === editingId);
      if (!window.confirm(`Smazat sadu „${set?.name ?? ''}“?`)) return;
      try {
        await store.remove(editingId);
      } catch (err) {
        console.warn('Deleting the piece set failed', err);
      }
      manager.removeUserSet(editingId);
      loadDraft(null);
      await renderPick();
      deps.onChanged();
      setMessage('Sada smazaná.');
    })();
  });

  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    releaseThumbs();
  });

  copyBtn.addEventListener('click', () => {
    void copyText(piecePrompt()).then((ok) => {
      setMessage(ok ? 'Prompt je ve schránce — vlož ho do generátoru obrázků.' : 'Kopírování se nepovedlo; text promptu najdeš v docs/PROMPTS.md.', !ok);
    });
  });

  return {
    open(): void {
      void renderPick().then(() => {
        const current = manager.familyId?.startsWith('user-') ? manager.familyId.slice('user-'.length) : null;
        loadDraft(userSets.find((s) => s.id === current) ?? null);
        pick.value = editingId ?? '';
        dialog.showModal();
      });
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

function labelled(text: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(text + ' ', control);
  return label;
}

/** Link to the guide for a whole character sheet (two rows, dark on top) that can join the library. */
function guideLine(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'us-note';
  const a = document.createElement('a');
  a.href = 'https://github.com/jirineoral/zvireci-sachy-app/blob/main/docs/vlastni-sada.md';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Návod na celou sadu (šablona + prompt)';
  p.append('Chceš svoje zvíře pro všechny? ', a, ' — vygeneruj jeden obrázek ve správném rozložení a pošli nám ho.');
  return p;
}
