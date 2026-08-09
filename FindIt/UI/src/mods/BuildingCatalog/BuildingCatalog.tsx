import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useEffect, useRef, useState } from "react";
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
  getCatalogWindowBadge,
  getCatalogWindowSummary,
  clearCompareEntriesCommand,
  loadMoreCatalogCommand,
  nextSortState,
  setSortColumnCommand,
  setSortDescendingCommand,
  toggleCompareEntryCommand,
} from "domain/buildingCatalogContracts";
import {
  CATALOG_ANCHOR_MAX_FRAMES,
  anchorScrollTop,
  isAnchorMeasurable,
  isAnchorOnScreen,
  isScrollContainer,
  shouldLoadMore,
} from "domain/catalogWindow";
import type { AnchorGeometry } from "domain/catalogWindow";
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
  getLensChoice,
  getLensDisclosure,
  setLensAnchor,
  setLensChoice,
  setLensDisclosure,
} from "domain/buildingLensViewState";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import {
  DEFAULT_GROUP_DIMENSION,
  GROUP_DIMENSIONS,
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

/**
 * The element that actually scrolls, found by walking up from a row.
 *
 * By walking rather than by ref, because cs2/ui's `Scrollable` silently drops
 * props it does not recognise — the `data-scrollable` marker that used to sit
 * on one of them never reached the DOM at all — and which element owns the
 * scroll differs by view mode anyway.
 *
 * The overflow threshold is the point: a plain `scrollHeight > clientHeight`
 * walk stops at the first container that sub-pixel rounding pushed one pixel
 * over, which is not the one the player is moving. See
 * CATALOG_SCROLL_MIN_OVERFLOW.
 */
function findScrollContainer(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from.parentElement;

  while (node && !isScrollContainer(node.scrollHeight, node.clientHeight)) {
    node = node.parentElement;
  }

  return node;
}

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
  const page = useValue(BuildingCatalog$);
  const panelWidth = useValue(PanelWidth$);
  const currentSearch = useValue(CurrentSearch$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const section = useValue(BuildingLensSection$);
  const menuHasCategories = (useValue(BuildingLensMenuCategories$) ?? []).length > 0;
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
  // Empty means "nobody has chosen", which is different from having chosen
  // None — the first follows the section, the second stays flat.
  const [chosenGroupBy, setChosenGroupBy] = useState<string>(() => getLensChoice(LENS_GROUP_KEY, ""));
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const groupBy: GroupDimensionId = isGroupDimension(chosenGroupBy)
    ? chosenGroupBy
    : defaultGroupDimensionFor(section, menuHasCategories);
  const setGroupBy = (next: GroupDimensionId) => {
    setLensChoice(LENS_GROUP_KEY, next);
    setChosenGroupBy(next);
    setGroupPickerOpen(false);
  };

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
  const windowSummary = getCatalogWindowSummary(items.length, totalCount, separators);
  const windowBadge = getCatalogWindowBadge(items.length, totalCount, separators);
  const density = getBuildingLensDensity(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH);
  const rowGeometry = getBuildingLensRowGeometry(density);
  const catalogMaxHeight = getBuildingLensCatalogMaxHeight(typeof window === "undefined" ? 720 : window.innerHeight);
  const sortPresentation = getBuildingLensSortPresentation({ column: sortColumn, descending });
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
  // One register for both pickers. These used to disagree: the sort control
  // announced "Sorted by Name, ascending" while the group control announced a
  // bare "Category", so the two halves of a matched pair read as different
  // kinds of thing to anyone listening rather than looking.
  const groupedByLabel = (
    translate("Tooltip.LABEL[FindItBuildingMenu.GroupedBy]", "Grouped by {0}") ?? "Grouped by {0}"
  ).replace("{0}", groupByLabel);
  const sortDirectionLabel = descending
    ? translate("Tooltip.LABEL[FindItBuildingMenu.SortDirectionDescending]", "descending") ?? "descending"
    : translate("Tooltip.LABEL[FindItBuildingMenu.SortDirectionAscending]", "ascending") ?? "ascending";
  const sortedByLabel = (
    translate("Tooltip.LABEL[FindItBuildingMenu.SortedBy]", "Sorted by {0}, {1}") ?? "Sorted by {0}, {1}"
  )
    .replace("{0}", sortPresentation.compact.label)
    .replace("{1}", sortDirectionLabel);
  const sortByOptionLabel = (label: string): string =>
    (translate("Tooltip.LABEL[FindItBuildingMenu.SortByOption]", "Sort by {0}") ?? "Sort by {0}")
      .replace("{0}", label);
  // The same string the sorted column header uses for the same gesture.
  const reverseSortLabel =
    translate("Tooltip.LABEL[FindItBuildingMenu.ReverseSort]", "reverse this sort") ?? "reverse this sort";

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
  function toggleSortOptions(): void {
    setGroupPickerOpen(false);
    setSortingExpanded((expanded) => !expanded);
  }

  function openGroupPicker(): void {
    setSortingExpanded(false);
    setGroupPickerOpen((open) => !open);
  }

  // Picking a group closes the menu. It overlays the results, and a menu that
  // stays up after it has been used hides the change it just made. The sort
  // options are a band rather than an overlay, so they stay: re-picking the
  // active field is how you reverse it.
  function chooseGroupBy(id: GroupDimensionId): void {
    setGroupPickerOpen(false);
    setGroupBy(id);
  }

  /** Reverse without changing the field: nextSortState flips on a repeat. */
  function reverseSort(): void {
    setSort(sortColumn);
  }

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

  /**
   * Put the player back where they were, over as many frames as it takes.
   *
   * This is a retry loop rather than a single measurement because Cohtml lays
   * out asynchronously: on the frame the panel remounts, every rect it reports
   * is zero (see `isAnchorMeasurable`), and the window itself is still arriving
   * from C# — the scroll height was measured growing from 1,440 to 3,606 across
   * the same handful of frames. Both settle within a few frames, but neither
   * settles by the time a `useEffect` runs.
   *
   * Each frame does one of three things: wait, because the geometry is not real
   * yet; apply the scroll and check it next frame; or stop, because the row is
   * on screen, the budget ran out, or the anchor is not in this match set.
   */
  useEffect(() => {
    const anchored = getLensAnchor(anchorKey);

    if (anchored === null || items.length === 0) {
      return;
    }

    let frame = 0;
    let handle = 0;
    let cancelled = false;

    // Cleared only when the loop finishes, not on sight. Clearing up front lost
    // the anchor to the first frame's zero-height rects and left the restore
    // looking like it had run.
    const finish = () => {
      setLensAnchor(anchorKey, null);
    };

    const measure = (): { row: HTMLElement; scroller: HTMLElement; geometry: AnchorGeometry } | null => {
      // The LAST match, not the first. The grid's "frequently placed" shelf
      // renders the same entries above the body with the same attribute, and
      // the shelf is pinned in view — anchoring to that copy would report the
      // row on screen without scrolling anything, which is a silent no-op
      // dressed as a success.
      const rows = document.querySelectorAll(`[data-catalog-entry="${anchored}"]`);
      const row = rows.length === 0 ? null : rows[rows.length - 1];

      if (!(row instanceof HTMLElement)) {
        return null;
      }

      const scroller = findScrollContainer(row);

      if (!scroller) {
        return null;
      }

      const rowRect = row.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();

      return {
        row,
        scroller,
        geometry: {
          containerTop: scrollerRect.top,
          containerHeight: scroller.clientHeight,
          rowTop: rowRect.top,
          rowHeight: rowRect.height,
        },
      };
    };

    const step = () => {
      if (cancelled) {
        return;
      }

      if (frame++ >= CATALOG_ANCHOR_MAX_FRAMES) {
        // The row never became reachable — a predicate changed while the panel
        // was down, or it sits beyond a window that stopped growing. Top of the
        // list is the honest answer, and it is where we already are.
        finish();
        return;
      }

      const measured = measure();

      if (measured === null) {
        // Not rendered yet, or not in this match set at all. Both look the same
        // from here and both are worth another frame, up to the budget.
        handle = requestAnimationFrame(step);
        return;
      }

      if (!isAnchorMeasurable(measured.geometry)) {
        handle = requestAnimationFrame(step);
        return;
      }

      if (isAnchorOnScreen(measured.geometry)) {
        finish();
        return;
      }

      measured.scroller.scrollTop = anchorScrollTop(
        measured.scroller.scrollTop,
        measured.geometry.rowTop,
        measured.geometry.containerTop,
        measured.geometry.containerHeight,
      );

      // Verify next frame rather than trusting the arithmetic: it was computed
      // against a list that is still being filled, so the row it aimed at moves.
      handle = requestAnimationFrame(step);
    };

    handle = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
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
   * The passive half of the trigger: watch where the scroll actually is.
   *
   * This polls instead of listening because, measured live on 2026-08-09, there
   * is nothing to listen to. cs2/ui's `Scrollable` accepts an `onScroll` prop
   * and never forwards it: walking the fiber from the scrolling div to the
   * Scrollable shows the prop arriving and no DOM node below it carrying an
   * onScroll — and a sweep of every element in the running UI found not one
   * scroll or wheel handler anywhere. Cohtml also emits no native `scroll`
   * event when `scrollTop` changes, so adding our own listener would be just as
   * dead. The engine scrolls its own overflow containers and tells no one.
   *
   * What it does do is keep `scrollTop` readable and accurate, so a frame loop
   * sees the player arrive at the bottom just as well as an event would. It
   * only runs while there is more to fetch, and it stops the moment it asks:
   * the request changes `items.length`, which restarts the effect against the
   * larger window.
   */
  useEffect(() => {
    if (!hasMore || items.length === 0) {
      return;
    }

    let handle = 0;
    let cancelled = false;

    const step = () => {
      if (cancelled) {
        return;
      }

      // Last again, and for the same reason: the shelf sits outside the body's
      // scroll, so walking up from the first entry can find the panel instead
      // of the list.
      const rows = document.querySelectorAll("[data-catalog-entry]");
      const row = rows.length === 0 ? null : rows[rows.length - 1];
      const scroller = row instanceof HTMLElement ? findScrollContainer(row) : null;

      if (scroller && shouldLoadMore({
        scrollTop: scroller.scrollTop,
        clientHeight: scroller.clientHeight,
        scrollHeight: scroller.scrollHeight,
      })) {
        loadMore();
        return;
      }

      handle = requestAnimationFrame(step);
    };

    handle = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [hasMore, items.length, viewMode, groupBy]);

  /*
   * The end of the feed, rendered as the last child INSIDE whichever element
   * owns the scroll — which differs by view mode, so it is passed down rather
   * than placed here. Below the scroll is where the pager used to live, and the
   * reason nobody read it.
   *
   * Kept even though the frame loop above now grows the list unaided: a player
   * who reaches the bottom faster than the round trip through C# still wants
   * something to press, and it is the only visible statement that more exists.
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
      {/* Identity, result count, search context and sort used to be two
          full-width bands stacked above the table, each carrying a single short
          line. Measured against a real city they cost 84px of a 625px panel
          while the rows themselves only got 159px. One toolbar carries all of
          it. */}
      <div className={styles.toolbar}>
        <img className={styles.titleIcon} src={BUILDING_LENS_TITLE_ICON} alt="" />
        <div className={styles.title}>{translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLens]", "Building lens")}</div>
        {/* How much of the match set is on screen, in the one part of the panel
            that never scrolls. The old count lived in the pager below the
            scroll, so reading it meant travelling to the end of the list — and
            it only existed in table view at all. */}
        <div className={styles.count} title={windowSummary} aria-label={windowSummary}>{windowBadge}</div>
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
            onSelect={openGroupPicker}
            aria-expanded={groupPickerOpen}
            aria-label={groupedByLabel}
            title={groupByLabel}
          >
            <span className={styles.sortSummaryLabel}>{groupByLabel}</span>
            {/* A disclosure caret, not a sort direction — separate classes
                because they looked identical and meant different things.
                U+25BC, not the small U+25BE: the game's font stack has no small
                triangles, so ▾ drew as a notdef box — the one mark saying this
                control opens was the one glyph that would not render. */}
            <span className={styles.disclosureCaret} aria-hidden="true">▼</span>
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
                    onSelect={() => chooseGroupBy(dimension.id)}
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
        {/* Built the same way as the group picker above, because it is the same
            kind of control and was drawn to look like one. It used to be a bare
            <div> with no handler: identical chrome, identical position, and
            clicking it did nothing, so the pair taught two opposite lessons
            about the same affordance. Sorting was reachable only from "More
            sorting" at the far right. */}
        <div className={styles.sortPicker}>
          <Button
            className={styles.sortSummary}
            variant="icon"
            onSelect={toggleSortOptions}
            aria-expanded={sortingExpanded}
            aria-label={sortedByLabel}
            title={moreSortingLabel}
          >
            <span className={styles.sortSummaryLabel}>{sortPresentation.compact.label}</span>
          </Button>
          {/* Its own button, deliberately. As a <span> inside the chip above,
              the one gesture that reads as "reverse this" was the one that
              could not: the click bubbled to the chip and opened a menu. */}
          <Button
            className={styles.sortDirectionButton}
            variant="icon"
            onSelect={reverseSort}
            aria-label={reverseSortLabel}
            title={reverseSortLabel}
          >
            <span className={styles.sortDirection} aria-hidden="true">{sortPresentation.compact.indicator}</span>
          </Button>
        </div>
        <ViewModeBar value={viewMode} onChange={setViewMode} />
      </div>

      {sortingExpanded && (
        <div className={styles.sortOptions} data-sort-options="expanded">
          {sortPresentation.expanded.map((option) => (
            <Button
              key={option.key}
              className={classNames(styles.sortButton, option.selected && styles.sortButtonSelected)}
              variant="icon"
              onSelect={() => setSort(option.key)}
              aria-label={sortByOptionLabel(option.label)}
              title={sortByOptionLabel(option.label)}
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

        {/* No data-* marker on this one: cs2/ui's Scrollable drops props it
            does not know, so the attribute that used to be here never reached
            the DOM. The scroll container is found by walking up from a row. */}
        <Scrollable
          className={styles.rows}
          vertical
          trackVisibility="scrollable"
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
            : (
              <GroupedResults
                entries={items}
                groupBy={groupBy}
                viewMode={viewMode}
                searchText={currentSearch ?? ""}
                onPlace={activate}
                footer={catalogFooter}
              />
            )}
        </>
      )}

    </div>
  );
};
