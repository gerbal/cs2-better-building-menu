import { ModuleRegistryExtend } from "cs2/modding";
import { tool } from "cs2/bindings";
import { bindValue } from "cs2/api";
import mod from "../../../mod.json";

const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel", false);

/**
 * Keeps the game's options bank on screen while the lens is browsing.
 *
 * The bank only shows for an active tool, and the lens is usually open with
 * nothing armed — which is exactly when its filters need to be reachable. The
 * Picker already forced it visible for the same reason.
 */
export const ToolOptionsVisibility: ModuleRegistryExtend = (Component: any) => {
  return () =>
    Component()
    || tool.activeTool$.value.id === "FindItBuildingMenu.Picker"
    // Was ANDed with BuildingLensEnabled$, a latch that is gone: the lens
    // replaces vanilla's menu rather than being one of two things the panel
    // might be showing, so the panel being up is the whole condition.
    || ShowFindItPanel$.value;
};
