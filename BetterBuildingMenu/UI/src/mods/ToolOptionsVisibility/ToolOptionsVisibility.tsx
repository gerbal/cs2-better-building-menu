import { ModuleRegistryExtend } from "cs2/modding";
import { bindValue, useValue } from "cs2/api";
import mod from "../../../mod.json";

const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);
/**
 * Keeps the game's options bank on screen while the lens owns the menu. The
 * bank only shows for an active tool and browsing is not one, so without this
 * the availability control would be drawn into a panel the game never mounts.
 */
export const ToolOptionsVisibility: ModuleRegistryExtend = (Component: any) => {
  return () => {
    const lensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);

    return Component() || lensOwnsCurrentMenu;
  };
};
