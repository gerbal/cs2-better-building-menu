/**
 * Every user-visible string the lens invented, and the key it will translate
 * through.
 *
 * Two kinds of string reach the player. The ones that name the game's own
 * concepts — categories, subcategories, building names — are already localized:
 * building names come from the active dictionary, and category labels now ask
 * the game first through GameLocaleKeys. Those need no work.
 *
 * The rest are ours. "Group by", "Cards", "Other", the cost bands — the game
 * has no counterpart to borrow, so they need real translation. Today they are
 * English literals, some behind a `translate(key, fallback)` call and some not
 * behind anything at all.
 *
 * This is the register of the second kind. It exists so that:
 *
 *   - a future translation pass has one list rather than a grep,
 *   - the guard test fails when a new invented string appears without a key,
 *   - and the ones that are not yet plumbed are visible as debt rather than
 *     invisible as English.
 *
 * `plumbed: false` means the string is still rendered directly from a domain
 * module, which cannot call `translate` — the pure modules deliberately have no
 * access to the localization manager. Those need the domain to return a key and
 * the component to render it, which is a change to each call site rather than a
 * change here.
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
  // The spoken form of the two pickers. Separate from the "Group by" / "Sort by"
  // labels because these announce current state to a screen reader rather than
  // labelling the control, and because they must match each other's register —
  // one used to say "Sorted by Name, ascending" while its twin said "Category".
  { key: key("GroupedBy"), english: "Grouped by {0}", source: "BuildingCatalog", plumbed: true },
  { key: key("SortedBy"), english: "Sorted by {0}, {1}", source: "BuildingCatalog", plumbed: true },
  { key: key("SortByOption"), english: "Sort by {0}", source: "BuildingCatalog", plumbed: true },
  { key: key("SortDirectionAscending"), english: "ascending", source: "BuildingCatalog", plumbed: true },
  { key: key("SortDirectionDescending"), english: "descending", source: "BuildingCatalog", plumbed: true },
  { key: key("ViewGrid"), english: "Grid", source: "BuildingCatalog", plumbed: true },
  // Vanilla's zoning and building menus close from an X in the top-right
  // corner; the panel stands in for that menu, so it offers the same way out.
  // The hover card's three missing facts (cm-2xvs.19). Households is its own
  // line because Capacity is derived from SERVICE components and a residential
  // building has none — a signature mansion read capacity null and the card
  // said nothing about the one thing it is for.
  { key: key("Households"), english: "Households", source: "BuildingHoverCard", plumbed: true },
  { key: key("HouseholdsUnit"), english: "households", source: "BuildingHoverCard", plumbed: true },
  { key: key("WorkersUnit"), english: "jobs", source: "BuildingHoverCard", plumbed: true },
  { key: key("CloseMenu"), english: "Close", source: "BuildingMenuHeader", plumbed: true },
  { key: key("ViewList"), english: "List", source: "BuildingCatalog", plumbed: true },
  { key: key("ViewCards"), english: "Cards", source: "BuildingCatalog", plumbed: true },
  { key: key("ViewTable"), english: "Table", source: "BuildingCatalog", plumbed: true },
  { key: key("GroupBy_none"), english: "None", source: "buildingGroups", plumbed: true },
  // The game's own categories — the dimension the tab strip shows.
  { key: key("GroupBy_menuCategory"), english: "Category", source: "buildingGroups", plumbed: true },
  // Ours: Buildings, Networks, Service Buildings. Renamed off "Category" so it
  // stops competing with the game's word for a different idea.
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
  // The one menu the lens renamed, because it is the one whose contents it
  // changed: Roads gathers every network now, so the game's own "Roads" is
  // ~230 assets short of describing it. Offered ahead of the game's string
  // rather than instead of it, so an untranslated language still gets "Roads"
  // rather than the raw prefab id.
  { key: key("MenuRoadsAndNetworks"), english: "Roads & Networks", source: "vanillaServiceLabels", plumbed: true },
  { key: key("AllTypes"), english: "All types", source: "ChipRow", plumbed: true },
  { key: key("Remove"), english: "Remove", source: "ChipRow", plumbed: true },
  // The end of the feed. Replaces the five-button pager and its
  // "Rows 1-100 of 3677 - Page 1 of 37", which was small, low-contrast, and
  // reported a fact ("page 19") nobody can act on.
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
  // The headings themselves — bands, tiers, "Other" — are C#'s strings now
  // (BuildingCatalogGrouping.Labels, sent as groupPath) and are localised on
  // that side when they are. This is the one the strip's milestone labeller
  // still returns.
  { key: key("GroupOther"), english: "Other", source: "buildingGroups.UNGROUPED_LABEL", plumbed: false },

  // --- Filter summary and empty states. Pure module. -----------------------
  { key: key("NoActiveFilters"), english: "No active filters", source: "buildingLensFilterSummary", plumbed: false },
  { key: key("ActiveFilterCount"), english: "{0} active filters", source: "buildingLensFilterSummary", plumbed: false },
  { key: key("NoBuildingsInCategory"), english: "No buildings in this category.", source: "buildingLensFilterSummary", plumbed: false },
  { key: key("NoBuildingsMatch"), english: "No buildings match {0}.", source: "buildingLensFilterSummary", plumbed: false },
  { key: key("SearchConstraint"), english: 'search "{0}"', source: "buildingLensFilterSummary", plumbed: false },

  // --- Metric names used in chips and summaries. Pure module. --------------
  // The table's column headers are already translated; these are the same words
  // reached by a different path, which is exactly the sort of divergence a
  // register is meant to surface.
  { key: key("MetricCost"), english: "Cost", source: "filterChips, buildingLensFilterSummary", plumbed: false },
  { key: key("MetricUpkeep"), english: "Upkeep", source: "filterChips, buildingLensFilterSummary", plumbed: false },
  { key: key("MetricWorkers"), english: "Workers", source: "filterChips, buildingLensFilterSummary", plumbed: false },
  { key: key("MetricCapacity"), english: "Capacity", source: "filterChips, buildingLensFilterSummary", plumbed: false },
  { key: key("MetricLotWidth"), english: "Lot width", source: "filterChips, buildingLensFilterSummary", plumbed: false },
  { key: key("MetricLotDepth"), english: "Lot depth", source: "filterChips, buildingLensFilterSummary", plumbed: false },

  // --- Units and no-data markers. Pure module. -----------------------------
  { key: key("MetricNoData"), english: "—", source: "buildingLensMetricFormat", plumbed: false },
  { key: key("MetricFree"), english: "Free", source: "buildingLensMetricFormat", plumbed: false },
  { key: key("UpkeepPerMonth"), english: "{0}/mo", source: "buildingLensMetricFormat", plumbed: false },
  { key: key("UnitStudents"), english: "students", source: "buildingLensMetricFormat", plumbed: false },
  { key: key("UnitPatients"), english: "patients", source: "buildingLensMetricFormat", plumbed: false },
  { key: key("UnitVehicles"), english: "vehicles", source: "buildingLensMetricFormat", plumbed: false },
];

/** The register's own contract: keys are unique and well formed. */
export function getUnplumbedStrings(): readonly LocalizableString[] {
  return LOCALIZABLE_STRINGS.filter((entry) => !entry.plumbed);
}
