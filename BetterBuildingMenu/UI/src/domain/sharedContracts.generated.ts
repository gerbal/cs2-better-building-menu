// Generated from the C# that owns these values, by SharedContractsTests in
// BetterBuildingMenu.Tests. Do not edit: change the C#, then run
//   CS2_WRITE_CONTRACTS=1 ./build.sh test
// and commit the result. CI fails while this file and the C# disagree.

/** BuildingCatalogSortColumns.Ids, in the picker's order. */
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
  "vehicle",
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
export type FacetId = "buildingType" | "provenance" | "availability" | "content" | "theme" | "placement" | "vehicle";

/** BuildingCatalogFacetSelection.Availability.All: the states every asset is in one of. */
export type AvailabilityOption = "Unlocked" | "Locked" | "AlreadyBuilt";

/** BuildingCatalogMetrics.All: every metric a range can bound, in the drawer's order, the keys its bounds are published under, and whether they are whole numbers. */
export const METRIC_RANGES = [
  { id: "cost", minKey: "minCost", maxKey: "maxCost", integer: false },
  { id: "upkeep", minKey: "minUpkeep", maxKey: "maxUpkeep", integer: false },
  { id: "workers", minKey: "minWorkers", maxKey: "maxWorkers", integer: false },
  { id: "capacity", minKey: "minCapacity", maxKey: "maxCapacity", integer: false },
  { id: "lotWidth", minKey: "minLotWidth", maxKey: "maxLotWidth", integer: true },
  { id: "lotDepth", minKey: "minLotDepth", maxKey: "maxLotDepth", integer: true },
] as const;

export type MetricRangeId = (typeof METRIC_RANGES)[number]["id"];

export type MetricBoundKey = (typeof METRIC_RANGES)[number]["minKey" | "maxKey"];

/** BuildingCatalogQuery.WindowStep: how many rows one Load more adds. */
export const CATALOG_WINDOW_STEP = 40;

/** AssetMenuHeight: the catalog height the player drags between, and where it starts. */
export const ASSET_MENU_MIN_HEIGHT = 108;
export const ASSET_MENU_MAX_HEIGHT = 960;
export const ASSET_MENU_DEFAULT_HEIGHT = 420;

/** AssetMenuWidth.Max: the band the build menu and its control pane may fill. */
export const ASSET_MENU_MAX_WIDTH = 1441;

/** AssetMenuCatalogWidth: the build menu's narrowest width, the value that means the default, and how near the room a drag must end to fill it. */
export const ASSET_MENU_CATALOG_MIN_WIDTH = 735;
export const ASSET_MENU_CATALOG_DEFAULT = 0;
export const ASSET_MENU_CATALOG_FILL_SNAP = 2;

/** Every trigger the mod's systems register, with the arguments C# reads; domain/commands builds from it. */
export interface TriggerArgs {
  ClearAssetMenuFilters: [];
  ClearAssetMenuScope: [];
  ClearBuildingCatalogMetricRanges: [];
  CommitAssetMenuCatalogWidth: [];
  CommitAssetMenuHeight: [];
  LoadMoreBuildingCatalog: [number];
  ResetAssetMenu: [];
  SearchChanged: [string];
  SearchEverything: [];
  SetAssetMenu: [string];
  SetAssetMenuCatalogWidth: [number];
  SetAssetMenuCategory: [string];
  SetAssetMenuHeight: [number];
  SetAssetMenuSchoolTier: [number];
  SetAssetMenuStripTab: [string];
  SetAssetMenuViewMode: [string];
  SetBuildingCatalogGroupBy: [string];
  SetBuildingCatalogMetricRange: [string, string, string];
  SetBuildingCatalogSortColumn: [string];
  SetBuildingCatalogSortDescending: [boolean];
  SetBuildingCatalogThenBy: [string];
  SetControlPaneShown: [boolean];
  SetCurrentPrefab: [number];
  SetVanillaToolbarSelection: [string, string, boolean, boolean];
  ToggleAssetMenuFacet: [string, string];
  VanillaMenuDeselected: [];
  VanillaMenuSelected: [number];
}
