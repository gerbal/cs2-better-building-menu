import type { BuildingCatalogEntry } from "./buildingCatalog";
import type { ActivatePrefabAction, LocatePrefabAction, PickerOptionAction } from "./findItSurfaceContracts";
export type {
  ActivatePrefabAction,
  FindItSurfaceAction,
  LocatePrefabAction,
  PickerOptionAction,
} from "./findItSurfaceContracts";
import type { MetricRangeId } from "./buildingCatalogRanges";

/**
 * Keep the UI's bounded comparison and paging rules in a pure module.
 *
 * The Gameface components call the trigger commands from this module, while
 * the same contract can be exercised by Node's browserless test runner. This
 * prevents a payload drift between the React UI and the C# bindings.
 */
export const MAX_COMPARE_ENTRIES = 3;
export const MAX_CATALOG_PAGE_SIZE = 500;

export type SortColumn =
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

export interface TriggerCommand {
  method: string;
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
export const setCatalogOffsetCommand = (offset: number): TriggerCommand => createTriggerCommand("SetBuildingCatalogOffset", offset);
export const setBuildingCapacityFloorCommand = (floor: number): TriggerCommand =>
  createTriggerCommand("SetBuildingCapacityFloor", normalizeCapacityFloor(floor));
export const setBuildingCatalogMetricRangeCommand = (id: MetricRangeId, minText: string, maxText: string): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogMetricRange", id, minText, maxText);
export const clearBuildingCatalogMetricRangesCommand = (): TriggerCommand =>
  createTriggerCommand("ClearBuildingCatalogMetricRanges");
export const toggleCompareEntryCommand = (id: number): TriggerCommand =>
  createTriggerCommand("ToggleBuildingCatalogCompare", id);
export const clearCompareEntriesCommand = (): TriggerCommand => createTriggerCommand("ClearBuildingCatalogCompare");
export const searchChangedCommand = (value: string): TriggerCommand => createTriggerCommand("SearchChanged", value);
export const setCurrentCategoryCommand = (id: number): TriggerCommand => createTriggerCommand("SetCurrentCategory", id);
export const setCurrentSubCategoryCommand = (id: number): TriggerCommand => createTriggerCommand("SetCurrentSubCategory", id);
export const locatePrefabCommand = (id: number): LocatePrefabAction => ({ type: "locatePrefab", prefabId: id });
export const pickerOptionCommand = (sectionId: number, optionId: number, value: number): PickerOptionAction => ({
  type: "pickerOption",
  sectionId,
  optionId,
  value,
});
export const optionClickedCommand = (sectionId: number, optionId: number, value: number): TriggerCommand =>
  createTriggerCommand("OptionClicked", sectionId, optionId, value);

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

export function normalizeCatalogOffset(offset: number, totalCount: number, limit: number): number {
  const pageSize = normalizeCatalogPageSize(limit);
  const safeTotalCount = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeOffset = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const maxOffset = Math.max(0, Math.floor(Math.max(0, safeTotalCount - 1) / pageSize) * pageSize);

  return Math.min(maxOffset, Math.floor(safeOffset / pageSize) * pageSize);
}

/**
 * Make the bounded catalog semantics explicit to the player. The table is
 * paged, not an infinite scroll: show both the visible row range and the
 * current page so the footer cannot be mistaken for an unbounded feed.
 */
export function getCatalogPageSummary(offset: number, totalCount: number, limit: number): string {
  const pageSize = normalizeCatalogPageSize(limit);
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeOffset = normalizeCatalogOffset(offset, safeTotal, pageSize);
  const firstRow = safeTotal === 0 ? 0 : safeOffset + 1;
  const lastRow = safeTotal === 0 ? 0 : Math.min(safeOffset + pageSize, safeTotal);
  const pageCount = Math.max(1, Math.ceil(safeTotal / pageSize));
  const page = Math.floor(safeOffset / pageSize) + 1;

  return `Rows ${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${safeTotal.toLocaleString()} · Page ${page} of ${pageCount}`;
}

/** True when the bounded page has more records than are currently rendered. */
export function hasCatalogScroll(totalCount: number, renderedCount: number): boolean {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalCount) ? totalCount : 0));
  const safeRendered = Math.max(0, Math.floor(Number.isFinite(renderedCount) ? renderedCount : 0));
  return safeTotal > safeRendered;
}

