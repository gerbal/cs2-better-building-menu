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
 * Last, not first. The grid's "frequently placed" shelf renders the same
 * entries above the body with the same attribute, and the shelf is pinned in
 * view — anchoring to that copy reports the row on screen without scrolling
 * anything, a silent no-op dressed as a success. Walking up from the shelf's
 * copy also finds the panel rather than the list.
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
