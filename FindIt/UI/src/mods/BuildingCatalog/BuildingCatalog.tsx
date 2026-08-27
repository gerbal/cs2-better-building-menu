import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { shortenTileLabel, tableLabelCharBudget } from "domain/tileLabel";
import mod from "../../../mod.json";
import { BuildingCatalogEntry, BuildingCatalogPage, formatBuildingCatalogLabels } from "domain/buildingCatalog";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  getBuildingLensCatalogMaxHeight,
  BUILDING_LENS_IDENTITY_MIN,
  BUILDING_LENS_CONTROL_PANE_TOTAL,
  BUILDING_LENS_TABLE_ROW_FURNITURE,
  getBuildingLensColumnWidths,
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
import {
  CATALOG_ANCHOR_MAX_FRAMES,
  anchorScrollTop,
  revealScrollTop,
  isAnchorMeasurable,
  isAnchorOnScreen,
  isScrollContainer,
  catalogWindowRemaining,
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
  getBuildingExtensionLabels,
  getBuildingFlagGroups,
  getBuildingProvenanceChips,
  resolveAssetDescription,
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
import { canPlace, entryStateWord, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
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
  isEducationMenu,
  flattenGroupedRows,
  groupDimensionLabel,
  isGroupDimension,
  type GroupDimensionId,
} from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
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
const BuildingLensStripAxis$ = bindValue<string>(mod.id, "BuildingLensStripAxis", "");
const BuildingLensMenu$ = bindValue<string>(mod.id, "BuildingLensMenu", "");
const BuildingLensMenuCategories$ = bindValue<unknown[]>(mod.id, "BuildingLensMenuCategories", []);

/**
 * Breathing room under a revealed detail, in CSS pixels.
 *
 * Small on purpose: this is the difference between the last line touching the
 * panel edge and sitting just clear of it, not an attempt to centre anything.
 */
const EXPANDED_ROW_REVEAL_MARGIN = 6;

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
  const stripAxis = useValue(BuildingLensStripAxis$) ?? "";
  const menu = useValue(BuildingLensMenu$) ?? "";
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
    : defaultGroupDimensionFor(section, menuHasCategories, stripAxis, isEducationMenu(menu));
  // The dimension is also the query's primary sort key, so the backend has to
  // reorder — grouping the page here alone would split a group across a page
  // boundary and the heading would stop describing the rows under it. This
  // fires for a section change too, not just an explicit pick, because the
  // effective dimension moves either way.
  useEffect(() => {
    trigger(mod.id, "SetBuildingCatalogGroupBy", groupBy);
  }, [groupBy]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /**
   * Bring a freshly expanded row's detail into view.
   *
   * Expanding grows the row downward and the list did not follow. Measured
   * live: a detail's bottom sat at 642 against a viewport whose content ends at
   * 630, with scrollTop still 0 — twelve pixels under the fold and no cue they
   * were there. Reported from play as "some of it was cut off below the
   * scroll", and cm-qnfs made the detail taller, so it will happen more often.
   *
   * A ResizeObserver rather than a rAF, because the box being measured is the
   * one that just changed size: Cohtml lays out a frame late, so a single rAF
   * reads the PRE-expansion height and concludes nothing overflows. The
   * observer fires when the new height actually exists, and disconnects on the
   * first reveal so a later resize — the player dragging the panel — does not
   * yank the list.
   */
  useEffect(() => {
    if (expandedId === null) {
      return;
    }

    const rows = document.querySelectorAll(`[data-catalog-entry="${expandedId}"]`);
    const row = rows.length === 0 ? null : rows[rows.length - 1];

    if (!(row instanceof HTMLElement)) {
      return;
    }

    const detail = row.querySelector(`.${styles.rowDetails}`) ?? row;
    const scroller = findScrollContainer(row);

    if (!scroller || !(detail instanceof HTMLElement)) {
      return;
    }

    let done = false;
    const observer = new ResizeObserver(() => {
      if (done) {
        return;
      }

      const rowRect = row.getBoundingClientRect();
      const detailRect = detail.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();

      // Nothing has laid out yet; wait for the next notification rather than
      // computing a reveal from zeroes.
      if (detailRect.height === 0) {
        return;
      }

      const next = revealScrollTop({
        currentScrollTop: scroller.scrollTop,
        rowTop: rowRect.top,
        detailBottom: detailRect.top + detailRect.height,
        containerTop: scrollerRect.top,
        containerHeight: scroller.clientHeight,
        margin: EXPANDED_ROW_REVEAL_MARGIN,
      });

      done = true;

      if (next !== scroller.scrollTop) {
        scroller.scrollTop = next;
      }
    });

    observer.observe(detail);

    return () => observer.disconnect();
  }, [expandedId]);
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
  // One set of numbers for the header and every row. The columns line up only
  // because both read the same widths; computing them twice is how a table with
  // no CSS grid drifts out of alignment.
  const columnWidths = getBuildingLensColumnWidths(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH);
  const columnStyle = (metric: BuildingLensMetric) => ({
    width: `${columnWidths[metric]}rem`,
    flexBasis: `${columnWidths[metric]}rem`,
  });
  // The width the NAME actually gets.
  //
  // panelWidth is NOT the panel: it is the whole ASSEMBLY, control pane
  // included. BuildingLensWidth's own remark says so — "the build menu and the
  // control plane beside it… the assembly, pane included" — and
  // BuildingMenuSurface subtracts the pane from it to size the
  // panel. Two earlier attempts at this budget both missed that and produced a
  // number roughly 2.2x too large, so shortenTileLabel returned every name
  // untouched and CSS went on clipping the tail — the exact defect being fixed.
  //
  // Verified by measurement rather than arithmetic: with the pane subtracted
  // this yields ~276rem against a live identity cell of 295rem (197px). Erring
  // slightly small is the safe direction — it shortens a little sooner rather
  // than never.
  const nameWidth = Math.max(
    BUILDING_LENS_IDENTITY_MIN - BUILDING_LENS_TABLE_ROW_FURNITURE,
    panelWidth
      - BUILDING_LENS_CONTROL_PANE_TOTAL
      - Object.values(columnWidths).reduce((total, width) => total + width, 0)
      - BUILDING_LENS_TABLE_ROW_FURNITURE
  );
  const nameBudget = tableLabelCharBudget(nameWidth);
  const rowGeometry = getBuildingLensRowGeometry(density);
  const catalogMaxHeight = getBuildingLensCatalogMaxHeight(typeof window === "undefined" ? 720 : window.innerHeight);
  const placeLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Place]", "Place") ?? "Place";
  const inspectLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Inspect]", "Details") ?? "Details";
  const lockedLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Locked]", "Locked") ?? "Locked";
  const builtLabel =
    translate("Toolbar.ASSET_ALREADY_BUILT", "")
    || translate("Tooltip.LABEL[FindItBuildingMenu.AlreadyBuilt]", "Already built")
    || "Already built";
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
  // The number, not just the offer. "Load more" under a grid that also names
  // no number left the window invisible: on Landscaping that is 100 rows of
  // 368 with nothing on screen admitting it. Saying both ends — what is shown,
  // and what pressing this gets you — is the difference between a truncated
  // list and a list you know is truncated.
  const remaining = catalogWindowRemaining({ shown: items.length, total: totalCount });
  const catalogFooter = hasMore ? (
    <div className={styles.loadMoreRow}>
      <span className={styles.windowState}>
        {(translate("Tooltip.LABEL[FindItBuildingMenu.ShowingOfTotal]", "Showing {0} of {1}")
          ?? "Showing {0} of {1}")
          .replace("{0}", `${items.length}`)
          .replace("{1}", `${totalCount}`)}
      </span>
      <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
        {remaining === null
          ? translate("Tooltip.LABEL[FindItBuildingMenu.LoadMore]", "Load more") ?? "Load more"
          : (translate("Tooltip.LABEL[FindItBuildingMenu.LoadMoreCount]", "Load {0} more")
            ?? "Load {0} more").replace("{0}", `${Math.min(remaining, limit)}`)}
      </Button>
    </div>
  ) : null;

  return (
    <div
      className={classNames(styles.catalog, densityClassNames[density])}
      data-density={density}
      data-row-height={rowGeometry.rowHeight}
      data-selector-height={rowGeometry.selectorHeight}
      data-metric-text-scale={getBuildingLensMetricTextScale(density)}
      // No max-height. The panel states its own height now (MainContainer sets
      // it from the player's setting), and .catalog is flex: 1 1 auto inside
      // it, so filling the panel is the correct behaviour and a second ceiling
      // here can only be lower than the first. It was: this capped at 765rem
      // against a panel that now reaches 960rem, so a fully expanded menu left
      // ~130px of empty panel below the last row — reported on the networks
      // list, but true of every view at that height.
      data-catalog-max-height={catalogMaxHeight}
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
          {/* "Name", not "Building". The sort control offers a field called Name
              (buildingLensSortPresentation.ts:22) and sorting by it reorders
              THIS column, so two names for one field made the chip look like it
              acted on something else. The column also holds roads, props and
              zones, none of which are buildings. */}
          <span className={styles.identityHeader}>{translate("Tooltip.LABEL[FindItBuildingMenu.Name]", "Name")}</span>
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
                style={columnStyle(column.key)}
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
            status === "indexing"
              ? <div className={styles.empty}>
                  {translate("Tooltip.LABEL[FindItBuildingMenu.IndexingBuildings]", "Indexing buildings…")}
                </div>
              : scopeNoticeBlock ?? <div className={styles.empty}>{emptyStateMessage}</div>
          )}
          {flattenGroupedRows(items, groupBy, (entry) => String(entry.id)).map((line) => {
            if (line.kind === "heading") {
              return (
                <div
                  key={line.key}
                  className={styles.tableGroupHeading}
                  data-group-depth={line.depth}
                >
                  <span className={styles.tableGroupLabel}>
                    {line.labelId === undefined
                      ? line.label
                      : resolveVanillaLabel(
                        vanillaCategoryNameKeys(line.labelId),
                        (key) => translate(key, null),
                        line.label
                      )}
                  </span>
                  <span className={styles.tableGroupCount}>{line.count}</span>
                </div>
              );
            }

            const entry = line.entry;
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
            const extensionLabels = isExpanded ? getBuildingExtensionLabels(entry.supportedUpgrades) : [];
            const provenanceChips = isExpanded ? getBuildingProvenanceChips(entry, resolveFacetLabel) : [];
            const description = isExpanded ? resolveAssetDescription(entry.prefabName, translate) : null;
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
                data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
                // Same pair as the grid and the list: the ground says
                // unplaceable, the reason is said in the Place button below.
                data-already-built={isEntryAlreadyBuilt(entry) ? "true" : undefined}
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
                    {/* The badge sits ON the picture here too, at the same
                        ratio the grid and the rows use — this thumbnail is
                        68rem, which happens to be vanilla's own image size. */}
                    <div className={styles.thumbnail}>
                      {entry.thumbnail && (
                        <img
                          // Named, so the silhouette filter can reach the
                          // building without also reaching the badge on top of
                          // it. The grid and the list have always named theirs
                          // (.thumb, .icon); this was the one mode whose
                          // picture was anonymous, so its filter had to select
                          // `.thumbnail img` and blackened both.
                          className={styles.picture}
                          src={lockedThumbnail(entry, isEntryLocked(entry) || isEntryAlreadyBuilt(entry))}
                          onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                        />
                      )}
                      {entry.isUnique === true && (
                        <img
                          className={classNames(
                            styles.uniqueAsset,
                            isEntryAlreadyBuilt(entry) ? styles.alreadyBuilt : styles.uniqueMark
                          )}
                          src={isEntryAlreadyBuilt(entry)
                            ? "Media/Game/Icons/AlreadyBuilt.svg"
                            : "Media/Game/Icons/Unique.svg"}
                          alt=""
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className={styles.identity}>
                      <div className={styles.nameLine}>
                        {/* Elide the MIDDLE, not the tail. CSS can only cut at
                            an edge, and the tail is what distinguishes one name
                            from its neighbours — "EU Commercial Gas Station 01
                            - L1 2x2" and "EU Commercial High 01 - L1 2x2" differ
                            only after the twelfth character, so an end-truncated
                            table shows two rows that look the same.

                            NOT stripRedundantNamePrefix, which the tiles use.
                            That drops leading theme words, and it is safe in the
                            grid because the grid is scoped to one menu. This
                            table is flat, sortable and multi-theme: dropping the
                            token turns "EU Commercial High 01" and "NA
                            Commercial High 01" into the same string, sorted
                            adjacent — the very collision this is here to remove.

                            title carries the full name either way. */}
                        <div className={styles.name} title={entryLabel}>
                          {shortenTileLabel(entryLabel, nameBudget)}
                        </div>
                        <span className={styles.placeHint} aria-hidden="true">{isExpanded ? collapseLabel : inspectLabel}</span>
                      </div>
                      <div className={styles.category} title={rawCategoryIdentity}>
                        {formatBuildingCatalogLabels(entry)}
                      </div>
                    </div>
                  </div>
                  <div className={classNames(styles.metric, styles.metricCost)} style={columnStyle("cost")} title={`Cost ${formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)}`}>
                    {formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricUpkeep)} style={columnStyle("upkeep")} title={`Upkeep ${formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)}`}>
                    {formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricWorkers)} style={columnStyle("workers")} title={`Workers ${formatBuildingMetric(entry.workers, "workers", separators)}`}>
                    {formatBuildingMetric(entry.workers, "workers", separators)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricCapacity)} style={columnStyle("capacity")} title={`Capacity ${formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}`}>
                    {formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricLot)} style={columnStyle("lot")} title="Lot dimensions">
                    {formatLotDimensions(entry.lotWidth, entry.lotDepth)}
                  </div>
                  <div className={classNames(styles.metric, styles.metricLevel)} style={columnStyle("level")} title="Building level">
                    {entry.buildingLevel}
                  </div>
                  <div
                    className={classNames(styles.parking, styles.metricParking, entry.hasParking && styles.parkingActive)}
                    style={columnStyle("parking")}
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
                  disabled={!canPlace(entry)}
                  onSelect={() => activate(entry)}
                  aria-label={
                    entryStateWord(entry, lockedLabel, builtLabel)
                      ? `${rowPlaceLabel} — ${entryStateWord(entry, lockedLabel, builtLabel)}`
                      : rowPlaceLabel
                  }
                  title={entryStateWord(entry, lockedLabel, builtLabel) ?? rowPlaceLabel}
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
              />
            )}
        </>
      )}

    </div>
  );
};
