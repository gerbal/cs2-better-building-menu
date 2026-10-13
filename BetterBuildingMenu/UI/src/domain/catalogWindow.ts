/**
 * The arithmetic behind the catalog's growing window. Backend-owned: the offset
 * stays at zero and the window grows by asking for a larger limit, because
 * placing a building unmounts the asset menu and an accumulator would go with it.
 */
import { wholeLines } from "./bodyGeometry";
import { CATALOG_WINDOW_STEP } from "./sharedContracts.generated";

/**
 * How close to the bottom counts as "nearly there" — a few rows of runway, so
 * the round trip through C# lands first. It can be taller than a short body,
 * so only a scroll arms it: shouldLoadMore refuses at scrollTop 0.
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

// How many rows one Load more adds: BuildingCatalogQuery.WindowStep, generated.
export { CATALOG_WINDOW_STEP };

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
 * Where to scroll so a row sits on the list's first line, as an open puts the armed building: `edge`
 * below the list's top, the room the body's lines keep for a picture that overhangs its plate (see
 * `bodyLines`). Never negative, for the reason anchorScrollTop is not.
 */
export function lineOneScrollTop(currentScrollTop: number, rowTop: number, containerTop: number, edge: number): number {
  if (![currentScrollTop, rowTop, containerTop].every(Number.isFinite)) {
    return currentScrollTop;
  }

  return Math.max(0, currentScrollTop + rowTop - containerTop - edge);
}

/**
 * The scroll a screen down, or up, from here, held inside the list's ends: an engine need not clamp a
 * scroll set past them. With a line pitch, the screen is the whole lines that fit it, counted as the
 * body counts them (`wholeLines`, the gap and the edge in the height's unit), so a page lands lines on
 * the top edge as it found them; a pitch of 0 pages the screen. The gap and the edge have no default,
 * so no caller pages a line short or a line long.
 */
export function pageScrollTop(scrollTop: number, clientHeight: number, scrollHeight: number, direction: 1 | -1, linePitch: number, lineGap: number, pixel: number, edge: number): number {
  const page = linePitch > 0 ? wholeLines(clientHeight, linePitch, lineGap, pixel, edge) * linePitch : clientHeight;

  return Math.max(0, Math.min(scrollHeight - clientHeight, scrollTop + direction * page));
}

/**
 * Where to scroll so a row is wholly on screen, moving as little as it takes: up to its top, or down
 * until its bottom meets the list's foot; where it already is, nowhere. A row reaches `edge` past its
 * plate above and below, where a picture overhangs it (see `bodyLines`). Never negative.
 */
export function revealScrollTop(scrollTop: number, rowTop: number, rowHeight: number, containerTop: number, containerHeight: number, edge: number): number {
  if (![scrollTop, rowTop, rowHeight, containerTop, containerHeight].every(Number.isFinite)) {
    return scrollTop;
  }

  if (rowTop - edge < containerTop) {
    return Math.max(0, scrollTop + rowTop - edge - containerTop);
  }

  const overrun = rowTop + rowHeight + edge - (containerTop + containerHeight);

  return overrun > 0 ? scrollTop + overrun : scrollTop;
}

/**
 * Whether a row sits on the first line, `edge` below the list's top (see `lineOneScrollTop`), to a
 * pixel: Cohtml rounds line boxes to whole device pixels.
 */
export function isOnLineOne({ containerTop, rowTop }: AnchorGeometry, edge: number): boolean {
  return Math.abs(rowTop - containerTop - edge) <= 1;
}

/**
 * How many frames each move of the list may take: a start's row onto line 1 or
 * list to its top, or a remount's restore. Room for Cohtml's pre-layout zeroes,
 * see {@link isAnchorMeasurable}, and short enough to give up before the player
 * has scrolled somewhere else.
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
