/** The three fields the walk reads; an HTMLElement satisfies it. */
export interface ScrollBox {
  scrollHeight: number;
  clientHeight: number;
  parentElement: ScrollBox | null;
}

/**
 * The element that actually scrolls, found by walking up from a row and
 * never past the catalog's own root.
 *
 * By walking rather than by ref, because which element owns the scroll
 * differs by view mode, and cs2/ui's `Scrollable` silently drops props it
 * does not recognise — the `data-scrollable` marker that used to sit on one
 * of them never reached the DOM at all. Bounded by `within` because the
 * game's own screen is above the root, and a walk that kept going would
 * land on whatever vanilla container happened to overflow.
 *
 * `overflows` decides what counts: the callers pass
 * `isScrollContainer` from domain/catalogWindow, whose threshold is the
 * point — a plain `scrollHeight > clientHeight` stops at the first container
 * that sub-pixel rounding pushed one pixel over, which is not the one the
 * player is moving. Taken as an argument rather than imported because this
 * file has to load under the test runner, which strips types and does not
 * resolve the bundler's `domain/` alias.
 */
export function findScrollContainer<T extends ScrollBox>(
  from: T,
  within: T,
  overflows: (scrollHeight: number, clientHeight: number) => boolean
): T | null {
  let node = from.parentElement as T | null;

  while (node && node !== within) {
    if (overflows(node.scrollHeight, node.clientHeight)) {
      return node;
    }

    node = node.parentElement as T | null;
  }

  return null;
}

/**
 * The row to measure: the LAST `[data-catalog-entry]` under the root.
 *
 * Last, not first. This dates from the "frequently placed" shelf, which
 * rendered the same entries above the body under the same attribute: a pinned
 * copy that reported the row on screen without scrolling anything, a silent
 * no-op dressed as a success. The shelf is gone and nothing duplicates the
 * attribute today, so first and last now agree — but last stays, because it is
 * the reading that survives any future second copy above the body.
 *
 * Under the root, never the document: these rows are this component's own,
 * and a document-wide sweep is a reach across every other component on the
 * screen for something that was always right here.
 */
export function lastCatalogRow(root: ParentNode, entryId?: number): HTMLElement | null {
  const selector = entryId === undefined ? "[data-catalog-entry]" : `[data-catalog-entry="${entryId}"]`;
  const rows = root.querySelectorAll(selector);
  const row = rows.length === 0 ? null : rows[rows.length - 1];

  // Node has no HTMLElement to instanceof-check against, and the callers
  // only read getBoundingClientRect and querySelector off it.
  return row as HTMLElement | null;
}
