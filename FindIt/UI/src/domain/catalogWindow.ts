/**
 * The arithmetic behind the catalog's growing window.
 *
 * The window is backend-owned: the offset stays at zero and the window grows by
 * asking for a larger limit, so every page is a strict superset prefix of the
 * one before it. Nothing is accumulated on this side because placing a building
 * unmounts the whole lens, and an accumulator would go with it.
 *
 * This module only decides *when* to ask and *for how much*. It is kept free of
 * DOM types so Node's browserless runner can exercise it: callers pass the
 * three numbers they read off the scroll container.
 */

/**
 * How close to the bottom counts as "nearly there", in the scroll container's
 * pixels.
 *
 * Rows are 84–92 units tall (see `getBuildingLensRowGeometry`), so this is
 * about three rows of runway — enough for the round trip through the C# binding
 * to land before the player reaches the last one. It is deliberately smaller
 * than BUILDING_LENS_MIN_CATALOG_HEIGHT (320): a band taller than the shortest
 * catalog viewport is already satisfied at scrollTop 0, which would grow the
 * window before the player has scrolled at all.
 */
export const CATALOG_WINDOW_SCROLL_THRESHOLD = 280;

export interface CatalogScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  /** Defaults to CATALOG_WINDOW_SCROLL_THRESHOLD. */
  threshold?: number;
}

/** Whether the viewport bottom has come within `threshold` px of the content bottom. */
export function shouldLoadMore({ scrollTop, clientHeight, scrollHeight, threshold }: CatalogScrollMetrics): boolean {
  if (!Number.isFinite(scrollTop) || !Number.isFinite(clientHeight) || !Number.isFinite(scrollHeight)) {
    return false;
  }

  // Two degenerate cases, one guard. Content that fits inside the viewport
  // cannot be scrolled, and a container measured before layout reports every
  // metric as zero; both read as "at the bottom" in the arithmetic below, and
  // neither can be changed by a scroll event, so a yes here repeats on every
  // render with nothing to end it. Filling a short viewport is the initial
  // chunk's job, not the scroll handler's.
  if (scrollHeight <= clientHeight) {
    return false;
  }

  // Evidence of an actual scroll, because a list nobody has touched has no
  // bottom to have reached. Cohtml fills a scroll container over several frames
  // — the same list read scrollHeight 1,440 and then 3,606 a frame or two later
  // — so a window still being laid out reports a short content height that sits
  // inside this band. Measured live 2026-08-09: without this rule the unscoped
  // lens grew itself from 100 rows to 200 on mount. "Still being laid out" and
  // "already at the end" are the same three numbers; only the scroll position
  // tells them apart.
  if (scrollTop <= 0) {
    return false;
  }

  const band = Number.isFinite(threshold) ? (threshold as number) : CATALOG_WINDOW_SCROLL_THRESHOLD;

  return scrollHeight - clientHeight - scrollTop <= band;
}

/**
 * The limit to ask for next, clamped to what exists.
 *
 * `maxLimit` is the size of the match set the backend reported, so the window
 * stops growing exactly when it holds everything.
 */
export function nextWindowLimit(currentLimit: number, step: number, maxLimit: number): number {
  const current = Number.isFinite(currentLimit) ? Math.max(0, Math.floor(currentLimit)) : 0;

  // Not knowing how much exists is not a licence to ask for more of it.
  if (!Number.isFinite(maxLimit)) {
    return current;
  }

  const ceiling = Math.max(0, Math.floor(maxLimit));

  // A step that cannot make progress is a caller bug, and a window that visibly
  // stops growing is easier to trace than one that crawls a row at a time.
  if (!Number.isFinite(step) || step <= 0) {
    return Math.min(ceiling, current);
  }

  return Math.min(ceiling, current + Math.floor(step));
}

/**
 * Where to scroll so a remembered row is back on screen.
 *
 * Placing a building unmounts the whole lens, so "reopen" happens after every
 * single placement — losing your place on every place is the actual cost the
 * pager design carried. The row is found by id rather than by pixel offset
 * because between unmount and remount the geometry legitimately changes: the
 * window can come back a different length, expanded rows are `height: auto`,
 * density tiers give different row heights, and the grid's shelf appears and
 * disappears with the search text.
 *
 * Positioned a third of the way down rather than flush to the top, so the rows
 * either side come back too and the player can see where they are rather than
 * just what they picked.
 *
 * Takes numbers, not elements, because the geometry is the only part worth
 * testing — the DOM walk that produces them belongs to the component.
 */
