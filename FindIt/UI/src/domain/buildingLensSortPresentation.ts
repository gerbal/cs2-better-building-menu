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
  { key: "Name", label: "Name" },
  { key: "Category", label: "Category" },
  { key: "ConstructionCost", label: "Cost" },
  { key: "Upkeep", label: "Upkeep" },
  { key: "Workers", label: "Workers" },
  { key: "Capacity", label: "Capacity" },
  { key: "LotWidth", label: "Width" },
  { key: "LotDepth", label: "Depth" },
  { key: "BuildingLevel", label: "Level" },
  { key: "HasParking", label: "Parking" },
];

/**
 * Which sort each metric column drives when its header is clicked.
 *
 * Column headers were previously inert labels, so changing the order meant
 * opening the sort disclosure and, to reverse direction, clicking three times
 * through a mechanism with no visible affordance. Sorting a table by its
 * headers is the convention players already know.
 *
 * `lot` renders width and depth together but sorts by width: it is the primary
 * figure in the combined cell, and `LotDepth` remains reachable from the
 * existing sort list.
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

export function getBuildingLensSortPresentation(state: SortState): BuildingLensSortPresentation {
  const selectedOption = BUILDING_LENS_SORT_OPTIONS.find((option) => option.key === state.column)
    ?? BUILDING_LENS_SORT_OPTIONS[0];
  const direction = state.descending ? "descending" : "ascending";

  return {
    compact: {
      ...selectedOption,
      direction,
      indicator: state.descending ? "▼" : "▲",
    },
    expanded: BUILDING_LENS_SORT_OPTIONS.map((option) => ({
      ...option,
      selected: option.key === selectedOption.key,
    })),
  };
}
