import { ownsSelectedMenu } from "domain/menuOwnership";
import { toolbarEntityIndex } from "domain/vanillaMenuWatch";
import { OwnedAssetMenus$, OwnsCurrentMenu$, ReplaceVanillaBuildMenu$, SelectedAssetMenu$ } from "mods/bindings";

/** The game's hook for whether the tool options bank shows. */
export type ToolOptionsVisibleHook = () => boolean;

/**
 * Keeps the game's options bank on screen while the asset menu owns the menu. The
 * bank only shows for an active tool and browsing is not one.
 *
 * Reads the binding without a hook, deliberately: the game can add this
 * module to a page whose panel is already mounted, and a wrapper that added a
 * hook to the vanilla hook's sequence would throw on that panel's next render
 * and take the whole UI down. ToolOptionsPanelRefresh re-renders the panel
 * when ownership changes. Ownership is the asset menu's own rule (see
 * domain/menuOwnership), so the bank shows in the frame the asset menu does.
 */
export const ToolOptionsVisibility = (vanillaHook: ToolOptionsVisibleHook): ToolOptionsVisibleHook => {
  return () => {
    const ownsMenu = ownsSelectedMenu({
      replaceEnabled: ReplaceVanillaBuildMenu$.value,
      ownsCurrentMenu: OwnsCurrentMenu$.value,
      selectedIndex: toolbarEntityIndex(SelectedAssetMenu$.value),
      owned: OwnedAssetMenus$.value,
    });

    return vanillaHook() || ownsMenu;
  };
};
