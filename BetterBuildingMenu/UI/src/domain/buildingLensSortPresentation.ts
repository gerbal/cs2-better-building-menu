import type { SortColumn, SortState } from "./buildingCatalogContracts";
import type { BuildingLensMetric } from "./buildingLensLayout";

export interface BuildingLensSortOption {
  key: SortColumn;
  label: string;
}

export interface BuildingLensSortChoice extends BuildingLensSortOption {
  selected: boolean;
}

export interface BuildingLensSortPresentation {
  compact: BuildingLensSortOption & {
    direction: "ascending" | "descending";
    indicator: "▲" | "▼";
  };
  expanded: BuildingLensSortChoice[];
}

export const BUILDING_LENS_SORT_OPTIONS: readonly BuildingLensSortOption[] = [
  // First, and the one the lens opens on: the game's own UIObject.m_Priority
  // order, authored per asset and derivable from nothing the player can see —
  // hence "Default". Being first also makes it the fallback below.
  { key: "Default", label: "Default" },
  { key: "Name", label: "Name" },
  { key: "Category", label: "Category" },
  { key: "ConstructionCost", label: "Cost" },
  { key: "Upkeep", label: "Upkeep" },
  { key: "Workers", label: "Workers" },
  { key: "Capacity", label: "Capacity" },
  // "Lot", not a bare "Width": beside Cost and Workers that reads as a
  // dimension of the building, and the figure sorted on is the lot's.
  { key: "LotWidth", label: "Lot width" },
  { key: "LotDepth", label: "Lot depth" },
  { key: "BuildingLevel", label: "Level" },
  { key: "HasParking", label: "Parking" },
];

/**
 * Which sort each metric column drives when its header is clicked, sorting a
 * table by its headers being the convention players know. `lot` renders both
 * dimensions and sorts by width; `LotDepth` stays in the sort list.
 */
export const BUILDING_LENS_COLUMN_SORT: Readonly<Record<BuildingLensMetric, SortColumn>> = {
  cost: "ConstructionCost",
  upkeep: "Upkeep",
  workers: "Workers",
  capacity: "Capacity",
  lot: "LotWidth",
  level: "BuildingLevel",
  parking: "HasParking",
};

/**
 * The direction glyph for a column header, or "" when that column is not the
 * active sort. Only the sorted column shows an indicator, so the header row
 * cannot imply several simultaneous orderings.
 */
export function getBuildingLensColumnSortIndicator(
  metric: BuildingLensMetric,
  state: SortState,
): "▲" | "▼" | "" {
  if (BUILDING_LENS_COLUMN_SORT[metric] !== state.column) {
    return "";
  }

  return state.descending ? "▼" : "▲";
}

/**
 * The sort fields worth offering for the current results: one that ties across
 * the whole set responds while the list does not move, which reads as broken.
 * Never drops the current selection; an empty answer means "not said yet".
 */
export function usableSortOptions(
  reorderable: readonly string[] | null | undefined,
  selected: SortColumn
): readonly BuildingLensSortOption[] {
  const usable = reorderable ?? [];

  if (usable.length === 0) {
    return BUILDING_LENS_SORT_OPTIONS;
  }

  return BUILDING_LENS_SORT_OPTIONS.filter(
    (option) => option.key === selected || usable.includes(option.key)
  );
}

export function getBuildingLensSortPresentation(
  state: SortState,
  reorderable: readonly string[] | null | undefined = null
): BuildingLensSortPresentation {
  const selectedOption = BUILDING_LENS_SORT_OPTIONS.find((option) => option.key === state.column)
    ?? BUILDING_LENS_SORT_OPTIONS[0];
  const direction = state.descending ? "descending" : "ascending";

  return {
    compact: {
      ...selectedOption,
      direction,
      indicator: state.descending ? "▼" : "▲",
    },
    expanded: usableSortOptions(reorderable, selectedOption.key).map((option) => ({
      ...option,
      selected: option.key === selectedOption.key,
    })),
  };
}
