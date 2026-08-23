import { ModuleRegistryExtend } from "cs2/modding";
import { tool } from "cs2/bindings";
import { bindValue, useValue } from "cs2/api";
import mod from "../../../mod.json";

const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);
/**
 * Keeps the game's options bank on screen for the Picker.
 *
 * The bank only shows for an active tool, and the Picker needs its options
 * reachable while nothing is armed.
 *
 * It used to force the bank visible for the LENS too, back when the lens's
 * filters were injected into that bank beside Theme and Pack. They render in
 * the control plane now, so the clause was keeping an EMPTY bank on screen:
 * an 8px wrapper with no children and a background gradient, drawing a dark
 * bar to the left of where the menu had been, which outlived the menu because
 * nothing since had a reason to take it down.
 *
 * Measured against vanilla's own behaviour before removing it — the bulldozer
 * mounts that panel at 34px with its options and takes it away on deactivate,
 * so a panel left behind empty was ours.
 */
export const ToolOptionsVisibility: ModuleRegistryExtend = (Component: any) => {
  return () => {
    const lensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);

    return Component()
      || tool.activeTool$.value.id === "FindItBuildingMenu.Picker"
      // The lens is back, and this time with something to put in the bank.
      // The clause removed above was keeping an EMPTY panel on screen because
      // the filters had moved to the control plane; availability moved back
      // (cm-2xvs.15), so the bank has content again and the reason returns
      // with it. Without this the control would be drawn into a panel the
      // game never mounts while browsing — which is exactly how five
      // dimensions ended up reachable from nowhere the last time.
      || lensOwnsCurrentMenu;
  };
};
