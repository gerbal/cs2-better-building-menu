import { useSyncExternalStore } from "react";
import { getAssetMenuView, subscribeAssetMenuView, type AssetMenuView } from "domain/assetMenuViewStore";

/**
 * One field of the asset menu view store as React state, shared across subtrees. The
 * selector must return a primitive or one of the store's own sub-objects:
 * useSyncExternalStore compares by identity, so a fresh object never settles.
 */
export function useAssetMenuView<T>(selector: (view: AssetMenuView) => T): T {
  return useSyncExternalStore(
    subscribeAssetMenuView,
    () => selector(getAssetMenuView()),
    () => selector(getAssetMenuView())
  );
}
