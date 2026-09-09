import { ModuleRegistryExtend } from "cs2/modding";
import { bindValue, useValue } from "cs2/api";
import mod from "../../../mod.json";

const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);
/**
 * Keeps the game's options bank on screen while the lens owns the menu.
 *
 * The bank only shows for an active tool, and the lens has no tool: it puts
 * availability into that bank (cm-2xvs.15), so without this the control would
 * be drawn into a panel the game never mounts while browsing — which is
 * exactly how five dimensions ended up reachable from nowhere once.
 *
 * It used to hold the bank open for the object picker too; that tool went
 * with the Find It separation. And it once forced the bank visible for a lens
 * whose filters had moved to the control plane, which kept an EMPTY bank on
 * screen — an 8px wrapper with a gradient, drawing a dark bar beside where the
 * menu had been. Measured against vanilla before removing that: the bulldozer
 * mounts the panel with its options and takes it away on deactivate, so a
 * panel left behind empty was ours.
 */
export const ToolOptionsVisibility: ModuleRegistryExtend = (Component: any) => {
  return () => {
    const lensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);

    return Component() || lensOwnsCurrentMenu;
  };
};
