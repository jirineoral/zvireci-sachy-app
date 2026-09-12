/** Looks up a required element; a renamed selector fails here with a clear message. */
export function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Required element "${selector}" not found`);
  return el;
}
