import { getAssetMenuView } from "domain/assetMenuViewStore";
import type { GroupDimensionId } from "domain/buildingGroups";
import { chooseViewMode } from "domain/viewModeChoice";
import { AssetMenuViewMode$, BuildingCatalogGroupBy$ } from "mods/bindings";
import type { CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { DEFAULT_VIEW_MODE } from "mods/GroupedResults/ViewModeBar";
import { useValue } from "mods/panelValue";
import { useAssetMenuView } from "mods/useAssetMenuView";

/** What the catalog is drawn as: its view and its grouping. */
export interface ViewShape {
  viewMode: CatalogViewMode;
  groupBy: GroupDimensionId;
}

/**
 * One rule for every reader, so the catalog, the pane and the kept menu cannot
 * disagree: the view as chooseViewMode picks it, and the grouping C# resolved
 * (the player's choice, or the menu's default), category until it says.
 */
const shapeOf = (sessionPick: string, stored: string | null | undefined, groupBy: string | null | undefined): ViewShape => ({
  viewMode: chooseViewMode(sessionPick, stored, DEFAULT_VIEW_MODE),
  groupBy: (groupBy || "category") as GroupDimensionId,
});

/**
 * The view shape a component draws, held still in a frozen kept panel. The pick is
 * the shared store's, not useState: the pane is the catalog's sibling, and the pick
 * outlives the remount that placing a building causes.
 */
export function useViewShape(): ViewShape {
  return shapeOf(useAssetMenuView((view) => view.viewMode), useValue(AssetMenuViewMode$), useValue(BuildingCatalogGroupBy$));
}

/** The view shape the live store and bindings hold now, for code that runs outside a render. */
export function currentViewShape(): ViewShape {
  return shapeOf(getAssetMenuView().viewMode, AssetMenuViewMode$.value, BuildingCatalogGroupBy$.value);
}
