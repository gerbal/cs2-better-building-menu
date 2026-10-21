/**
 * Every command the UI sends, one builder per trigger. C#'s names and argument
 * types come from sharedContracts.generated.ts, so a builder that no longer
 * matches its registration fails the typecheck.
 */
import type { MetricRangeId } from "./buildingCatalogRanges";
import type { GroupDimensionId, SortColumn, TriggerArgs } from "./sharedContracts.generated";
import { joinEntityIndices, type VanillaToolbarState } from "./vanillaToolbarSelection";

type TriggerName = keyof TriggerArgs;

type TriggerCommand<K extends TriggerName> = { method: K; args: Readonly<TriggerArgs[K]> };

/** A command to the mod's C# side: a trigger it registers and the arguments that trigger reads. */
export type Command = { [K in TriggerName]: TriggerCommand<K> }[TriggerName];

function createTriggerCommand<K extends TriggerName>(method: K, ...args: TriggerArgs[K]): TriggerCommand<K> {
  return { method, args };
}

// --- Search and the catalog window -------------------------------------------

export const searchChangedCommand = (value: string): Command => createTriggerCommand("SearchChanged", value);
/** Widens a search that found nothing here to the whole catalog. */
export const searchEverythingCommand = (): Command => createTriggerCommand("SearchEverything");
// Names the limit wanted, so a request sent twice (a double click, the scroll
// poll firing again before the answer lands) grows the window once. The backend
// still owns the step and the ceiling and clamps the request to both.
export const loadMoreCatalogCommand = (requestedLimit: number): Command =>
  createTriggerCommand("LoadMoreBuildingCatalog", requestedLimit);

// --- Order and grouping -----------------------------------------------------

export const setSortColumnCommand = (column: SortColumn): Command => createTriggerCommand("SetBuildingCatalogSortColumn", column);
export const setSortDescendingCommand = (descending: boolean): Command =>
  createTriggerCommand("SetBuildingCatalogSortDescending", descending);
export const setBuildingCatalogGroupByCommand = (dimension: GroupDimensionId): Command =>
  createTriggerCommand("SetBuildingCatalogGroupBy", dimension);

// --- Filters ----------------------------------------------------------------

export const toggleAssetMenuFacetCommand = (facetId: string, optionId: string): Command =>
  createTriggerCommand("ToggleAssetMenuFacet", facetId, optionId);
export const setBuildingCatalogMetricRangeCommand = (id: MetricRangeId, minText: string, maxText: string): Command =>
  createTriggerCommand("SetBuildingCatalogMetricRange", id, minText, maxText);
export const clearBuildingCatalogMetricRangesCommand = (): Command => createTriggerCommand("ClearBuildingCatalogMetricRanges");
export const clearAssetMenuFiltersCommand = (): Command => createTriggerCommand("ClearAssetMenuFilters");

// --- The menu and its strip -------------------------------------------------

export const setAssetMenuCommand = (menu: string): Command => createTriggerCommand("SetAssetMenu", menu);
export const setAssetMenuCategoryCommand = (category: string): Command => createTriggerCommand("SetAssetMenuCategory", category);
export const setAssetMenuStripTabCommand = (tab: string): Command => createTriggerCommand("SetAssetMenuStripTab", tab);
export const setAssetMenuSchoolTierCommand = (tier: number): Command => createTriggerCommand("SetAssetMenuSchoolTier", tier);
export const clearAssetMenuScopeCommand = (): Command => createTriggerCommand("ClearAssetMenuScope");
/** Puts the menu back the way it opens. */
export const resetAssetMenuCommand = (): Command => createTriggerCommand("ResetAssetMenu");

// --- The asset menu's size and view -----------------------------------------

/** A height to draw now; C# keeps it once the drag commits. */
export const setAssetMenuHeightCommand = (height: number): Command => createTriggerCommand("SetAssetMenuHeight", height);
export const commitAssetMenuHeightCommand = (): Command => createTriggerCommand("CommitAssetMenuHeight");
/** A width to draw now; C# keeps it once the drag commits. */
export const setAssetMenuCatalogWidthCommand = (width: number): Command => createTriggerCommand("SetAssetMenuCatalogWidth", width);
export const commitAssetMenuCatalogWidthCommand = (): Command => createTriggerCommand("CommitAssetMenuCatalogWidth");
export const setControlPaneShownCommand = (shown: boolean): Command => createTriggerCommand("SetControlPaneShown", shown);
/** The view the player picked, or "" for none, which C# keeps for the next session. */
export const setAssetMenuViewModeCommand = (viewMode: string): Command => createTriggerCommand("SetAssetMenuViewMode", viewMode);

// --- The game's toolbar, forwarded ------------------------------------------

/** Hands a toolbar menu selection to the backend, which resolves its preset. */
export const vanillaMenuSelectedCommand = (entityIndex: number): Command => createTriggerCommand("VanillaMenuSelected", entityIndex);

/** Tells the backend the toolbar dropped its menu, so the asset menu should go too. */
export const vanillaMenuDeselectedCommand = (): Command => createTriggerCommand("VanillaMenuDeselected");

/** Hands the game's filter row to the backend, which applies vanilla's own rule to it. */
export const setVanillaToolbarSelectionCommand = (state: VanillaToolbarState): Command =>
  createTriggerCommand(
    "SetVanillaToolbarSelection",
    joinEntityIndices(state.themes),
    joinEntityIndices(state.packs),
    state.vanillaSelected,
    state.modsSelected,
  );
