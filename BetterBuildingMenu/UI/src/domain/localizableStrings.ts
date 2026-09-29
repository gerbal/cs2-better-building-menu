/**
 * The register of user-visible strings the asset menu invented — the ones with no
 * game counterpart to borrow. One list for a translation pass and a guard the
 * tests fail against; `plumbed: false` means a pure module returns it as text.
 */

export interface LocalizableString {
  /** The locale key this string will translate through. */
  key: string;
  /** The English text, which is also the fallback. */
  english: string;
  /** Where it is rendered from. */
  source: string;
  /**
   * False when the string is still returned as text from a pure domain module
   * and no `translate` call sees it.
   */
  plumbed: boolean;
}

const PREFIX = "Tooltip.LABEL[BetterBuildingMenu.";

const key = (name: string) => `${PREFIX}${name}]`;

export const LOCALIZABLE_STRINGS: readonly LocalizableString[] = [
  // --- View modes and grouping controls. Already behind translate(). --------
  { key: key("GroupBy"), english: "Group by", source: "BuildingCatalog", plumbed: true },
  // The spoken form of the two pickers: these announce current state to a
  // screen reader rather than labelling the control, and the pair has to match
  // each other's register.
  { key: key("GroupedBy"), english: "Grouped by {0}", source: "BuildingCatalog", plumbed: true },
  { key: key("SortedBy"), english: "Sorted by {0}, {1}", source: "BuildingCatalog", plumbed: true },
  { key: key("SortByOption"), english: "Sort by {0}", source: "BuildingCatalog", plumbed: true },
  { key: key("SortDirectionAscending"), english: "ascending", source: "BuildingCatalog", plumbed: true },
  { key: key("SortDirectionDescending"), english: "descending", source: "BuildingCatalog", plumbed: true },
  { key: key("ViewGrid"), english: "Grid", source: "BuildingCatalog", plumbed: true },
  // Households is its own line because Capacity is derived from SERVICE
  // components, which a residential building does not carry.
  { key: key("Households"), english: "Households", source: "BuildingHoverCard", plumbed: true },
  { key: key("HouseholdsUnit"), english: "households", source: "BuildingHoverCard", plumbed: true },
  { key: key("WorkersUnit"), english: "jobs", source: "BuildingHoverCard", plumbed: true },
  // Vanilla's menus close from an X in the top-right corner; the asset menu stands
  // in for one, so it offers the same way out.
  { key: key("CloseMenu"), english: "Close", source: "BuildingMenuHeader", plumbed: true },
  { key: key("ViewList"), english: "List", source: "BuildingCatalog", plumbed: true },
  { key: key("ViewCards"), english: "Cards", source: "BuildingCatalog", plumbed: true },
  { key: key("ViewTable"), english: "Table", source: "BuildingCatalog", plumbed: true },
  { key: key("GroupBy_none"), english: "None", source: "buildingGroups", plumbed: true },
  // The game's own categories — the dimension the tab strip shows.
  { key: key("GroupBy_menuCategory"), english: "Category", source: "buildingGroups", plumbed: true },
  // Ours: Buildings, Networks, Service Buildings. Not "Category", which is the
  // game's word for a different idea.
  { key: key("GroupBy_category"), english: "Asset type", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_subCategory"), english: "Type", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_role"), english: "Role", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_schoolTier"), english: "School tier", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_progression"), english: "Progression", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_development"), english: "Development", source: "buildingGroups", plumbed: true },
  { key: key("ProgressionUngated"), english: "From the start", source: "buildingGroups", plumbed: false },
  { key: key("GroupBy_theme"), english: "Theme", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_source"), english: "Source", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_density"), english: "Density", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_footprint"), english: "Footprint", source: "buildingGroups", plumbed: true },
  { key: key("GroupBy_cost"), english: "Cost", source: "buildingGroups", plumbed: true },

  // --- Chip row. Already behind translate(). -------------------------------
  { key: key("AllMenus"), english: "All menus", source: "ChipRow", plumbed: true },
  // The one menu the asset menu renames, because it is the one whose contents it
  // changes: Roads gathers every network, which the game's own word does not
  // describe. Offered ahead of that string rather than instead of it.
  { key: key("MenuRoadsAndNetworks"), english: "Roads & Networks", source: "vanillaServiceLabels", plumbed: true },
  { key: key("AllTypes"), english: "All types", source: "ChipRow", plumbed: true },
  { key: key("Remove"), english: "Remove", source: "ChipRow", plumbed: true },
  // The end of the feed.
  { key: key("LoadMore"), english: "Load more", source: "BuildingCatalog", plumbed: true },

  // --- Zone facts. Plumbed: the component formats and translates these. ----
  // Data the game measures and never shows: how tall a zone grows, whether it
  // takes narrow or corner lots, and what it trades in.
  { key: key("ZoneLots"), english: "fits {0}", source: "ZoningHierarchy", plumbed: true },
  { key: key("ZoneMaxHeight"), english: "up to {0}m", source: "ZoningHierarchy", plumbed: true },
  { key: key("ZoneNarrowLots"), english: "narrow lots", source: "ZoningHierarchy", plumbed: true },
  { key: key("ZoneCorners"), english: "corners", source: "ZoningHierarchy", plumbed: true },
  { key: key("ZoneSells"), english: "sells {0}", source: "ZoningHierarchy", plumbed: true },
  { key: key("ZoneMakes"), english: "makes {0}", source: "ZoningHierarchy", plumbed: true },
  { key: key("ZoneStores"), english: "stores {0}", source: "ZoningHierarchy", plumbed: true },

  // --- Group headings. Returned as text from a pure module. ----------------
  // The headings themselves are C#'s strings, localised on that side. This is
  // the one the strip's milestone labeller still returns.
  { key: key("GroupOther"), english: "Other", source: "buildingGroups.UNGROUPED_LABEL", plumbed: false },

  // --- Filter summary and empty states. Pure module. -----------------------
  { key: key("NoActiveFilters"), english: "No active filters", source: "assetMenuFilterSummary", plumbed: false },
  { key: key("ActiveFilterCount"), english: "{0} active filters", source: "assetMenuFilterSummary", plumbed: false },
  { key: key("NoBuildingsInCategory"), english: "No buildings in this category.", source: "assetMenuFilterSummary", plumbed: false },
  { key: key("NoBuildingsMatch"), english: "No buildings match {0}.", source: "assetMenuFilterSummary", plumbed: false },
  { key: key("SearchConstraint"), english: 'search "{0}"', source: "assetMenuFilterSummary", plumbed: false },

  // --- Metric names used in chips and summaries. Pure module. --------------
  // The table's column headers are already translated; these are the same
  // words reached by a different path, which is what a register is for.
  { key: key("MetricCost"), english: "Cost", source: "filterChips, assetMenuFilterSummary", plumbed: false },
  { key: key("MetricUpkeep"), english: "Upkeep", source: "filterChips, assetMenuFilterSummary", plumbed: false },
  { key: key("MetricWorkers"), english: "Workers", source: "filterChips, assetMenuFilterSummary", plumbed: false },
  { key: key("MetricCapacity"), english: "Capacity", source: "filterChips, assetMenuFilterSummary", plumbed: false },
  { key: key("MetricLotWidth"), english: "Lot width", source: "filterChips, assetMenuFilterSummary", plumbed: false },
  { key: key("MetricLotDepth"), english: "Lot depth", source: "filterChips, assetMenuFilterSummary", plumbed: false },

  // --- Units and no-data markers. Pure module. -----------------------------
  { key: key("MetricNoData"), english: "—", source: "assetMenuMetricFormat", plumbed: false },
  { key: key("MetricFree"), english: "Free", source: "assetMenuMetricFormat", plumbed: false },
  { key: key("UpkeepPerMonth"), english: "{0}/mo", source: "assetMenuMetricFormat", plumbed: false },
  { key: key("UnitStudents"), english: "students", source: "assetMenuMetricFormat", plumbed: false },
  { key: key("UnitPatients"), english: "patients", source: "assetMenuMetricFormat", plumbed: false },
  { key: key("UnitVehicles"), english: "vehicles", source: "assetMenuMetricFormat", plumbed: false },
];

/** The register's own contract: keys are unique and well formed. */
export function getUnplumbedStrings(): readonly LocalizableString[] {
  return LOCALIZABLE_STRINGS.filter((entry) => !entry.plumbed);
}
