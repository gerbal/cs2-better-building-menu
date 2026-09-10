import { ModuleRegistryExtend } from "cs2/modding";
import { bindValue } from "cs2/api";
import mod from "../../../mod.json";

export const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);

/**
 * Keeps the game's options bank on screen while the lens owns the menu. The
 * bank only shows for an active tool and browsing is not one.
 *
 * Reads the binding without a hook, deliberately: the game can add this
 * module to a page whose panel is already mounted, and a wrapper that added a
 * hook to the vanilla hook's sequence would throw on that panel's next render
 * and take the whole UI down. ToolOptionsPanelRefresh re-renders the panel
 * when ownership changes.
 */
export const ToolOptionsVisibility: ModuleRegistryExtend = (Component: any) => {
  return () => {
    const lensOwnsCurrentMenu = LensOwnsCurrentMenu$.value;

    return Component() || lensOwnsCurrentMenu;
  };
};
