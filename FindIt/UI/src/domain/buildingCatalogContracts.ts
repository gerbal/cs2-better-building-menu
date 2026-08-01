import type { BuildingCatalogEntry } from "./buildingCatalog";

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
  args: any[];
}

export interface SortState {
  column: SortColumn;
  descending: boolean;
}

export function createTriggerCommand(method: string, ...args: any[]): TriggerCommand {
  return { method, args };
}

export const setCurrentPrefabCommand = (id: number): TriggerCommand => createTriggerCommand("SetCurrentPrefab", id);
export const setSortColumnCommand = (column: SortColumn): TriggerCommand => createTriggerCommand("SetBuildingCatalogSortColumn", column);
export const setSortDescendingCommand = (descending: boolean): TriggerCommand =>
  createTriggerCommand("SetBuildingCatalogSortDescending", descending);
export const setCatalogOffsetCommand = (offset: number): TriggerCommand => createTriggerCommand("SetBuildingCatalogOffset", offset);
export const setBuildingCapacityFloorCommand = (floor: number): TriggerCommand =>
  createTriggerCommand("SetBuildingCapacityFloor", normalizeCapacityFloor(floor));
export const searchChangedCommand = (value: string): TriggerCommand => createTriggerCommand("SearchChanged", value);
export const setCurrentCategoryCommand = (id: number): TriggerCommand => createTriggerCommand("SetCurrentCategory", id);
export const setCurrentSubCategoryCommand = (id: number): TriggerCommand => createTriggerCommand("SetCurrentSubCategory", id);
export const locatePrefabCommand = (id: number): TriggerCommand => createTriggerCommand("OnLocateButtonClicked", id);
export const pickerOptionCommand = (x: number, y: number, z: number): TriggerCommand =>
  createTriggerCommand("PickerOptionClicked", x, y, z);

export function nextSortState(current: SortState, column: SortColumn): SortState {
  return {
    column,
    descending: column === current.column ? !current.descending : false,
  };
}

export function toggleCompareEntry(
  current: readonly BuildingCatalogEntry[],
  entry: BuildingCatalogEntry,
  maxEntries: number = MAX_COMPARE_ENTRIES
): BuildingCatalogEntry[] {
  if (current.some((candidate) => candidate.id === entry.id)) {
    return current.filter((candidate) => candidate.id !== entry.id);
  }

  if (current.length >= Math.max(0, maxEntries)) {
    return [...current];
  }

  return [...current, entry];
}

export function removeCompareEntry(current: readonly BuildingCatalogEntry[], id: number): BuildingCatalogEntry[] {
  return current.filter((entry) => entry.id !== id);
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
