import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
import classNames from "classnames";
import mod from "../../../mod.json";
import { BuildingCatalogEntry, BuildingCatalogPage, formatBuildingCatalogLabels } from "domain/buildingCatalog";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  BUILDING_LENS_TITLE_ICON,
  getBuildingLensCatalogMaxHeight,
  getBuildingLensDensity,
  getBuildingLensRowGeometry,
  getBuildingLensMetricLabel,
  getBuildingLensMetricTextScale,
} from "domain/buildingLensLayout";
import type { BuildingLensDensityTier, BuildingLensMetric } from "domain/buildingLensLayout";
import {
  MAX_COMPARE_ENTRIES,
  getCatalogPageSummary,
  hasCatalogScroll,
  clearCompareEntriesCommand,
  nextSortState,
  normalizeCatalogOffset,
  setCatalogOffsetCommand,
  setSortColumnCommand,
  setSortDescendingCommand,
  toggleCompareEntryCommand,
} from "domain/buildingCatalogContracts";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  getBuildingDetailMetrics,
} from "domain/buildingLensMetricFormat";
import {
  getBuildingDescriptionKeys,
  getBuildingExtensionLabels,
  getBuildingFlagGroups,
  getBuildingProvenanceChips,
} from "domain/buildingLensRowDetails";
import {
  getBuildingLensEmptyStateMessage,
  type BuildingLensMetricRangeState,
} from "domain/buildingLensFilterSummary";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import { findItSurfacePort } from "domain/findItSurfacePort";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import { BuildingGrid } from "mods/BuildingGrid/BuildingGrid";
import { getSearchScopeNotice } from "domain/buildingSearchRank";
import { getLensChoice, getLensDisclosure, setLensChoice, setLensDisclosure } from "domain/buildingLensViewState";
import { BuildingList } from "mods/BuildingList/BuildingList";
import {
  DEFAULT_GROUP_DIMENSION,
  GROUP_DIMENSIONS,
  buildGroupedView,
  groupDimensionLabel,
  isGroupDimension,
  shouldShowHeading,
  type GroupDimensionId,
  type GroupNode,
} from "domain/buildingGroups";
// The rail, the metric popover and the filter summary all live in the chip row
// now, so the catalog no longer owns any filter chrome — only results.
import {
  BUILDING_LENS_COLUMN_SORT,
  getBuildingLensColumnSortIndicator,
  getBuildingLensSortPresentation,
} from "domain/buildingLensSortPresentation";
import styles from "./buildingCatalog.module.scss";

type BuildingCatalogPageStatus = "indexing" | "ready" | "empty";
type BuildingCatalogBindingPage = BuildingCatalogPage & { status?: BuildingCatalogPageStatus };

const BuildingCatalog$ = bindValue<BuildingCatalogBindingPage>(mod.id, "BuildingCatalog");
const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth");
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
// The order lives in the backend query, which outlives this component. Reading
// it back keeps the header honest across the remounts that close/reopen, the
// Catalog/Tools switch, and the lens toggle all cause.
const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn");
const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending");
// Backend-owned too: placing a building unmounts this panel, which used to
// throw away the shortlist the player built in order to make that choice.
const BuildingCatalogCompare$ = bindValue<BuildingCatalogEntry[]>(mod.id, "BuildingCatalogCompare");
const BuildingLensFacets$ = bindValue<BuildingLensFacetState>(mod.id, "BuildingLensFacets");
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState>(mod.id, "BuildingCatalogMetricRanges");
const BuildingLensLegacyFilters$ = bindValue<string[]>(mod.id, "BuildingLensLegacyFilters");
const BuildingCatalogMatchesElsewhere$ = bindValue<number>(mod.id, "BuildingCatalogMatchesElsewhere", 0);
const LensDefaultToTable$ = bindValue<boolean>(mod.id, "BuildingLensDefaultToTable", false);

const LENS_VIEW_MODE_KEY = "viewMode";
const LENS_GROUP_KEY = "groupBy";

/** Grid recognises, List scans, Table compares. */
type ViewMode = "grid" | "list" | "table";

const VIEW_MODES: Array<{ id: ViewMode; localizationKey: string; fallback: string }> = [
  { id: "grid", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewGrid]", fallback: "Grid" },
  { id: "list", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewList]", fallback: "List" },
  { id: "table", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewTable]", fallback: "Table" },
];

