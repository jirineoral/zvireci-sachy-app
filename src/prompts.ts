/**
 * The image-generation prompt offered by "Zkopírovat prompt" (MVP M3). Single source:
 * docs/PROMPTS.md, bundled at build time; the fenced block tagged `prompt` is the text.
 */
import promptsMarkdown from '../docs/PROMPTS.md?raw';

const BLOCK = /```prompt\r?\n([\s\S]*?)\r?\n```/;

export function piecePrompt(): string {
  const match = BLOCK.exec(promptsMarkdown);
  if (!match) throw new Error('docs/PROMPTS.md has no ```prompt block');
  return match[1].trim();
}

/** Copies text to the clipboard; falls back to a hidden textarea + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