export function anchorScrollTop(
  currentScrollTop: number,
  anchorTop: number,
  containerTop: number,
  containerHeight: number,
): number {
  if (![currentScrollTop, anchorTop, containerTop, containerHeight].every(Number.isFinite)) {
    return currentScrollTop;
  }

  const delta = anchorTop - containerTop - containerHeight / 3;

  // Never negative: a row near the top of a short list would otherwise ask for
  // a scroll above the start, which some engines clamp and some do not.
  return Math.max(0, currentScrollTop + delta);
}

/**
 * How many frames the restore is allowed to keep trying for.
 *
 * The first attempt always fails, so this is a budget rather than a safety net.
 * See {@link isAnchorMeasurable} for why. Thirty frames is half a second at
 * 60Hz — long enough for the window to arrive from C# and lay out, short enough
 * that a genuinely unreachable anchor gives up before the player has scrolled
 * somewhere themselves.
 */
export const CATALOG_ANCHOR_MAX_FRAMES = 30;

/**
 * How much a container must overflow before it counts as the one that scrolls.
 *
 * Not zero, because sub-pixel layout rounding manufactures overflow that no
 * player can use. Measured live 2026-08-09: the grid's inner tiles container
 * reported scrollHeight 382 against clientHeight 381 — one pixel — and a walk
 * looking for `scrollHeight > clientHeight` stopped there instead of continuing
 * to the real scroll container above it. Its scrollTop is pinned at 0, so the
 * load-more check read "top of the list" no matter where the player actually
 * was, and the window never grew.
 *
 * Eight pixels is well under a row and well over rounding.
 */
export const CATALOG_SCROLL_MIN_OVERFLOW = 8;

/** Whether this element is deep enough past its viewport to be the scroller. */
export function isScrollContainer(scrollHeight: number, clientHeight: number): boolean {
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight)) {
    return false;
  }

  return scrollHeight - clientHeight >= CATALOG_SCROLL_MIN_OVERFLOW;
}

export interface AnchorGeometry {
  containerTop: number;
  containerHeight: number;
  rowTop: number;
  rowHeight: number;
}

/**
 * Whether these rects are real measurements or Cohtml's pre-layout zeroes.
 *
 * Measured live, 2026-08-09: on the frame the catalog remounts, Cohtml reports
 * `getBoundingClientRect()` as all zeroes for both the scroll container and the
 * rows inside it — the panel's real top is 163 and the anchored row's is 2174,
 * and both read 0 until a later frame. A browser flushes layout synchronously
 * when you ask for a rect; this engine does not.
 *
 * That is what made the first restore silently do nothing: it measured in a
 * `useEffect`, got zeroes, and `anchorScrollTop(0, 0, 0, h)` is `max(0, -h/3)`,
 * which is 0 — the top of the list, indistinguishable from never having tried.
 *
 * A zero height is the tell. A container laid out at the very top of the
 * viewport legitimately has `top === 0`, so top alone cannot be the test.
 */
export function isAnchorMeasurable({ containerHeight, rowHeight }: AnchorGeometry): boolean {
  return (
    Number.isFinite(containerHeight) &&
    Number.isFinite(rowHeight) &&
    containerHeight > 0 &&
    rowHeight > 0
  );
}

/**
 * Whether the anchored row ended up on screen.
 *
 * The apply step is a guess: it is computed from one frame's geometry and
 * applied to a list that may still be growing, so it needs checking rather than
 * trusting. Any overlap with the viewport counts as landed — asking for the
 * exact third-of-the-way position back would restart the loop over a few pixels
 * of drift while rows continue to arrive.
 */
export function isAnchorOnScreen(geometry: AnchorGeometry): boolean {
  if (!isAnchorMeasurable(geometry)) {
    return false;
  }

  const { containerTop, containerHeight, rowTop, rowHeight } = geometry;

  return rowTop + rowHeight > containerTop && rowTop < containerTop + containerHeight;
}
