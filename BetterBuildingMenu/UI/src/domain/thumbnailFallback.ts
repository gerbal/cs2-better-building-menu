/**
 * One error handler for every result thumbnail in the lens. The thumbnail
 * camera returns a well-formed URL for every prefab but renders only what
 * vanilla shows, so only the image element finds out. One rule, not four.
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
  // Nothing left to try: hide the broken image rather than leave the engine's
  // placeholder where an icon should be.
  image.style.visibility = "hidden";
};

/** `onError` handler for a result thumbnail. */
export const thumbnailErrorHandler =
  (fallback: string | undefined) =>
  ({ currentTarget }: { currentTarget: HTMLImageElement }): void =>
    applyThumbnailFallback(currentTarget, fallback);
