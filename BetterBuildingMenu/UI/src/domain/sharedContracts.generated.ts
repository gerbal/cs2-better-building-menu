// Generated from the C# that owns these values, by SharedContractsTests in
// BetterBuildingMenu.Tests. Do not edit: change the C#, then run
//   CS2_WRITE_CONTRACTS=1 ./build.sh test
// and commit the result. CI fails while this file and the C# disagree.

/** BuildingCatalogQuery.OfferedSortColumns, in the picker's order. */
export const SORT_COLUMNS = [
  "Default",
  "Match",
  "Name",
  "Category",
  "ConstructionCost",
  "Upkeep",
  "Workers",
  "Capacity",
  "Households",
  "WaterCapacity",
  "SewageCapacity",
  "LotWidth",
  "LotDepth",
  "BuildingLevel",
  "HasParking",
] as const;

export type SortColumn = (typeof SORT_COLUMNS)[number];

/** SortDefaults.BestFirstDescending: the sorts whose first click puts the highest first. */
export const SORT_FIRST_DESCENDING = [
  "Workers",
  "Capacity",
  "Households",
  "WaterCapacity",
  "SewageCapacity",
] as const;

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

/** AssetMenuHeight: the catalog height the player drags between, and where it starts. */
export const ASSET_MENU_MIN_HEIGHT = 108;
export const ASSET_MENU_MAX_HEIGHT = 960;
export const ASSET_MENU_DEFAULT_HEIGHT = 144.25;

/** WidthSteps: the build menu's five Width steps. A step is 706 plus its share, over 769, of the room beyond 706, and the room runs from the tool options' edge to 1 rem short of the social column. */
export const LAYOUT_HEIGHT = 1080;
export const WIDTH_STEP_VANILLA = 706;
export const WIDTH_STEP_DEFAULT = 1;
export const WIDTH_STEP_SHARES = [0, 187, 385, 574, 769] as const;
export const WIDTH_STEP_SHARE_DENOMINATOR = 769;
export const WIDTH_ROOM_LEFT = 396;
export const WIDTH_ROOM_RIGHT_OFFSET = 49;
export const SOCIAL_COLUMN_RIGHT_OFFSET = 48;
export const WIDTH_STEP_REFERENCE_ASPECT = 1.7777777777777777;

/** WidthSteps.For at three aspects: what the UI's copy of the rule is tested against. */
export const WIDTH_STEPS_REFERENCE = {
  "16:9": [706, 893, 1091, 1280, 1475],
  "21:9": [706, 1039, 1391, 1728, 2075],
  "32:9": [706, 1360, 2052, 2713, 3395],
} as const;
