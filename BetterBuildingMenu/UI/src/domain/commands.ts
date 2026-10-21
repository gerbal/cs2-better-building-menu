/**
 * Every command the UI sends, one builder per trigger. C#'s names and argument
 * types come from sharedContracts.generated.ts, so a builder that no longer
 * matches its registration fails the typecheck.
 */
import type { MetricRangeId } from "./buildingCatalogRanges";
import type { SortColumn, TriggerArgs } from "./sharedContracts.generated";
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
// Names the limit wanted, so a request sent twice (a double click, the scroll
// poll firing again before the answer lands) grows the window once. The backend
// still owns the step and the ceiling and clamps the request to both.
export const loadMoreCatalogCommand = (requestedLimit: number): Command =>
  createTriggerCommand("LoadMoreBuildingCatalog", requestedLimit);

// --- Order ------------------------------------------------------------------

export const setSortColumnCommand = (column: SortColumn): Command => createTriggerCommand("SetBuildingCatalogSortColumn", column);
export const setSortDescendingCommand = (descending: boolean): Command =>
  createTriggerCommand("SetBuildingCatalogSortDescending", descending);

// --- Filters ----------------------------------------------------------------

export const toggleAssetMenuFacetCommand = (facetId: string, optionId: string): Command =>
  createTriggerCommand("ToggleAssetMenuFacet", facetId, optionId);
export const setBuildingCatalogMetricRangeCommand = (id: MetricRangeId, minText: string, maxText: string): Command =>
  createTriggerCommand("SetBuildingCatalogMetricRange", id, minText, maxText);
export const clearBuildingCatalogMetricRangesCommand = (): Command => createTriggerCommand("ClearBuildingCatalogMetricRanges");
export const clearAssetMenuFiltersCommand = (): Command => createTriggerCommand("ClearAssetMenuFilters");

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