const metricColumns: Array<{
  key: BuildingLensMetric;
  localizationKey: string;
  fallback: string;
  className: string;
}> = [
  { key: "cost", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Cost]", fallback: "Cost", className: "metricCost" },
  { key: "upkeep", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Upkeep]", fallback: "Upkeep", className: "metricUpkeep" },
  { key: "workers", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Workers]", fallback: "Workers", className: "metricWorkers" },
  { key: "capacity", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Capacity]", fallback: "Capacity", className: "metricCapacity" },
  { key: "lot", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Lot]", fallback: "Lot", className: "metricLot" },
  { key: "level", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Level]", fallback: "Level", className: "metricLevel" },
  { key: "parking", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.Parking]", fallback: "Parking", className: "metricParking" },
];

const densityClassNames: Record<BuildingLensDensityTier, string> = {
  compact: styles.densityCompact,
  default: styles.densityDefault,
  expanded: styles.densityExpanded,
};

export const BuildingCatalogComponent = () => {
  const { translate } = useLocalization();
  const page = useValue(BuildingCatalog$);
  const panelWidth = useValue(PanelWidth$);
  const currentSearch = useValue(CurrentSearch$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  const [sortingExpanded, setSortingExpanded] = useState(false);
  // Grid by default: recognising a thumbnail is the fast path back to the map,
  // and the table is for the rarer moment when you are genuinely comparing.
  // Survives remount for the same reason the drawers do — placing a building
  // unmounts this panel.
  const defaultToTable = useValue(LensDefaultToTable$);
  // Three modes now, so a boolean no longer says it. The setting still supplies
  // the starting point; the in-session choice overrides it and survives the
  // remount that placing a building causes.
  const [viewMode, setViewModeState] = useState<ViewMode>(
    () => getLensChoice(LENS_VIEW_MODE_KEY, defaultToTable ? "table" : "grid") as ViewMode
  );
  const setViewMode = (next: ViewMode) => {
    setLensChoice(LENS_VIEW_MODE_KEY, next);
    setViewModeState(next);
  };
  const tableMode = viewMode === "table";
  const [groupBy, setGroupByState] = useState<GroupDimensionId>(
    () => {
      const stored = getLensChoice(LENS_GROUP_KEY, DEFAULT_GROUP_DIMENSION);
      return isGroupDimension(stored) ? stored : DEFAULT_GROUP_DIMENSION;
    }
  );
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const setGroupBy = (next: GroupDimensionId) => {
    setLensChoice(LENS_GROUP_KEY, next);
    setGroupByState(next);
    setGroupPickerOpen(false);
    // The dimension is also the query's primary sort key, so the backend has
    // to reorder — grouping the page here alone would split a group across a
    // page boundary and the heading would describe the wrong rows.
    trigger(mod.id, "SetBuildingCatalogGroupBy", next);
  };
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const compareEntries = useValue(BuildingCatalogCompare$) ?? [];
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const legacyFilters = useValue(BuildingLensLegacyFilters$);
  const matchesElsewhere = useValue(BuildingCatalogMatchesElsewhere$);

  // Name the constraints that actually emptied the table; the old copy always
  // blamed search and category, which are often not the cause.
  const emptyStateMessage = getBuildingLensEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
    legacyFilters,
  });

  const items = page?.items ?? [];
  const totalCount = page?.totalCount ?? 0;
  const offset = page?.offset ?? 0;
  const limit = page?.limit ?? 100;
  const status: BuildingCatalogPageStatus = page?.status
    ?? (page ? (totalCount === 0 ? "empty" : "ready") : "indexing");
  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + items.length < totalCount;
  const pageSummary = getCatalogPageSummary(offset, totalCount, limit);
  const rowsScrollable = hasCatalogScroll(totalCount, items.length);
  const density = getBuildingLensDensity(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH);
  const rowGeometry = getBuildingLensRowGeometry(density);
  const catalogMaxHeight = getBuildingLensCatalogMaxHeight(typeof window === "undefined" ? 720 : window.innerHeight);
  const sortPresentation = getBuildingLensSortPresentation({ column: sortColumn, descending });
  const placeLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Place]", "Place") ?? "Place";
  const firstPageLabel = translate("Tooltip.LABEL[FindItBuildingMenu.FirstPage]", "First page") ?? "First page";
  const previousPageLabel = translate("Tooltip.LABEL[FindItBuildingMenu.PreviousPage]", "Previous page") ?? "Previous page";
  const nextPageLabel = translate("Tooltip.LABEL[FindItBuildingMenu.NextPage]", "Next page") ?? "Next page";
  const lastPageLabel = translate("Tooltip.LABEL[FindItBuildingMenu.LastPage]", "Last page") ?? "Last page";
  const lastPageOffset = normalizeCatalogOffset(totalCount, totalCount, limit);
  const inspectLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Inspect]", "Details") ?? "Details";
  const collapseLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Collapse]", "Hide") ?? "Hide";
  // Row and filter should name the same asset the same way: the entry carries
  // raw ids (DlcId is the numeric platform id) while the facet groups already
  // hold the display names, so resolve through those rather than duplicating a
  // lookup table that would drift.
  const resolveFacetLabel = (groupId: string, value: string): string | null => {
    const group = facets?.groups?.find((candidate) => candidate.id === groupId);

    return group?.options?.find((option) => option.id === value)?.label ?? null;
  };
  const scopeNotice = getSearchScopeNotice({
    searchText: currentSearch ?? "",
    shown: items.length,
    elsewhere: matchesElsewhere ?? 0,
  });
  const scopeNoticeText = scopeNotice
    ? (translate(
        "Tooltip.LABEL[FindItBuildingMenu.MatchesElsewhere]",
        "No matches here — {0} elsewhere"
      ) ?? "No matches here — {0} elsewhere").replace("{0}", `${scopeNotice.elsewhere}`)
    : "";
  const searchEverywhereLabel =
    translate("Tooltip.LABEL[FindItBuildingMenu.SearchEverything]", "Search everything")
    ?? "Search everything";
  const groupByLabel = translate(
    `Tooltip.LABEL[FindItBuildingMenu.GroupBy_${groupBy}]`,
    groupDimensionLabel(groupBy)
  ) ?? groupDimensionLabel(groupBy);
  const upgradesLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Upgrades]", "Upgrades") ?? "Upgrades";
  const noDetailsLabel = translate(
    "Tooltip.LABEL[FindItBuildingMenu.NoDetailMetrics]",
    "No further data for this building",
  ) ?? "No further data for this building";
  const clearCompareLabel = translate("Tooltip.LABEL[FindItBuildingMenu.ClearCompare]", "Clear comparison") ?? "Clear comparison";
  const moreSortingLabel = sortingExpanded
    ? translate("Tooltip.LABEL[FindItBuildingMenu.HideSorting]", "Hide sorting") ?? "Hide sorting"
    : translate("Tooltip.LABEL[FindItBuildingMenu.MoreSorting]", "More sorting") ?? "More sorting";

  /**
   * Draws one leaf's entries in whichever mode is active.
   *
   * Grouping is a property of the result, not of a mode, so all three render
   * the same tree. The zoning view is the same idea by hand — family, density,
   * tiles — which is why it can eventually drop its bespoke component.
   */
  function renderLeaf(entries: BuildingCatalogEntry[]): JSX.Element {
    return viewMode === "list"
      ? <BuildingList entries={entries} searchText={currentSearch ?? ""} onPlace={activate} />
      : <BuildingGrid entries={entries} searchText={currentSearch ?? ""} onPlace={activate} standalone={false} />;
  }

  function renderGroupNodes(nodes: GroupNode<BuildingCatalogEntry>[], depth: number): JSX.Element[] {
    // A single group covering everything is a label with nothing to
    // distinguish, which is exactly what a lone SERVICE BUILDINGS heading is
    // once the player has already navigated there.
    const showHeadings = shouldShowHeading(nodes);

    return nodes.map((node) => (
      <div className={styles.group} key={node.path.join("/")} data-group-depth={depth}>
        {showHeadings && (
          <div className={classNames(styles.groupHeading, depth > 0 && styles.groupHeadingNested)}>
            <span className={styles.groupLabel}>{node.label}</span>
            <span className={styles.groupCount}>{node.count}</span>
          </div>
        )}
        {node.children.length > 0
          ? renderGroupNodes(node.children, depth + 1)
          : renderLeaf(node.entries)}
      </div>
    ));
  }

  function renderGrouped(entries: BuildingCatalogEntry[]): JSX.Element {
    const groups = buildGroupedView(entries, groupBy);

    // Ungrouped grid keeps its own scroll and its shelf; anything else is one
    // scroll around the whole result, because a scrollbar per heading makes the
    // set impossible to read as one thing.
    if (groups.length === 0 && viewMode !== "list") {
      return <BuildingGrid entries={entries} searchText={currentSearch ?? ""} onPlace={activate} />;
    }

    return (
      <Scrollable className={styles.groupScroll} vertical trackVisibility="scrollable">
        {groups.length === 0 ? renderLeaf(entries) : renderGroupNodes(groups, 0)}
      </Scrollable>
    );
  }

  function toggleExpanded(id: number): void {
    setExpandedId((current) => (current === id ? null : id));
  }

  function activate(entry: BuildingCatalogEntry): void {
    // Keep the existing FindIt placement path: the backend resolves this id
    // through its single prefab index and activates the normal prefab tool.
    findItSurfacePort.activatePrefab({ prefabId: entry.id });
  }

  function toggleCompare(entry: BuildingCatalogEntry): void {
    const command = toggleCompareEntryCommand(entry.id);
    trigger(mod.id, command.method, ...command.args);
  }

  function removeCompare(id: number): void {
    // Removal is the same backend toggle: the id is known to be selected.
    const command = toggleCompareEntryCommand(id);
    trigger(mod.id, command.method, ...command.args);
  }

  function clearCompare(): void {
    const command = clearCompareEntriesCommand();
    trigger(mod.id, command.method, ...command.args);
  }

  function setSort(column: SortColumn): void {
    const next = nextSortState({ column: sortColumn, descending }, column);

    // No local echo: the backend owns the order and publishes it back, so
    // mirroring it here would just reintroduce a second source of truth.
    for (const command of [setSortColumnCommand(next.column), setSortDescendingCommand(next.descending), setCatalogOffsetCommand(0)]) {
      trigger(mod.id, command.method, ...command.args);
    }
  }

  function setPage(nextOffset: number): void {
    const command = setCatalogOffsetCommand(normalizeCatalogOffset(nextOffset, totalCount, limit));
    trigger(mod.id, command.method, ...command.args);
  }

  return (
    // maxHeight is a cap, not a height: a page of three results should not
    // hold a full-height panel open. The floor lives on the container.
    <div
      className={classNames(styles.catalog, densityClassNames[density])}
      data-density={density}
      data-row-height={rowGeometry.rowHeight}
      data-selector-height={rowGeometry.selectorHeight}
      data-metric-text-scale={getBuildingLensMetricTextScale(density)}
      data-catalog-max-height={catalogMaxHeight}
      style={{ maxHeight: `${catalogMaxHeight}rem` }}
    >
      {/* Identity, result count, search context and sort used to be two
          full-width bands stacked above the table, each carrying a single short
          line. Measured against a real city they cost 84px of a 625px panel
          while the rows themselves only got 159px. One toolbar carries all of
          it. */}
      <div className={styles.toolbar}>
        <img className={styles.titleIcon} src={BUILDING_LENS_TITLE_ICON} alt="" />
        <div className={styles.title}>{translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLens]", "Building lens")}</div>
        <div className={styles.count}>{totalCount.toLocaleString()}</div>
        {currentSearch?.trim() && (
          <div className={styles.searchContext} title={currentSearch}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLensSearchResults]", "Results for {0}")?.replace("{0}", currentSearch)}
          </div>
        )}
        {/* Group and sort sit together because they are the same kind of
            control — how the set is ordered. Narrowing lives in the chip row,
            and keeping that line clean is what the whole rework turned on. */}
        <span className={styles.sortLabel}>{translate("Tooltip.LABEL[FindItBuildingMenu.GroupBy]", "Group by")}</span>
        <div className={styles.groupPicker}>
          <Button
            className={styles.sortSummary}
            variant="icon"
            onSelect={() => setGroupPickerOpen((open) => !open)}
            aria-expanded={groupPickerOpen}
            aria-label={groupByLabel}
            title={groupByLabel}
          >
            <span className={styles.sortSummaryLabel}>{groupByLabel}</span>
            <span className={styles.sortDirection} aria-hidden="true">▾</span>
          </Button>
          {groupPickerOpen && (
            <div className={styles.groupOptions}>
              {GROUP_DIMENSIONS.map((dimension) => {
                const label = translate(
                  `Tooltip.LABEL[FindItBuildingMenu.GroupBy_${dimension.id}]`,
                  dimension.label
                ) ?? dimension.label;

                return (
                  <Button
                    key={dimension.id}
                    className={classNames(styles.sortButton, dimension.id === groupBy && styles.sortButtonSelected)}
                    variant="icon"
                    onSelect={() => setGroupBy(dimension.id)}
                    aria-label={label}
                  >
                    <span>{label}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        <div className={styles.toolbarSpacer} />
        <span className={styles.sortLabel}>{translate("Tooltip.LABEL[FindItBuildingMenu.SortBy]", "Sort by")}</span>
        <div
          className={styles.sortSummary}
          title={`${sortPresentation.compact.label} · ${sortPresentation.compact.direction}`}
          aria-label={`Sorted by ${sortPresentation.compact.label}, ${sortPresentation.compact.direction}`}
        >
          <span className={styles.sortSummaryLabel}>{sortPresentation.compact.label}</span>
          <span className={styles.sortDirection} aria-hidden="true">{sortPresentation.compact.indicator}</span>
        </div>
        {/* Three modes, so a two-state toggle no longer says it — and built
            from the same vanilla ToolButton the game's own Pack and Theme
            filters use, rather than hand-padded buttons that only resemble
            them. Selected state comes from the component. */}
        <div className={styles.viewModes}>
          {VIEW_MODES.map((option) => {
            const label = translate(option.localizationKey, option.fallback) ?? option.fallback;

            return (
              <VanillaComponentResolver.instance.ToolButton
                key={option.id}
                selected={option.id === viewMode}
                tooltip={label}
                onSelect={() => setViewMode(option.id)}
                // The vanilla filters are icon-only and this carries a word,
                // so there is no glyph to pass. Empty is the same thing
                // OptionsPanel does for its unselected checkbox.
                src=""
                focusKey={VanillaComponentResolver.instance.FOCUS_DISABLED}
                className={classNames(
                  VanillaComponentResolver.instance.toolButtonTheme.button,
                  styles.viewMode,
                  option.id === viewMode && styles.viewModeSelected
                )}
              >
                <span className={styles.viewModeLabel}>{label}</span>
              </VanillaComponentResolver.instance.ToolButton>
            );
          })}
        </div>
        <Button
          className={styles.sortDisclosure}
          variant="icon"
          onSelect={() => setSortingExpanded((expanded) => !expanded)}
          aria-expanded={sortingExpanded}
          aria-label={moreSortingLabel}
          title={moreSortingLabel}
        >
          {moreSortingLabel}
        </Button>
      </div>

      {sortingExpanded && (
        <div className={styles.sortOptions} data-sort-options="expanded">
          {sortPresentation.expanded.map((option) => (
            <Button
              key={option.key}
              className={classNames(styles.sortButton, option.selected && styles.sortButtonSelected)}
              variant="icon"
              onSelect={() => setSort(option.key)}
              aria-label={`Sort by ${option.label}`}
              title={`Sort by ${option.label}`}
            >
              <span>{option.label}</span>
              {option.selected && <span className={styles.sortDirection} aria-hidden="true">{sortPresentation.compact.indicator}</span>}
            </Button>
          ))}
        </div>
      )}

      {/* The rail and the filter summary both moved into the chip row above
          the content. The summary said "3 active filters"; the chips say which
          three and let each one go, so keeping both was one band restating
          another less usefully. */}

      {compareEntries.length > 0 && (
        <div className={styles.compare}>
          <div className={styles.compareHeading}>
            <span className={styles.compareTitle}>
              {translate("Tooltip.LABEL[FindItBuildingMenu.CompareBuildings]", "Compare buildings")}
              <span className={styles.compareCount}> {compareEntries.length} / {MAX_COMPARE_ENTRIES}</span>
            </span>
            <Button
              className={styles.clearCompare}
              variant="icon"
              onSelect={clearCompare}
              aria-label={clearCompareLabel}
              title={clearCompareLabel}
            >
              {clearCompareLabel}
            </Button>
          </div>
          <div className={styles.compareRows}>
            {compareEntries.map((entry) => {
              const entryLabel = entry.name || entry.prefabName;
              const comparePlaceLabel = `${placeLabel}: ${entryLabel}`;
              const compareRemoveLabel = `Remove ${entryLabel} from comparison`;

              return (
                <div className={styles.compareRow} key={entry.id}>
                  <div className={styles.compareIdentity}>
                    <span className={styles.compareName}>{entryLabel}</span>
                    <span className={styles.compareMetrics}>
                      Cost {formatBuildingMetric(entry.constructionCost, "cost")} · Upkeep {formatBuildingMetric(entry.upkeep, "upkeep")} · Workers {formatBuildingMetric(entry.workers, "workers")} · Capacity {formatCapacity(entry.capacity, entry.category, entry.subCategory)}
                    </span>
                  </div>
                  <Button
                    className={styles.comparePlace}
                    variant="icon"
                    onSelect={() => activate(entry)}
                    aria-label={comparePlaceLabel}
                    title={comparePlaceLabel}
                  >
                    {placeLabel}
                  </Button>
                  <Button
                    className={styles.compareRemove}
                    variant="icon"
                    onSelect={() => removeCompare(entry.id)}
                    aria-label={compareRemoveLabel}
                    title={compareRemoveLabel}
                  >
                    <span aria-hidden="true">×</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tableMode ? (
        <>
        <div className={styles.columnHeader}>
          <span className={styles.identityHeader}>{translate("Tooltip.LABEL[FindItBuildingMenu.Building]", "Building")}</span>
          {metricColumns.map((column) => {
            const fullLabel = translate(column.localizationKey, column.fallback) ?? column.fallback;
            const indicator = getBuildingLensColumnSortIndicator(column.key, { column: sortColumn, descending });
            const sortTarget = BUILDING_LENS_COLUMN_SORT[column.key];
            const headerTitle = indicator === ""
              ? `${fullLabel} — ${translate("Tooltip.LABEL[FindItBuildingMenu.SortByColumn]", "sort by this column") ?? "sort by this column"}`
              : `${fullLabel} — ${translate("Tooltip.LABEL[FindItBuildingMenu.ReverseSort]", "reverse this sort") ?? "reverse this sort"}`;
            return (
              <Button
                key={column.key}
                className={classNames(styles.metricHeader, styles[column.className], indicator !== "" && styles.metricHeaderSorted)}
                variant="icon"
                onSelect={() => setSort(sortTarget)}
                title={headerTitle}
                aria-label={headerTitle}
                data-sort-indicator={indicator}
              >
                {getBuildingLensMetricLabel(column.key, density, fullLabel)}
                {indicator !== "" && <span className={styles.metricHeaderIndicator} aria-hidden="true">{indicator}</span>}
              </Button>
            );
          })}
        </div>

        <Scrollable
          className={styles.rows}
          vertical
          trackVisibility="scrollable"
          data-scrollable={rowsScrollable}
        >
          {items.length === 0 && (
            <div className={styles.empty}>
              {status === "indexing"
                ? translate("Tooltip.LABEL[FindItBuildingMenu.IndexingBuildings]", "Indexing buildings…")
                : emptyStateMessage}
            </div>
          )}
          {items.map((entry) => {
            const isCompared = compareEntries.some((candidate) => candidate.id === entry.id);
            const rawCategoryIdentity = entry.subCategory
              ? `${entry.category} · ${entry.subCategory}`
              : entry.category;
            const entryLabel = entry.name || entry.prefabName;
            const rowPlaceLabel = `${placeLabel}: ${entryLabel}`;
            const isExpanded = expandedId === entry.id;
            const rowInspectLabel = `${inspectLabel}: ${entryLabel}`;
            const detailMetrics = isExpanded ? getBuildingDetailMetrics(entry) : [];
            const flagGroups = isExpanded ? getBuildingFlagGroups(entry.placementFlags) : [];
            const extensionLabels = isExpanded ? getBuildingExtensionLabels(entry.extensions) : [];
            const provenanceChips = isExpanded ? getBuildingProvenanceChips(entry, resolveFacetLabel) : [];
            // translate() echoes the id back when a key is absent, so an
            // unlocalized prefab must not render its own locale key as prose.
            const description = isExpanded
              ? getBuildingDescriptionKeys(entry.prefabName)
                  .map((key) => translate(key, ""))
                  .find((text) => !!text && text.trim().length > 0 && !text.startsWith("Assets."))
              : undefined;
            const compareLabel = isCompared ? "Remove from comparison" : "Add to comparison";
            const comparePlaceLabel = `${placeLabel}: ${entryLabel}`;
            const compareRemoveLabel = `Remove ${entryLabel} from comparison`;

            return (
              <div key={entry.id} className={styles.row} data-expanded={isExpanded ? "true" : undefined}>
                <Button
                  className={styles.rowSelect}
                  variant="icon"
                  onSelect={() => toggleExpanded(entry.id)}
                  aria-label={inspectLabel}
                  title={rowInspectLabel}
                  data-expanded={isExpanded ? "true" : undefined}
                >
                  <div className={styles.identityCell}>
                    <div className={styles.thumbnail}>
                      {entry.thumbnail && <img src={entry.thumbnail} />}
                    </div>
                    <div className={styles.identity}>
                      <div className={styles.nameLine}>
                        <div className={styles.name}>{entryLabel}</div>
                        <span className={styles.placeHint} aria-hidden="true">{isExpanded ? collapseLabel : inspectLabel}</span>
                      </div>
                      <div className={styles.category} title={rawCategoryIdentity}>
                        {formatBuildingCatalogLabels(entry)}
                      </div>
                    </div>
                  </div>
                  <div className={classNames(styles.metric, styles.metricCost)} title={`Cost ${formatBuildingMetric(entry.constructionCost, "cost")}`}>
                    {formatBuildingMetric(entry.constructionCost, "cost")}
                  </div>
                  <div className={classNames(styles.metric, styles.metricUpkeep)} title={`Upkeep ${formatBuildingMetric(entry.upkeep, "upkeep")}`}>
                    {formatBuildingMetric(entry.upkeep, "upkeep")}
                  </div>
                  <div className={classNames(styles.metric, styles.metricWorkers)} title={`Workers ${formatBuildingMetric(entry.workers, "workers")}`}>
                    {formatBuildingMetric(entry.workers, "workers")}
                  </div>
                  <div className={classNames(styles.metric, styles.metricCapacity)} title={`Capacity ${formatCapacity(entry.capacity, entry.category, entry.subCategory)}`}>
                    {formatCapacity(entry.capacity, entry.category, entry.subCategory)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricLot)} title="Lot dimensions">
                    {formatLotDimensions(entry.lotWidth, entry.lotDepth)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricLevel)} title="Building level">
                    {entry.buildingLevel}
                  </div>
                  <div className={classNames(styles.parking, styles.metricParking, entry.hasParking && styles.parkingActive)} title={entry.hasParking ? "Parking" : "No parking"}>
                    {/* Not the no-data dash: this building is known to have no
                        parking, which is a fact rather than a gap. */}
                    {entry.hasParking ? "P" : "·"}
                  </div>
                </Button>
                {/* Placing is now an explicit act. The whole row used to be a
                    Place button, so there was no way to look at a building
                    without committing to it — and placement closes the panel. */}
                <Button
                  className={styles.rowPlaceButton}
                  variant="icon"
                  onSelect={() => activate(entry)}
                  aria-label={rowPlaceLabel}
                  title={rowPlaceLabel}
                >
                  <span>{placeLabel}</span>
                </Button>
                <Button
                  className={classNames(styles.compareButton, isCompared && styles.compareButtonSelected)}
                  variant="icon"
                  disabled={!isCompared && compareEntries.length >= MAX_COMPARE_ENTRIES}
                  onSelect={() => toggleCompare(entry)}
                  aria-label={compareLabel}
                  title={compareLabel}
                >
                  <span aria-hidden="true">{isCompared ? "✓" : "+"}</span>
                </Button>
                {isExpanded && (
                  <div className={styles.rowDetails}>
                    {/* The game's own copy for this prefab. Free: the entry
                        already carries prefabName and the game keys descriptions
                        by it, so this needs no backend projection. */}
                    {description && <div className={styles.rowDescription}>{description}</div>}

                    <div className={styles.rowDetailMetrics}>
                      {detailMetrics.length === 0 ? (
                        <span className={styles.rowDetailEmpty}>{noDetailsLabel}</span>
                      ) : (
                        detailMetrics.map((detail) => (
                          <span className={styles.rowDetail} key={detail.key}>
                            <span className={styles.rowDetailLabel}>{detail.label}</span>
                            <span className={styles.rowDetailValue}>{detail.value}</span>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Placement, lot access, network connections and lot
                        internals: previously reachable only by filtering on them,
                        never visible on the building itself. */}
                    {flagGroups.map((group) => (
                      <div className={styles.rowFlagGroup} key={group.id} data-flag-group={group.id}>
                        <span className={styles.rowDetailLabel}>{group.label}</span>
                        {group.values.map((value) => (
                          <span className={styles.rowFlag} key={value}>{value}</span>
                        ))}
                      </div>
                    ))}

                    {extensionLabels.length > 0 && (
                      <div className={styles.rowFlagGroup} data-flag-group="extensions">
                        <span className={styles.rowDetailLabel}>{upgradesLabel}</span>
                        {extensionLabels.map((extension) => (
                          <span className={styles.rowFlag} key={extension}>{extension}</span>
                        ))}
                      </div>
                    )}

                    {provenanceChips.length > 0 && (
                      <div className={styles.rowFlagGroup} data-flag-group="provenance">
                        {provenanceChips.map((chip) => (
                          <span className={styles.rowProvenance} key={chip.label}>
                            <span className={styles.rowDetailLabel}>{chip.label}</span>
                            <span className={styles.rowDetailValue}>{chip.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Scrollable>

        <div className={styles.paging}>
          {/* First/last jumps: a 4,000-building catalog is 43 pages, and stepping
              one page at a time made the far end of any sort effectively
              unreachable. */}
          <Button
            className={styles.pageButton}
            variant="icon"
            disabled={!hasPreviousPage}
            onSelect={() => setPage(0)}
            aria-label={firstPageLabel}
            title={firstPageLabel}
          >
            <span>«</span>
          </Button>
          <Button
            className={styles.pageButton}
            variant="icon"
            disabled={!hasPreviousPage}
            onSelect={() => setPage(offset - limit)}
            aria-label={previousPageLabel}
            title={previousPageLabel}
          >
            <span>‹</span>
          </Button>
          <span className={styles.pageLabel} title={pageSummary} aria-label={pageSummary}>{pageSummary}</span>
          <Button
            className={styles.pageButton}
            variant="icon"
            disabled={!hasNextPage}
            onSelect={() => setPage(offset + limit)}
            aria-label={nextPageLabel}
            title={nextPageLabel}
          >
            <span>›</span>
          </Button>
          <Button
            className={styles.pageButton}
            variant="icon"
            disabled={!hasNextPage}
            onSelect={() => setPage(lastPageOffset)}
            aria-label={lastPageLabel}
            title={lastPageLabel}
          >
            <span>»</span>
          </Button>
        </div>
        </>
      ) : (
        <>
          {scopeNotice && (
            <div className={styles.scopeNotice}>
              <span className={styles.scopeNoticeText}>{scopeNoticeText}</span>
              <Button
                className={styles.scopeNoticeAction}
                variant="icon"
                onSelect={() => trigger(mod.id, "SearchEverything")}
                aria-label={searchEverywhereLabel}
                title={searchEverywhereLabel}
              >
                {searchEverywhereLabel}
              </Button>
            </div>
          )}
          {/* The table names what emptied it; the grid used to show a blank
              box. Filters compose now, so an empty intersection is easy to
              reach by accident — "Health & Deathcare" plus role "Police
              Station" is nothing, and silence there reads as a broken panel. */}
          {items.length === 0
            ? <div className={styles.empty}>{emptyStateMessage}</div>
            : renderGrouped(items)}
        </>
      )}

    </div>
  );
};
