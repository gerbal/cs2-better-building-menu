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
  setBuildingCapacityFloorCommand,
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
import { BuildingCatalogFilterSummary } from "./BuildingCatalogFilterSummary";
import { BuildingCatalogFacetPanel } from "./BuildingCatalogFacetPanel";
import { BuildingCatalogMetricFilters } from "./BuildingCatalogMetricFilters";
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
const BuildingCapacityFilterVisible$ = bindValue<boolean>(mod.id, "BuildingCapacityFilterVisible");
const BuildingCapacityFloor$ = bindValue<number>(mod.id, "BuildingCapacityFloor");
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

const educationCapacityPresets = [0, 100, 500, 1000];

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
  const capacityFilterVisible = useValue(BuildingCapacityFilterVisible$);
  const capacityFloor = useValue(BuildingCapacityFloor$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  const [sortingExpanded, setSortingExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const compareEntries = useValue(BuildingCatalogCompare$) ?? [];
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const legacyFilters = useValue(BuildingLensLegacyFilters$);

  // Name the constraints that actually emptied the table; the old copy always
  // blamed search and category, which are often not the cause.
  const emptyStateMessage = getBuildingLensEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
    capacityFloor,
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
  const upgradesLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Upgrades]", "Upgrades") ?? "Upgrades";
  const noDetailsLabel = translate(
    "Tooltip.LABEL[FindItBuildingMenu.NoDetailMetrics]",
    "No further data for this building",
  ) ?? "No further data for this building";
  const clearCompareLabel = translate("Tooltip.LABEL[FindItBuildingMenu.ClearCompare]", "Clear comparison") ?? "Clear comparison";
  const moreSortingLabel = sortingExpanded
    ? translate("Tooltip.LABEL[FindItBuildingMenu.HideSorting]", "Hide sorting") ?? "Hide sorting"
    : translate("Tooltip.LABEL[FindItBuildingMenu.MoreSorting]", "More sorting") ?? "More sorting";

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
    <div
      className={classNames(styles.catalog, densityClassNames[density])}
      data-density={density}
      data-row-height={rowGeometry.rowHeight}
      data-selector-height={rowGeometry.selectorHeight}
      data-metric-text-scale={getBuildingLensMetricTextScale(density)}
      data-catalog-max-height={catalogMaxHeight}
      style={{ height: `${catalogMaxHeight}rem`, maxHeight: `${catalogMaxHeight}rem` }}
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

      <BuildingCatalogFilterSummary />

      <div className={styles.catalogFilters}>
        <BuildingCatalogFacetPanel />
        <BuildingCatalogMetricFilters />
      </div>

      {capacityFilterVisible && (
        <div className={styles.capacityFilter}>
          <span className={styles.capacityFilterLabel}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.EducationCapacityFilter]", "Education capacity")}
          </span>
          {educationCapacityPresets.map((floor) => (
            <Button
              key={floor}
              className={classNames(styles.capacityButton, floor === capacityFloor && styles.capacityButtonSelected)}
              variant="icon"
              onSelect={() => {
                const command = setBuildingCapacityFloorCommand(floor);
                trigger(mod.id, command.method, ...command.args);
              }}
            >
              {floor === 0 ? "Any" : `${floor}+`}
            </Button>
          ))}
        </div>
      )}

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
    </div>
  );
};
