import { getAssetMenuView, subscribeAssetMenuView, type AssetMenuView } from "domain/assetMenuViewStore";
import { usePanelStore } from "mods/panelValue";

/**
 * One field of the asset menu view store as React state, shared across subtrees. The
 * selector must return a primitive or one of the store's own sub-objects:
 * useSyncExternalStore compares by identity, so a fresh object never settles. Held
 * still in a frozen kept panel (see mods/panelValue).
 */
export function useAssetMenuView<T>(selector: (view: AssetMenuView) => T): T {
  return usePanelStore(subscribeAssetMenuView, () => selector(getAssetMenuView()));
}
