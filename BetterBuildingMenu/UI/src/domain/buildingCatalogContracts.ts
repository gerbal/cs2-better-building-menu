/**
 * The catalog's commands in a pure module, so Node's browserless runner can
 * exercise the same commands the Gameface components fire and the payloads
 * cannot drift from the C# bindings.
 */
import type { Command } from "./command";
import type { MetricRangeId } from "./buildingCatalogRanges";

export type SortColumn =
  | "Default"
  | "Name"
  | "Category"
  | "ConstructionCost"
  | "Upkeep"
  | "Workers"
  | "Capacity"
  | "LotWidth"
  | "LotDepth"
  | "BuildingLevel"
  | "HasParking";

export interface TriggerCommand extends Command {
  args: readonly (string | number | boolean)[];
}

export interface SortState {
  column: SortColumn;
  descending: boolean;
}

export function createTriggerCommand(method: string, ...args: (string | number | boolean)[]): TriggerCommand {
  return { method, args };
}

export const setSortColumnCommand = (column: SortColumn): TriggerCommand => createTriggerCommand("SetBuildingCatalogSortColumn", column);
export const setSortDescendingCommand = (descending: boolean): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogSortDescending", descending);
// Names the limit wanted, so a request sent twice (a double click, the scroll
// poll firing again before the answer lands) grows the window once. The backend
// still owns the step and the ceiling and clamps the request to both.
export const loadMoreCatalogCommand = (requestedLimit: number): TriggerCommand =>
  createTriggerCommand("LoadMoreBuildingCatalog", requestedLimit);
export const setBuildingCatalogMetricRangeCommand = (id: MetricRangeId, minText: string, maxText: string): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogMetricRange", id, minText, maxText);
export const clearBuildingCatalogMetricRangesCommand = (): TriggerCommand =>
  createTriggerCommand("ClearBuildingCatalogMetricRanges");
export const searchChangedCommand = (value: string): TriggerCommand => createTriggerCommand("SearchChanged", value);

export function nextSortState(current: SortState, column: SortColumn): SortState {
  return {
    column,
    descending: column === current.column ? !current.descending : false,
  };
}

