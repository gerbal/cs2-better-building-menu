/**
 * What closes the box's open list, while one is open in either home. Escape's listener lives in the
 * always-mounted watcher, beside the box rather than inside it, so the box hands it this one call.
 * See docs/design-notes.md, "Escape".
 */
let close: (() => void) | null = null;

/** The box names what closes its open list, or null once none is open. */
export function setOpenListCloser(next: (() => void) | null): void {
  close = next;
}

/** What closes the open list, or null while none is open. */
export function openListCloser(): (() => void) | null {
  return close;
}
