/** The three fields the walk reads; an HTMLElement satisfies it. */
export interface ScrollBox {
  scrollHeight: number;
  clientHeight: number;
  parentElement: ScrollBox | null;
}

/**
 * The element that actually scrolls, found by walking up from a row and never
 * past the catalog's own root. A walk, because which element owns the scroll
 * differs by view mode and cs2/ui's Scrollable drops any marker prop.
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
 * The row to measure: the LAST `[data-catalog-entry]` under the root, so a
 * pinned copy drawn above the body cannot answer for the one in the list.
 * Under the root, never the document, because these rows are ours.
 */
export function lastCatalogRow(root: ParentNode, entryId?: number): HTMLElement | null {
  const selector = entryId === undefined ? "[data-catalog-entry]" : `[data-catalog-entry="${entryId}"]`;
  const rows = root.querySelectorAll(selector);
  const row = rows.length === 0 ? null : rows[rows.length - 1];

  // Node has no HTMLElement to instanceof-check against, and the callers only
  // read getBoundingClientRect and querySelector off it.
  return row as HTMLElement | null;
}
