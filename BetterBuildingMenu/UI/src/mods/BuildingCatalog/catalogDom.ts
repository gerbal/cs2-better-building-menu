/** The three fields the walk reads; an HTMLElement satisfies it. */
export interface ScrollBox {
  scrollHeight: number;
  clientHeight: number;
  parentElement: ScrollBox | null;
}

/**
 * The element that actually scrolls, found by walking up from a row and never
 * past the catalog's own root. A walk, because which element owns the scroll
 * differs by view mode and cs2/ui's Scrollable drops any marker prop. Overflowing
 * is not enough: Scrollable's own wrapper is overflow: hidden, and its scrollbar
 * thumb can hang out of the track (see canScroll), so `scrolls` is asked too,
 * only of what overflows.
 */
export function findScrollContainer<T extends ScrollBox>(
  from: T,
  within: T,
  overflows: (scrollHeight: number, clientHeight: number) => boolean,
  scrolls: (node: T) => boolean
): T | null {
  let node = from.parentElement as T | null;

  while (node && node !== within) {
    if (overflows(node.scrollHeight, node.clientHeight) && scrolls(node)) {
      return node;
    }

    node = node.parentElement as T | null;
  }

  return null;
}

/**
 * Whether an element can scroll at all. Measured in game: when the kept menu
 * shows a list shorter than the one before, Scrollable's wrapper shrinks to it
 * but its scrollbar thumb keeps the old size and hangs 10 px out of the track,
 * so the wrapper overflows while nothing in it can scroll.
 */
export function canScroll(node: Element): boolean {
  const overflowY = getComputedStyle(node).overflowY;
  return overflowY === "auto" || overflowY === "scroll";
}

/**
 * Scrolls every element between a row and the catalog's root back to the top.
 * By what each has scrolled rather than by which overflows, so it needs no
 * layout: it runs on a menu just put back into the document.
 */
export function scrollToTopAbove<T extends { scrollTop: number; parentElement: T | null }>(from: T, within: T): void {
  for (let node = from.parentElement; node && node !== within; node = node.parentElement) {
    if (node.scrollTop > 0) {
      node.scrollTop = 0;
    }
  }
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
