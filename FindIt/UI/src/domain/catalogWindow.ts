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
