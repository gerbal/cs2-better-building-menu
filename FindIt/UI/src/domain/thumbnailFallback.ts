/**
 * One error handler for every result thumbnail in the lens.
 *
 * The game's thumbnail camera returns a URL for every prefab but only renders
 * the ones vanilla shows in a menu. A spawnable zone building therefore has a
 * perfectly well-formed `thumbnail://ThumbnailCamera/...` that loads as an empty
 * box — which is why a `??` in C# cannot fix this: the URL is not null, it just
 * draws nothing, and only the image element finds that out.
 *
 * Upstream FindIt handles this per-component in PrefabItem; the lens draws
 * results in four places, so the rule lives here instead of being copied four
 * times and drifting.
 */

/** Swap in the fallback once, then stop — a failing fallback must not loop. */
export const applyThumbnailFallback = (
  image: HTMLImageElement,
  fallback: string | undefined
): void => {
  image.onerror = null;
  if (fallback && image.src !== fallback) {
    image.src = fallback;
    return;
  }
  // Nothing left to try. Hide the broken image rather than leave the engine's
  // placeholder sitting where an icon should be.
  image.style.visibility = "hidden";
};

/** `onError` handler for a result thumbnail. */
export const thumbnailErrorHandler =
  (fallback: string | undefined) =>
  ({ currentTarget }: { currentTarget: HTMLImageElement }): void =>
    applyThumbnailFallback(currentTarget, fallback);
