// Generated from the C# that owns these values, by SharedContractsTests in
// BetterBuildingMenu.Tests. Do not edit: change the C#, then run
//   CS2_WRITE_CONTRACTS=1 ./build.sh test
// and commit the result. CI fails while this file and the C# disagree.

/** BuildingCatalogQuery.OfferedSortColumns, in the picker's order. */
export const SORT_COLUMNS = [
  "Default",
  "Name",
  "Category",
  "ConstructionCost",
  "Upkeep",
  "Workers",
  "Capacity",
  "LotWidth",
  "LotDepth",
  "BuildingLevel",
  "HasParking",
] as const;

export type SortColumn = (typeof SORT_COLUMNS)[number];

/** BuildingCatalogGrouping.Dimensions, in the picker's order. */
export const GROUP_DIMENSION_IDS = [
  "menuCategory",
  "category",
  "subCategory",
  "role",
  "schoolTier",
  "progression",
  "development",
  "theme",
  "source",
  "density",
  "footprint",
  "cost",
  "none",
] as const;

export type GroupDimensionId = (typeof GROUP_DIMENSION_IDS)[number];

/** FacetIds.All: every filter dimension the backend can emit. */
export type FacetId = "buildingType" | "provenance" | "availability" | "content" | "theme" | "placement";

/** BuildingCatalogFacetSelection.Availability.All: the states every asset is in one of. */
export type AvailabilityOption = "Unlocked" | "Locked" | "AlreadyBuilt";

/** BuildingCatalogQuery.WindowStep: how many rows one Load more adds. */
export const CATALOG_WINDOW_STEP = 100;
