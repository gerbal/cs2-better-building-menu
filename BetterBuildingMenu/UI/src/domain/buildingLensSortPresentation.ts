import type { SortColumn, SortState } from "./buildingCatalogContracts";
import type { BuildingLensMetric } from "./buildingLensLayout";
import { SORT_COLUMNS } from "./sharedContracts.generated";

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

/** What the picker calls each sort. A column C# adds has to be named here, or this fails to compile. */
const SORT_LABELS: Readonly<Record<SortColumn, string>> = {
  // The game's own UIObject.m_Priority order, authored per asset and
  // derivable from nothing the player can see — hence "Default".
  Default: "Default",
  Name: "Name",
  Category: "Category",
  ConstructionCost: "Cost",
  Upkeep: "Upkeep",
  Workers: "Workers",
  Capacity: "Capacity",
  // "Lot", not a bare "Width": beside Cost and Workers that reads as a
  // dimension of the building, and the figure sorted on is the lot's.
  LotWidth: "Lot width",
  LotDepth: "Lot depth",
  BuildingLevel: "Level",
  HasParking: "Parking",
};

/** In C#'s order, Default first: the one the lens opens on, and the fallback below. */
export const BUILDING_LENS_SORT_OPTIONS: readonly BuildingLensSortOption[] = SORT_COLUMNS.map((key) => ({
  key,
  label: SORT_LABELS[key],
}));

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
