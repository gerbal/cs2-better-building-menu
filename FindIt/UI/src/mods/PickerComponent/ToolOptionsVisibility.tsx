import { ModuleRegistryExtend } from "cs2/modding";
import { tool } from "cs2/bindings";
import { bindValue } from "cs2/api";
import mod from "../../../mod.json";

const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel", false);
const BuildingLensEnabled$ = bindValue<boolean>(mod.id, "BuildingLensEnabled", false);

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
    || (ShowFindItPanel$.value && BuildingLensEnabled$.value);
};
