/** Looks up a required element; a renamed selector fails here with a clear message. */
export function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Required element "${selector}" not found`);
  return el;
}

/**
 * `<dialog>` for old browsers (Safari < 15.4 …): there `showModal()` / `close()` do not
 * exist and every dialog button would throw. Patches this element with a non-modal
 * fallback — shown inline via the `open` attribute, a `close` event on closing — used
 * also when a native `showModal()` throws. Modern browsers keep the native behaviour.
 */
export function guardDialog(dialog: HTMLDialogElement): void {
  const nativeShowModal = typeof dialog.showModal === 'function' ? dialog.showModal.bind(dialog) : null;
  const nativeClose = typeof dialog.close === 'function' ? dialog.close.bind(dialog) : null;
  // Without dialog support the element is an unknown one: rendered unless we hide it (CSSOM, CSP-safe).
  const hideWhenClosed = nativeShowModal === null;
  if (hideWhenClosed) dialog.style.display = 'none';
  let fallbackOpen = false;
  dialog.showModal = () => {
    if (nativeShowModal) {
      try {
        nativeShowModal();
        return;
      } catch (err) {
        if (dialog.open) return; // already open: nothing to do
        console.warn('dialog.showModal failed; showing the dialog inline', err);
      }
    }
    fallbackOpen = true;
    dialog.setAttribute('open', '');
    if (hideWhenClosed) dialog.style.display = '';
    dialog.scrollIntoView?.({ block: 'center' });
  };
  dialog.close = (returnValue?: string) => {
    if (!fallbackOpen) {
      nativeClose?.(returnValue);
      return;
    }
    fallbackOpen = false;
    dialog.removeAttribute('open');
    if (hideWhenClosed) dialog.style.display = 'none';
    dialog.dispatchEvent(new Event('close'));
  };
}
