import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import mod from "../../../mod.json";
import { BuildingCatalogEntry, BuildingCatalogPage, formatBuildingCatalogLabels } from "domain/buildingCatalog";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  getBuildingLensCatalogMaxHeight,
  getBuildingLensDensity,
  getBuildingLensRowGeometry,
  getBuildingLensMetricLabel,
  getBuildingLensMetricTextScale,
} from "domain/buildingLensLayout";
import type { BuildingLensDensityTier, BuildingLensMetric } from "domain/buildingLensLayout";
import {
  MAX_COMPARE_ENTRIES,
  clearCompareEntriesCommand,
  loadMoreCatalogCommand,
  nextSortState,
  setSortColumnCommand,
  setSortDescendingCommand,
  toggleCompareEntryCommand,
} from "domain/buildingCatalogContracts";
import { anchorScrollTop, shouldLoadMore } from "domain/catalogWindow";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  getBuildingDetailMetrics,
  getNumberSeparators,
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
import { getSearchScopeNotice } from "domain/buildingSearchRank";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { canPlace, isEntryLocked } from "domain/buildingLockState";
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import {
  getLensAnchor,
  getLensAnchorKey,
  getLensDisclosure,
  setLensAnchor,
  setLensDisclosure,
} from "domain/buildingLensViewState";
// The view mode and group dimension are shared with the control plane, which is
// a sibling of this panel rather than a descendant, so they go through the
// subscribing hook rather than getLensChoice/setLensChoice directly.
import { useLensChoice } from "mods/useLensChoice";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import {
  DEFAULT_GROUP_DIMENSION,
  defaultGroupDimensionFor,
  groupDimensionLabel,
  isGroupDimension,
  type GroupDimensionId,
} from "domain/buildingGroups";
// The rail, the metric popover and the filter summary all live in the chip row
// now, so the catalog no longer owns any filter chrome — only results.
import {
  BUILDING_LENS_COLUMN_SORT,
  getBuildingLensColumnSortIndicator,
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
// The section decides the grouping until the player picks one themselves.
const BuildingLensSection$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");
// Non-empty means the lens is standing in for a vanilla menu that has a tab
// strip, which decides the default grouping.
const BuildingLensMenuCategories$ = bindValue<unknown[]>(mod.id, "BuildingLensMenuCategories", []);

const LENS_VIEW_MODE_KEY = "viewMode";
const LENS_GROUP_KEY = "groupBy";

/** Grid recognises, List scans, Table compares. */
type ViewMode = CatalogViewMode;


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
  // The player's own thousands/decimal marks, so our columns agree with the
  // numbers the game is drawing elsewhere on the same screen.
  const separators = getNumberSeparators(translate);
  // The same card every other view mode shows. The table had none, so it was
  // the one mode that could not answer a question its columns had no room for.
  const hoverCard = useHoverCardContext();
  // The table's scroll container, read by the passive load-more check.
  // cs2/ui's Scrollable forwards its ref to the scrolling div.
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const page = useValue(BuildingCatalog$);
  const panelWidth = useValue(PanelWidth$);
  const currentSearch = useValue(CurrentSearch$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const section = useValue(BuildingLensSection$);
  const menuHasCategories = (useValue(BuildingLensMenuCategories$) ?? []).length > 0;
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  // Grid by default: recognising a thumbnail is the fast path back to the map,
  // and the table is for the rarer moment when you are genuinely comparing.
  // Survives remount for the same reason the drawers do — placing a building
  // unmounts this panel.
  const defaultToTable = useValue(LensDefaultToTable$);
  // Three modes now, so a boolean no longer says it. The setting still supplies
  // the starting point; the in-session choice overrides it and survives the
  // remount that placing a building causes.
  // Shared with the control plane, which is a sibling of this panel rather
  // than a descendant, so a plain useState here would let the two disagree.
  const [viewModeChoice] = useLensChoice(
    LENS_VIEW_MODE_KEY,
    defaultToTable ? "table" : "grid"
  );
  // The choice is obeyed at every height. It used to be overridden to "grid"
  // whenever the panel rested at strip height, to save a player who had left
  // the control on Table from a mode clipped to a sliver. The cost was worse
  // than the thing it prevented: at the resting height — which is the default —
  // pressing List, Cards or Table lit the button, changed nothing, and said
  // nothing about why. A control that reports a state it is not in is the same
  // defect as a control that is missing.
  //
  // The height is the player's to set, so the sliver is theirs to fix.
  const viewMode = viewModeChoice as ViewMode;
  const tableMode = viewMode === "table";
  // Empty means "nobody has chosen", which is different from having chosen
  // None — the first follows the section, the second stays flat.
  const [chosenGroupBy] = useLensChoice(LENS_GROUP_KEY, "");
  const groupBy: GroupDimensionId = isGroupDimension(chosenGroupBy)
    ? chosenGroupBy
    : defaultGroupDimensionFor(section, menuHasCategories);
  // The dimension is also the query's primary sort key, so the backend has to
  // reorder — grouping the page here alone would split a group across a page
  // boundary and the heading would stop describing the rows under it. This
  // fires for a section change too, not just an explicit pick, because the
  // effective dimension moves either way.
  useEffect(() => {
    trigger(mod.id, "SetBuildingCatalogGroupBy", groupBy);
  }, [groupBy]);
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
  // The window is the backend's: it grows by Limit and always comes back as a
  // prefix of the same ordering, so there is nothing to accumulate here and
  // nothing to page. hasMore is C#'s answer, because it is the only side that
  // knows both the match count and the ceiling — a client computing
  // `rendered < total` would keep offering to load rows the backend has
  // already refused to serve.
  const hasMore = page?.hasMore ?? false;
  const density = getBuildingLensDensity(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH);
  const rowGeometry = getBuildingLensRowGeometry(density);
  const catalogMaxHeight = getBuildingLensCatalogMaxHeight(typeof window === "undefined" ? 720 : window.innerHeight);
  const placeLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Place]", "Place") ?? "Place";
  const inspectLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Inspect]", "Details") ?? "Details";
  const lockedLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Locked]", "Locked") ?? "Locked";
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
  /**
   * "Nothing here, {n} elsewhere" and the button that goes there.
   *
   * Built once and rendered by every view mode. It used to live only in the
   * grid branch, so a search that missed in Table mode said "No buildings
   * match" and stopped — no count of what existed elsewhere, and no way to
   * reach it. The widen control is the whole answer to a scoped miss; which
   * view mode you happen to be in has nothing to do with it.
   */
  const scopeNoticeBlock = scopeNotice ? (
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
  ) : null;
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

  /**
   * Draws one leaf's entries in whichever mode is active.
   *
   * Grouping is a property of the result, not of a mode, so all three render
   * the same tree. The zoning view is the same idea by hand — family, density,
   * tiles — which is why it can eventually drop its bespoke component.
   */
  function toggleExpanded(id: number): void {
    setExpandedId((current) => (current === id ? null : id));
  }

  function activate(entry: BuildingCatalogEntry): void {
    // A milestone-locked asset cannot be placed, and vanilla refuses the same
    // selection (ToolbarUISystem.cs:924). Guarded here rather than in the C#
    // TryActivatePrefabTool, which the arrow-key grid navigation also calls to
    // move the selection — refusing there would stop the cursor dead on a
    // locked tile instead of stepping past it.
    if (!canPlace(entry)) return;

    // Remember where we were before the panel goes. Placing unmounts the whole
    // lens, so this is the last moment the current scroll position exists — and
    // the building just chosen is the right thing to come back to, because it
    // is what the player was looking at.
    setLensAnchor(anchorKey, entry.id);

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

  // "Sort by <field>" opens the sort options, and that is the only thing that
  // does. There used to be three controls for one job: this chip dropped its
  // own menu, a "More sorting" button at the far right revealed a second copy
  // of the same list, and the direction arrow — nested inside the chip — could
  // only open the menu it sat in. One toggle, one list.
  function setSort(column: SortColumn): void {
    const next = nextSortState({ column: sortColumn, descending }, column);

    // No local echo: the backend owns the order and publishes it back, so
    // mirroring it here would just reintroduce a second source of truth. The
    // window shrinks back to one chunk on the C# side, because a sort change
    // reorders everything and holding 2,000 rows open across it would spend the
    // cost of a window the player is no longer looking through.
    for (const command of [setSortColumnCommand(next.column), setSortDescendingCommand(next.descending)]) {
      trigger(mod.id, command.method, ...command.args);
    }
  }

  // Scoped to the surface and the layout, because which element owns the scroll
  // and how tall its children are both depend on them — an offset remembered in
  // the table means nothing in the grid. Not the flat "viewMode" namespace the
  // choice store uses, which BuildingCatalog and ZoningHierarchy already share
  // by accident.
  const anchorKey = getLensAnchorKey({ surface: "catalog", viewMode, groupBy });

  useEffect(() => {
    const anchored = getLensAnchor(anchorKey);

    if (anchored === null || items.length === 0) {
      return;
    }

    // Cleared on sight: this is a one-shot restore, and leaving it set would
    // yank the list back every time the window grew.
    setLensAnchor(anchorKey, null);

    const row = document.querySelector(`[data-catalog-entry="${anchored}"]`);

    if (!(row instanceof HTMLElement)) {
      // The anchor fell out of the match set — a predicate changed while the
      // panel was down. Top of the list is the honest answer.
      return;
    }

    let scroller: HTMLElement | null = row.parentElement;

    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }

    if (!scroller) {
      return;
    }

    scroller.scrollTop = anchorScrollTop(
      scroller.scrollTop,
      row.getBoundingClientRect().top,
      scroller.getBoundingClientRect().top,
      scroller.clientHeight,
    );
    // items.length rather than items: the effect has to wait for the rows to be
    // in the document before it can find one, and a new array identity every
    // publish would re-run it on data that has not moved.
  }, [anchorKey, items.length]);

  /**
   * Asks the backend for the next chunk.
   *
   * Guarded against re-entry by `hasMore` alone rather than by a local "loading"
   * flag: the backend republishes the whole window, so a second request that
   * overtakes the first is idempotent, while a stale local flag could latch on
   * and stop the list growing for the rest of the session.
   */
  function loadMore(): void {
    if (!hasMore) {
      return;
    }

    const command = loadMoreCatalogCommand();
    trigger(mod.id, command.method, ...command.args);
  }

  /**
   * The passive half of the trigger.
   *
   * cs2/ui's Scrollable declares an onScroll prop, and NOTHING in this repo has
   * ever used it, so whether the engine fires it is unproven — synthetic wheel
   * and thumb-drag events cannot be constructed in Cohtml (WheelEvent and
   * PointerEvent are both undefined), so it could not be measured from the
   * outside either. That is why the visible Load more control below is the
   * mechanism and this is the upgrade: if it fires, the list grows before the
   * player reaches the button; if it never fires, nothing is lost.
   */
  function onCatalogScroll(container: HTMLElement | null): void {
    if (!container || !hasMore) {
      return;
    }

    if (shouldLoadMore({
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
    })) {
      loadMore();
    }
  }

  /*
   * The end of the feed, rendered as the last child INSIDE whichever element
   * owns the scroll — which differs by view mode, so it is passed down rather
   * than placed here. Below the scroll is where the pager used to live, and the
   * reason nobody read it.
   *
   * It is the MECHANISM, not a fallback. cs2/ui's Scrollable declares an
   * onScroll prop that nothing in this repo has ever used, and it could not be
   * measured from outside the game: Cohtml has no IntersectionObserver, and
   * neither WheelEvent nor PointerEvent can be constructed, so no synthetic
   * scroll exists to test it with. If onScroll does fire, the passive check
   * grows the list before the player ever reaches this button. If it never
   * fires, this still works.
   */
  const catalogFooter = hasMore ? (
    <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
      {translate("Tooltip.LABEL[FindItBuildingMenu.LoadMore]", "Load more") ?? "Load more"}
    </Button>
  ) : null;

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
      {/* The toolbar band that used to sit here — identity, count, search
          context, Group by, Sort by, view mode and "More sorting" — is gone.
          It lives in the control plane beside the panel now (LensControlPane),
          which is visible at the strip height this panel rests at. The band
          was gated on `expanded`, so every control it carried was missing
          exactly when the panel was smallest and needed them most. */}

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
                      Cost {formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)} · Upkeep {formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)} · Workers {formatBuildingMetric(entry.workers, "workers", separators)} · Capacity {formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}
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
        {/* The rows scroll and this header does not, so the scrollbar narrows
            them and would leave every value sitting left of its heading. The
            header reserves the track only while there is one. */}
        {/* The scrollbar gutter is reserved unconditionally now. It used to
            be reserved only when total > rendered, which was a has-more-pages
            test doing duty as a will-this-overflow test — under a growing
            window that flips false exactly when the list is longest, so every
            metric value shifted out from under its heading at the end of a
            load. A few rem of padding cannot desync. */}
        <div className={styles.columnHeader} data-rows-scrollable="true">
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
          data-scrollable="true"
          ref={rowsRef}
          onScroll={() => onCatalogScroll(rowsRef.current)}
        >
          {items.length === 0 && (
            status === "indexing"
              ? <div className={styles.empty}>
                  {translate("Tooltip.LABEL[FindItBuildingMenu.IndexingBuildings]", "Indexing buildings…")}
                </div>
              : scopeNoticeBlock ?? <div className={styles.empty}>{emptyStateMessage}</div>
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
            const detailMetrics = isExpanded ? getBuildingDetailMetrics(entry, separators) : [];
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
              <div
                key={entry.id}
                className={styles.row}
                // How the scroll anchor finds this row again after the panel is
                // rebuilt. An id rather than a position, because the window can
                // come back a different length and these rows are not a uniform
                // height — an expanded one is height: auto.
                data-catalog-entry={entry.id}
                data-expanded={isExpanded ? "true" : undefined}
                data-locked={isEntryLocked(entry) ? "true" : undefined}
              >
                {/* The same card the grid, list and cards show. The table had
                    none at all, so it was the one mode that could not answer a
                    question its own columns did not have room for.

                    Wrapping .rowSelect rather than the row: the row also holds
                    Place and the compare control, which are not this building's
                    description. cs2/ui's Tooltip clones its child instead of
                    wrapping it in an element, so the flex row is unaffected.

                    No title= alongside it — that would put two tooltips on one
                    control. */}
                <BuildingHoverCard entry={entry} context={hoverCard}>
                <Button
                  className={styles.rowSelect}
                  variant="icon"
                  onSelect={() => toggleExpanded(entry.id)}
                  aria-label={rowInspectLabel}
                  data-expanded={isExpanded ? "true" : undefined}
                >
                  <div className={styles.identityCell}>
                    <div className={styles.thumbnail}>
                      {entry.thumbnail && (
                        <img
                          src={entry.thumbnail}
                          onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                        />
                      )}
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
                  <div className={classNames(styles.metric, styles.metricCost)} title={`Cost ${formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)}`}>
                    {formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricUpkeep)} title={`Upkeep ${formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)}`}>
                    {formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricWorkers)} title={`Workers ${formatBuildingMetric(entry.workers, "workers", separators)}`}>
                    {formatBuildingMetric(entry.workers, "workers", separators)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricCapacity)} title={`Capacity ${formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}`}>
                    {formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricLot)} title="Lot dimensions">
                    {formatLotDimensions(entry.lotWidth, entry.lotDepth)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricLevel)} title="Building level">
                    {entry.buildingLevel}
                  </div>
                  <div
                    className={classNames(styles.parking, styles.metricParking, entry.hasParking && styles.parkingActive)}
                    title={entry.hasParking ? `${entry.parkingSlots} parking bays (approximate)` : "No parking"}
                  >
                    {/* The count, not a "P". A glyph answered "does it park
                        cars", which is rarely the question — between two car
                        parks the answer is yes either way. Still not the no-data
                        dash for zero: a building with no parking is a fact
                        rather than a gap. */}
                    {entry.hasParking ? entry.parkingSlots : "·"}
                  </div>
                </Button>
                </BuildingHoverCard>
                {/* Placing is now an explicit act. The whole row used to be a
                    Place button, so there was no way to look at a building
                    without committing to it — and placement closes the panel. */}
                <Button
                  className={styles.rowPlaceButton}
                  variant="icon"
                  // activate() already refuses, but a Place button that looks
                  // live and does nothing is worse than one that says it cannot.
                  disabled={isEntryLocked(entry)}
                  onSelect={() => activate(entry)}
                  aria-label={isEntryLocked(entry) ? `${rowPlaceLabel} — ${lockedLabel}` : rowPlaceLabel}
                  title={isEntryLocked(entry) ? lockedLabel : rowPlaceLabel}
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
          {catalogFooter}
        </Scrollable>
        </>
      ) : (
        <>
          {scopeNoticeBlock}
          {/* The table names what emptied it; the grid used to show a blank
              box. Filters compose now, so an empty intersection is easy to
              reach by accident — "Health & Deathcare" plus role "Police
              Station" is nothing, and silence there reads as a broken panel. */}
          {items.length === 0
            ? (scopeNotice
                // The notice above already says the set is empty AND what to do
                // about it. A second line reading "No buildings match search
                // "police"" under "No matches here — 5 elsewhere" says it twice
                // and the second one contradicts the first.
                ? null
                : <div className={styles.empty}>{emptyStateMessage}</div>)
            : (
              <GroupedResults
                entries={items}
                groupBy={groupBy}
                viewMode={viewMode}
                searchText={currentSearch ?? ""}
                onPlace={activate}
                footer={catalogFooter}
                onScrolled={onCatalogScroll}
              />
            )}
        </>
      )}

    </div>
  );
};
