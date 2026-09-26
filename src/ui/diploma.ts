/**
 * The printable diploma (Phase 21b): opened after a passed level test (the lesson panel's
 * „Diplom“ or the badge in the course map). The child types a name; it is shown on the
 * sheet live, never sent anywhere, and stored only with „Zapamatuj si moje jméno“
 * (src/lessons/diploma.ts). „Vytisknout“ prints only the sheet, on an A4 landscape page
 * (styles/diploma.css): the sheet is cloned into a body-level print container, the rest
 * of the page is hidden for the print. All text via textContent; images are same-origin.
 */
import '../styles/diploma.css';
import { cleanDiplomaName, czechDate, DIPLOMA_NAME_MAX, readDiplomaName, writeDiplomaName } from '../lessons/diploma';
import type { TeacherInfo } from './lesson-panel';

export interface DiplomaDeps {
  dialog: HTMLDialogElement;
  storage: () => Storage | null;
  /** The teacher shown on the diploma (the one chosen in the course map). */
  teacher: () => TeacherInfo;
  /** For the date on the diploma (tests pass a fixed one). */
  now?: () => Date;
}

export interface DiplomaDialog {
  open: (level: number, levelTitle: string) => void;
}

const APP_NAME = 'Zvířecí šachy (nejen) pro děti';

export function buildDiplomaDialog(deps: DiplomaDeps): DiplomaDialog {
  const { dialog } = deps;
  dialog.classList.add('diploma-dialog');
  dialog.replaceChildren();

  // --- the form -------------------------------------------------------------------
  const h2 = el('h2', 'Tvůj diplom');
  const nameLabel = document.createElement('label');
  nameLabel.className = 'diploma-field';
  nameLabel.append(el('span', 'Tvoje jméno'));
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = DIPLOMA_NAME_MAX;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.placeholder = 'Napiš svoje jméno';
  nameLabel.append(nameInput);

  const rememberLabel = document.createElement('label');
  rememberLabel.className = 'diploma-remember';
  const remember = document.createElement('input');
  remember.type = 'checkbox';
  rememberLabel.append(remember, el('span', 'Zapamatuj si moje jméno (jen v tomhle prohlížeči)'));
  const note = el('p', 'Jméno se nikam neposílá. Zůstane jen tady na diplomu.', 'diploma-note');

  const printBtn = button('Vytisknout 🖨', 'diploma-print-btn');
  const closeBtn = button('Zavřít', 'diploma-close');
  const actions = el('div', '', 'diploma-actions');
  actions.append(printBtn, closeBtn);

  // --- the sheet ------------------------------------------------------------------
  const sheet = el('div', '', 'diploma-sheet');
  const app = el('div', APP_NAME, 'diploma-app');
  const title = el('div', 'Diplom', 'diploma-title');
  const gets = el('div', 'získává', 'diploma-gets');
  const nameLine = el('div', '', 'diploma-name');
  const forWhat = el('div', 'za úspěšně složenou zkoušku', 'diploma-for');
  const level = el('div', '', 'diploma-level');
  const badge = el('div', '🏅', 'diploma-badge');
  badge.setAttribute('aria-hidden', 'true');
  const avatar = el('div', '', 'diploma-avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const teacherName = el('div', '', 'diploma-teacher-name');
  const teacher = el('div', '', 'diploma-teacher');
  teacher.append(avatar, teacherName);
  const date = el('div', '', 'diploma-date');
  const footer = el('div', '', 'diploma-footer');
  footer.append(teacher, badge, date);
  const inner = el('div', '', 'diploma-inner');
  inner.append(app, title, gets, nameLine, forWhat, level, footer);
  sheet.append(inner);
  const preview = el('div', '', 'diploma-preview');
  preview.append(sheet);

  const form = el('div', '', 'diploma-form');
  form.append(nameLabel, rememberLabel, note, actions);
  dialog.append(h2, form, preview);

  const paintName = (): void => {
    const name = cleanDiplomaName(nameInput.value);
    nameLine.textContent = name;
    nameLine.classList.toggle('is-empty', name === '');
  };

  const persist = (): void => writeDiplomaName(deps.storage(), nameInput.value, remember.checked);

  nameInput.addEventListener('input', () => {
    paintName();
    if (remember.checked) persist();
  });
  remember.addEventListener('change', persist);
  closeBtn.addEventListener('click', () => dialog.close());

  printBtn.addEventListener('click', () => {
    paintName();
    printSheet(sheet);
  });

  return {
    open(levelNumber: number, levelTitle: string): void {
      const stored = readDiplomaName(deps.storage());
      nameInput.value = stored ?? '';
      remember.checked = stored !== null;
      paintName();
      level.textContent = `Úroveň ${levelNumber}: ${levelTitle}`;
      const t = deps.teacher();
      avatar.replaceChildren();
      if (t.image) {
        const img = document.createElement('img');
        img.src = t.image;
        img.alt = '';
        img.decoding = 'async';
        avatar.append(img);
      } else avatar.textContent = t.emoji;
      teacherName.textContent = `Trenér: ${t.name}`;
      date.textContent = czechDate(deps.now?.() ?? new Date());
      if (!dialog.open) dialog.showModal();
      nameInput.focus();
    },
  };
}

/**
 * Prints only the sheet: a copy goes into a body-level container that the print styles
 * show alone on an A4 landscape page; it is removed again after printing (`afterprint`).
 */
function printSheet(sheet: HTMLElement): void {
  document.querySelector('.diploma-print')?.remove();
  const holder = document.createElement('div');
  holder.className = 'diploma-print';
  holder.append(sheet.cloneNode(true));
  document.body.append(holder);
  const root = document.documentElement;
  root.classList.add('printing-diploma');
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    root.classList.remove('printing-diploma');
    holder.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  // Not on a timer: a browser whose print() returns early still needs the copy. Harmless
  // meanwhile — on screen the copy is hidden, and the next print replaces it.
  window.addEventListener('afterprint', cleanup);
  window.print();
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
