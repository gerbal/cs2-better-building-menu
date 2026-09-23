import type { Command } from "./command";
import type { ActivatePrefabAction } from "./menuSurfaceContracts";
export type {
  ActivatePrefabAction,
  MenuSurfaceAction,
} from "./menuSurfaceContracts";
import type { MetricRangeId } from "./buildingCatalogRanges";
import type { NumberSeparators } from "./buildingLensMetricFormat";

/**
 * The UI's windowing rules in a pure module, so Node's browserless runner can
 * exercise the same commands the Gameface components fire and the payloads
 * cannot drift from the C# bindings.
 */
export const MAX_CATALOG_PAGE_SIZE = 500;

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

export const setCurrentPrefabCommand = (id: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId: id });
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

export function normalizeCatalogPageSize(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(MAX_CATALOG_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}

export function normalizeCapacityFloor(floor: number): number {
  if (!Number.isFinite(floor)) {
    return 0;
  }

  return Math.min(10000, Math.max(0, Math.floor(floor)));
}

/**
 * Group digits the way `groupDigits` does, for counts. Duplicated because a
 * runtime import between these modules resolves in webpack and not in the test
 * runner; `toLocaleString` is no answer, doing nothing in Cohtml.
 */
function groupCount(value: number, separators: NumberSeparators): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separators.group);
}

/**
 * The same fact as {@link getCatalogWindowSummary}, short enough for a badge —
 * the sentence belongs in the tooltip. Collapses to a single figure once the
 * window covers everything, rather than print one number twice.
 */
export function getCatalogWindowBadge(
  renderedCount: number,
  totalCount: number,
  separators: NumberSeparators,
): string {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeRendered = Math.max(0, Math.floor(Number.isFinite(renderedCount) ? renderedCount : 0));
  const shown = Math.min(safeRendered, safeTotal);
  const total = groupCount(safeTotal, separators);

  return shown === safeTotal ? total : `${groupCount(shown, separators)} / ${total}`;
}

/**
 * How much of the match set is on screen, for a window that grows rather than
 * a page that turns.
 */
export function getCatalogWindowSummary(
  renderedCount: number,
  totalCount: number,
  separators: NumberSeparators,
): string {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeRendered = Math.max(0, Math.floor(Number.isFinite(renderedCount) ? renderedCount : 0));
  // A narrowing predicate shrinks the total while the previous rows are still
  // mounted, and a shown count above the total reads as a bug.
  const shown = Math.min(safeRendered, safeTotal);

  return `Showing ${groupCount(shown, separators)} of ${groupCount(safeTotal, separators)}`;
}

