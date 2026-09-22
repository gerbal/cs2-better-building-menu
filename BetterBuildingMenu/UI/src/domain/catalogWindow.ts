/**
 * The arithmetic behind the catalog's growing window. Backend-owned: the offset
 * stays at zero and the window grows by asking for a larger limit, because
 * placing a building unmounts the lens and an accumulator would go with it.
 */

/**
 * How close to the bottom counts as "nearly there" — a few rows of runway, so
 * the round trip through C# lands first. Smaller than the shortest catalog
 * viewport, or the band would already be satisfied at scrollTop 0.
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

  // Two degenerate cases, one guard: content that fits the viewport, and a
  // container measured before layout. Both read as "at the bottom" below and
  // neither a scroll event can change, so a yes here would never end.
  if (scrollHeight <= clientHeight) {
    return false;
  }

  // Evidence of an actual scroll: Cohtml fills a scroll container over several
  // frames, so a window still laying out reports a content height inside this
  // band, and only the scroll position tells that from "at the end".
  if (scrollTop <= 0) {
    return false;
  }

  const band = Number.isFinite(threshold) ? (threshold as number) : CATALOG_WINDOW_SCROLL_THRESHOLD;

  return scrollHeight - clientHeight - scrollTop <= band;
}

/**
 * How many rows one Load more adds: BuildingCatalogQuery.WindowStep, which a
 * test reads from the C# so the two cannot drift.
 */
export const CATALOG_WINDOW_STEP = 100;

/** The count the Load more button names: one step, or what is left when less. */
export function loadMoreCount(remaining: number): number {
  return Math.min(remaining, CATALOG_WINDOW_STEP);
}

/**
 * The limit to ask for next, clamped to what exists: `maxLimit` is the match
 * set the backend reported, so the window stops growing when it holds it all.
 */
export function nextWindowLimit(currentLimit: number, step: number, maxLimit: number): number {
  const current = Number.isFinite(currentLimit) ? Math.max(0, Math.floor(currentLimit)) : 0;

  // Not knowing how much exists is not a licence to ask for more of it.
  if (!Number.isFinite(maxLimit)) {
    return current;
  }

  const ceiling = Math.max(0, Math.floor(maxLimit));

  // A step that cannot make progress is a caller bug, and a window that stops
  // growing is easier to trace than one crawling a row at a time.
  if (!Number.isFinite(step) || step <= 0) {
    return Math.min(ceiling, current);
  }

  return Math.min(ceiling, current + Math.floor(step));
}

/**
 * Where to scroll so a remembered row is back on screen, a third of the way
 * down rather than flush to the top so its neighbours come back with it. Takes
 * numbers, not elements: the DOM walk that produces them is the component's.
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
 * How many frames the restore is allowed to keep trying for. A budget, not a
 * safety net — the first attempt always fails, see {@link isAnchorMeasurable} —
 * and short enough to give up before the player has scrolled somewhere else.
 */
export const CATALOG_ANCHOR_MAX_FRAMES = 30;

/**
 * How much a container must overflow before it counts as the one that scrolls.
 * Not zero: sub-pixel rounding manufactures a pixel no player can use, and a
 * walk looking for any overflow stops at the wrong element.
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
 * Whether these rects are real measurements or Cohtml's pre-layout zeroes: a
 * browser flushes layout when asked for a rect, this engine does not. A zero
 * HEIGHT is the tell, since an element at the top legitimately has top === 0.
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
 * Whether the anchored row ended up on screen. Any overlap with the viewport
 * counts as landed: the scroll was computed from one frame's geometry against a
 * list still growing, and demanding the exact position would never settle.
 */
export function isAnchorOnScreen(geometry: AnchorGeometry): boolean {
  if (!isAnchorMeasurable(geometry)) {
    return false;
  }

  const { containerTop, containerHeight, rowTop, rowHeight } = geometry;

  return rowTop + rowHeight > containerTop && rowTop < containerTop + containerHeight;
}

/**
 * What the window is holding back, for the footer to say out loud, so a
 * truncated list is legible as one. Null rather than 0 when nothing is held
 * back, so the caller draws no footer instead of "Load 0 more".
 */
export interface CatalogWindowState {
  shown: number;
  total: number;
}

export function catalogWindowRemaining({ shown, total }: CatalogWindowState): number | null {
  const remaining = total - shown;

  return remaining > 0 ? remaining : null;
}

/** The measurements a reveal needs, all in viewport coordinates. */
export interface RevealGeometry {
  currentScrollTop: number;
  /** Top of the row that expanded — what must stay visible. */
  rowTop: number;
  /** Bottom of the expanded detail — what should become visible. */
  detailBottom: number;
  containerTop: number;
  containerHeight: number;
  /** Breathing room below the last line. */
  margin?: number;
}

/**
 * Scroll just enough to bring an expanded row's detail into view, BY THE
 * OVERFLOW ONLY, since this fires on every expand. Never past the row's own
 * top, so the name stays with its numbers; never upward; never on a NaN.
 */
export function revealScrollTop({
  currentScrollTop,
  rowTop,
  detailBottom,
  containerTop,
  containerHeight,
  margin = 0,
}: RevealGeometry): number {
  const measurements = [currentScrollTop, rowTop, detailBottom, containerTop, containerHeight, margin];

  if (!measurements.every(Number.isFinite)) {
    return currentScrollTop;
  }

  const overflow = detailBottom + margin - (containerTop + containerHeight);

  if (overflow <= 0) {
    return currentScrollTop;
  }

  // Whichever is less: what the overflow asks for, or what keeps the row's top
  // at the container's top edge.
  const headroom = Math.max(0, rowTop - containerTop);

  return currentScrollTop + Math.min(overflow, headroom);
}
