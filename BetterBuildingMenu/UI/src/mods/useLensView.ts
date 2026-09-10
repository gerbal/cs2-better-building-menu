import { useSyncExternalStore } from "react";
import { getLensView, subscribeLensView, type LensView } from "domain/lensViewStore";

/**
 * One field of the lens view store as React state, shared across subtrees. The
 * selector must return a primitive or one of the store's own sub-objects:
 * useSyncExternalStore compares by identity, so a fresh object never settles.
 */
export function useLensView<T>(selector: (view: LensView) => T): T {
  return useSyncExternalStore(
    subscribeLensView,
    () => selector(getLensView()),
    () => selector(getLensView())
  );
}
