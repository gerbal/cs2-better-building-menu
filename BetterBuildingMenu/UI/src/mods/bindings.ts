import { bindValue, trigger } from "cs2/api";
import mod from "../../mod.json";
import type { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";
import { nextSortState, setSortColumnCommand, setSortDescendingCommand } from "domain/buildingCatalogContracts";
import type { SortColumn, SortState } from "domain/buildingCatalogContracts";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "domain/buildingLensFilterSummary";
import type { Command } from "domain/command";
import type { MenuBranchCount, MenuCategoryTabs } from "domain/menuProgression";
import type { ToolbarEntity } from "domain/toolbarEntity";
import { UPSTREAM_FINDIT_GROUP, UPSTREAM_SHOW_PANEL } from "domain/upstreamFindIt";
import type { MenuCategoryCount, VanillaMenuCategory } from "domain/vanillaMenuCategories";

/*
 * Every binding the UI reads, declared once with one fallback. A second
 * declaration is a second subscription and a chance to disagree about the
 * value shown before C# first publishes.
 */

// --- The catalog ------------------------------------------------------------

export type BuildingCatalogPageStatus = "indexing" | "ready" | "empty";
export type BuildingCatalogBindingPage = BuildingCatalogPage & { status?: BuildingCatalogPageStatus };

export const BuildingCatalog$ = bindValue<BuildingCatalogBindingPage | null>(mod.id, "BuildingCatalog", null);
export const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch", "");
export const IsSearchLoading$ = bindValue<boolean>(mod.id, "IsSearchLoading", false);
export const BuildingCatalogMatchesElsewhere$ = bindValue<number>(mod.id, "BuildingCatalogMatchesElsewhere", 0);
// The order and the grouping live in the backend query, which outlives every
// component, so reading them back keeps each remount honest.
export const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn", "Name");
export const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending", false);
export const BuildingCatalogGroupBy$ = bindValue<string>(mod.id, "BuildingCatalogGroupBy", "category");
export const BuildingLensGroupDimensions$ = bindValue<string[]>(mod.id, "BuildingLensGroupDimensions", []);
export const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
export const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState | null>(mod.id, "BuildingCatalogMetricRanges", null);
/** The spread each metric has in the current view, in the selection's shape. */
export const BuildingCatalogMetricBounds$ = bindValue<BuildingLensMetricRangeState | null>(mod.id, "BuildingCatalogMetricBounds", null);
/** The prefab the game has armed, drawn so the screen says what is about to be placed. */
export const ActivePrefabId$ = bindValue<number>(mod.id, "ActivePrefabId", 0);
export const BuildingLensMilestones$ = bindValue<string[]>(mod.id, "BuildingLensMilestones", []);

// --- The menu and its strip -------------------------------------------------

export const BuildingLensMenu$ = bindValue<string>(mod.id, "BuildingLensMenu", "");
export const BuildingLensMenus$ = bindValue<VanillaMenuCategory[]>(mod.id, "BuildingLensMenus", []);
export const BuildingLensMenuCategories$ = bindValue<VanillaMenuCategory[]>(mod.id, "BuildingLensMenuCategories", []);
export const BuildingLensMenuCategory$ = bindValue<string>(mod.id, "BuildingLensMenuCategory", "");
export const BuildingLensMenuCategoryCounts$ = bindValue<MenuCategoryCount[]>(mod.id, "BuildingLensMenuCategoryCounts", []);
export const BuildingLensMenuSchoolTier$ = bindValue<number>(mod.id, "BuildingLensMenuSchoolTier", -1);
export const BuildingLensMenuSchoolTierCounts$ = bindValue<MenuBranchCount[]>(mod.id, "BuildingLensMenuSchoolTierCounts", []);
export const BuildingLensStripTabs$ = bindValue<MenuBranchCount[]>(mod.id, "BuildingLensStripTabs", []);
export const BuildingLensStripTab$ = bindValue<string[]>(mod.id, "BuildingLensStripTab", []);
export const BuildingLensExpandedCategories$ = bindValue<MenuCategoryTabs[]>(mod.id, "BuildingLensExpandedCategories", []);

// --- The panel --------------------------------------------------------------

export const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth", 0);
/** The panel height the player last dragged to; see BuildingMenuUISystem.Bindings. */
export const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);
export const BuildingLensTileSize$ = bindValue<number>(mod.id, "BuildingLensTileSize", 72);
/** True while the toolbar's open menu is one the panel takes over. */
export const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);
/** The mod's replace-vanilla-menus setting: one switch for both pickers. */
export const ReplaceVanillaBuildMenu$ = bindValue<boolean>(mod.id, "ReplaceVanillaBuildMenu", false);

export interface BuildingExtensionMenuState {
  buildingName: string;
  entries: BuildingCatalogEntry[];
}

/** The catalog entries behind the selected building's upgrades; see BuildingExtensionMenu.cs. */
export const BuildingExtensionMenu$ = bindValue<BuildingExtensionMenuState>(
  mod.id,
  "BuildingExtensionMenu",
  { buildingName: "", entries: [] }
);

// --- The game's toolbar, and upstream Find It -------------------------------

export const SelectedAssetMenu$ = bindValue<ToolbarEntity | null>("toolbar", "selectedAssetMenu", null);
export const SelectedThemes$ = bindValue<ToolbarEntity[]>("toolbar", "selectedThemes", []);
// The game's pack selection, not ours: read so the rail shows what is ticked, and
// written so a rail toggle lands where vanilla's Pack row puts it. See
// domain/assetPackSelection.
export const SelectedAssetPacks$ = bindValue<ToolbarEntity[]>("toolbar", "selectedAssetPacks", []);
export const VanillaSelected$ = bindValue<boolean>("toolbar", "vanillaSelected", false);
export const ModsSelected$ = bindValue<boolean>("toolbar", "modsSelected", false);
// Upstream Find It's panel, when that mod is installed; the fallback covers its
// absence. See buildingMenuMount for why we yield to it.
export const FindItPanelShown$ = bindValue<boolean>(UPSTREAM_FINDIT_GROUP, UPSTREAM_SHOW_PANEL, false);

/** Sends a command to the mod's C# side. */
export function send(command: Command): void {
  trigger(mod.id, command.method, ...command.args);
}

/**
 * Sorts by a column: the next direction for it, sent as both halves. No local
 * echo, since the backend owns the order and publishes it back.
 */
export function sendSort(current: SortState, column: SortColumn): void {
  const next = nextSortState(current, column);

  send(setSortColumnCommand(next.column));
  send(setSortDescendingCommand(next.descending));
}
