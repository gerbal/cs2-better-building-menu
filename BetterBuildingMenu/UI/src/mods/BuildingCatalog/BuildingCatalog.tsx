import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useEffect, useRef } from "react";
import classNames from "classnames";
import { shortenTileLabel, tableLabelCharBudget } from "domain/tileLabel";
import { useTextScale } from "domain/textScaleSetting";
import mod from "../../../mod.json";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  getBuildingLensCatalogMaxHeight,
  BUILDING_LENS_IDENTITY_MIN,
  BUILDING_LENS_CONTROL_PANE_TOTAL,
  BUILDING_LENS_TABLE_ROW_FURNITURE,
  getBuildingLensColumnWidths,
  getBuildingLensDensity,
  getBuildingLensRowGeometry,
  getBuildingLensMetricTextScale,
} from "domain/buildingLensLayout";
import type { BuildingLensDensityTier, BuildingLensMetric } from "domain/buildingLensLayout";
import {
  nextSortState,
  setSortColumnCommand,
  setSortDescendingCommand,
} from "domain/buildingCatalogContracts";
import { catalogWindowRemaining, loadMoreCount } from "domain/catalogWindow";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  getBuildingLensEmptyStateMessage,
  type BuildingLensMetricRangeState,
} from "domain/buildingLensFilterSummary";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import { menuSurfacePort } from "domain/menuSurfacePort";
import { enterDecision, getSearchScopeNotice, isEnterForSearch, isPlainEnter } from "domain/buildingSearchRank";
import { isSearchField } from "mods/BuildingMenu/searchField";
import { canPlace } from "domain/buildingLockState";
import { getLensAnchorKey, getLensView, setLensAnchor, setLensView } from "domain/lensViewStore";
// The view mode is shared with the control plane, which is a sibling of this
// panel rather than a descendant, so it goes through the subscribing hook.
import { useLensView } from "mods/useLensView";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { DEFAULT_VIEW_MODE } from "mods/GroupedResults/ViewModeBar";
import {
  type GroupDimensionId,
} from "domain/buildingGroups";
import { TableView } from "./TableView";
import { useCatalogWindow } from "./useCatalogWindow";
import { useRevealExpandedRow, useScrollAnchor } from "./useScrollAnchor";
import styles from "./buildingCatalog.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth");
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
// The order lives in the backend query, which outlives this component, so
// reading it back keeps the header honest across every remount.
const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn");
const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending");
// Backend-owned too, so the shortlist the player built survives the unmount
// that placing a building causes.
const BuildingLensFacets$ = bindValue<BuildingLensFacetState>(mod.id, "BuildingLensFacets");
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState>(mod.id, "BuildingCatalogMetricRanges");
const BuildingCatalogMatchesElsewhere$ = bindValue<number>(mod.id, "BuildingCatalogMatchesElsewhere", 0);
// The grouping the page is ordered by — the player's choice or the menu's
// default, resolved on the C# side (BuildingCatalogGrouping.Effective) so this
// component reads it rather than deriving and pushing it back.
const BuildingCatalogGroupBy$ = bindValue<string>(mod.id, "BuildingCatalogGroupBy", "category");

/** Grid recognises, List scans, Table compares. */
type ViewMode = CatalogViewMode;

const densityClassNames: Record<BuildingLensDensityTier, string> = {
  compact: styles.densityCompact,
  default: styles.densityDefault,
  expanded: styles.densityExpanded,
};

export const BuildingCatalogComponent = () => {
  const { translate } = useLocalization();
  const panelWidth = useValue(PanelWidth$);
  const currentSearch = useValue(CurrentSearch$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  // In the shared store, not useState: the control plane is a sibling of this
  // panel rather than a descendant, and the choice has to survive the remount
  // that placing a building causes.
  const viewModeChoice = useLensView((view) => view.viewMode) || DEFAULT_VIEW_MODE;
  // Obeyed at every panel height. A control that lights up and changes nothing
  // is the same defect as a control that is missing, and the height is the
  // player's to set.
  const viewMode = viewModeChoice as ViewMode;
  const tableMode = viewMode === "table";
  const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;
  // In the store rather than useState so the open row survives the remount
  // that placing a building causes, the way the anchor does.
  const expandedId = useLensView((view) => view.expandedId);

  // The root every DOM measurement below is scoped to. The hooks find the
  // rows and the scroller beneath it and never look above it.
  const rootRef = useRef<HTMLDivElement>(null);
  const { items, totalCount, status, hasMore, bestMatchId, searchText: pageSearch, loadMore } = useCatalogWindow(rootRef, { viewMode, groupBy });
  useRevealExpandedRow(rootRef, expandedId, styles.rowDetails);
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const matchesElsewhere = useValue(BuildingCatalogMatchesElsewhere$);

  // Names the constraints that actually emptied the table, rather than always
  // blaming search and category.
  const emptyStateMessage = getBuildingLensEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
  });

  const density = getBuildingLensDensity(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH);
  // One set of numbers for the header and every row: a table with no CSS grid
  // lines up only because both read the same widths. Figures do not scale with
  // the panel but do with the game's text scale.
  const textScale = useTextScale();
  const columnWidths = getBuildingLensColumnWidths(panelWidth + BUILDING_LENS_PANEL_CHROME_WIDTH, textScale);
  // The widths are estimates and stay estimates: the row is a flex layout whose
  // column bases already exceed the room beside the name, so cells shrink to
  // what the row allows and an inline width is not what gets drawn.
  const columnStyle = (metric: BuildingLensMetric) => ({
    width: `${columnWidths[metric]}rem`,
    flexBasis: `${columnWidths[metric]}rem`,
  });
  // The width the NAME actually gets. panelWidth is NOT the panel: it is the
  // whole assembly, control pane included, so the pane comes off here as it
  // does in BuildingMenuSurface. Erring small shortens sooner, never later.
  const nameWidth = Math.max(
    BUILDING_LENS_IDENTITY_MIN - BUILDING_LENS_TABLE_ROW_FURNITURE,
    panelWidth
      - BUILDING_LENS_CONTROL_PANE_TOTAL
      - Object.values(columnWidths).reduce((total, width) => total + width, 0)
      - BUILDING_LENS_TABLE_ROW_FURNITURE
  );
  const nameBudget = tableLabelCharBudget(nameWidth, textScale);
  const rowGeometry = getBuildingLensRowGeometry(density);
  const catalogMaxHeight = getBuildingLensCatalogMaxHeight(typeof window === "undefined" ? 720 : window.innerHeight);
  // Row and filter name the same asset the same way: the entry carries raw ids
  // while the facet groups hold the display names, so resolving through those
  // beats a second lookup table that would drift.
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
        "Tooltip.LABEL[BetterBuildingMenu.MatchesElsewhere]",
        "No matches here — {0} elsewhere"
      ) ?? "No matches here — {0} elsewhere").replace("{0}", `${scopeNotice.elsewhere}`)
    : "";
  const searchEverywhereLabel =
    translate("Tooltip.LABEL[BetterBuildingMenu.SearchEverything]", "Search everything")
    ?? "Search everything";
  /**
   * "Nothing here, {n} elsewhere" and the button that goes there. Built once
   * and rendered by every view mode: widening is the whole answer to a scoped
   * miss, and which mode the player is in has nothing to do with it.
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
  // What the table draws with no rows: the indexing notice, or the scope
  // notice, or the message naming the constraints that emptied it.
  const emptyState = status === "indexing"
    ? <div className={styles.empty}>
        {translate("Tooltip.LABEL[BetterBuildingMenu.IndexingBuildings]", "Indexing buildings…")}
      </div>
    : scopeNoticeBlock ?? <div className={styles.empty}>{emptyStateMessage}</div>;

  function toggleExpanded(id: number): void {
    setLensView({ expandedId: getLensView().expandedId === id ? null : id });
  }

  function activate(entry: BuildingCatalogEntry): void {
    // A milestone-locked asset cannot be placed, and vanilla refuses the same
    // selection. Guarded here rather than in TryActivatePrefabTool, which
    // arrow-key navigation also calls and must step past a locked tile.
    if (!canPlace(entry)) return;

    // Placing unmounts the whole lens, so this is the last moment the scroll
    // position exists — and the building just chosen is what to come back to.
    setLensAnchor(anchorKey, entry.id);

    // The backend resolves this id through its prefab index and activates the
    // normal prefab tool.
    menuSurfacePort.activatePrefab({ prefabId: entry.id });
  }

  function setSort(column: SortColumn): void {
    const next = nextSortState({ column: sortColumn, descending }, column);

    // No local echo: the backend owns the order and publishes it back, so
    // mirroring it here would be a second source of truth. The window shrinks
    // to one chunk on the C# side, since a sort reorders everything anyway.
    for (const command of [setSortColumnCommand(next.column), setSortDescendingCommand(next.descending)]) {
      trigger(mod.id, command.method, ...command.args);
    }
  }

  // Scoped to the surface and the layout, because which element owns the scroll
  // and how tall its children are both depend on them: an offset remembered in
  // the table means nothing in the grid.
  const anchorKey = getLensAnchorKey({ surface: "catalog", viewMode, groupBy });

  useScrollAnchor(rootRef, anchorKey, items.length);

  // Enter arms the backend's best match, so a search can be finished without
  // leaving the keyboard. One listener for every view, on the document because
  // the search field is the header's; the ref keeps it reading this render.
  // An Enter pressed before the page catches up with the box is held for it.
  const pendingEnter = useRef<string | null>(null);
  const onEnter = useRef<(event: KeyboardEvent) => void>(() => undefined);
  onEnter.current = (event) => {
    if (!isEnterForSearch(event.target, isSearchField(event.target))) return;

    const decision = enterDecision({ items, bestMatchId, searchText: pageSearch }, currentSearch ?? "");
    pendingEnter.current = decision && "wait" in decision ? decision.wait : null;
    if (decision && "arm" in decision) activate(decision.arm);
  };
  useEffect(() => {
    const waiting = pendingEnter.current;
    if (waiting === null) return;

    // Typing on after Enter takes it back.
    if ((currentSearch ?? "").trim() !== waiting) {
      pendingEnter.current = null;
      return;
    }

    const decision = enterDecision({ items, bestMatchId, searchText: pageSearch }, waiting);
    if (decision && "wait" in decision) return;

    pendingEnter.current = null;
    if (decision) activate(decision.arm);
  }, [items, bestMatchId, pageSearch, currentSearch]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isPlainEnter(event)) onEnter.current(event);
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, []);


  /*
   * The end of the feed, rendered as the last child INSIDE whichever element
   * owns the scroll — which differs by view mode, so it is passed down. It
   * names both ends, so a truncated list reads as one rather than as the whole.
   */
  const remaining = catalogWindowRemaining({ shown: items.length, total: totalCount });
  const catalogFooter = hasMore ? (
    <div className={styles.loadMoreRow}>
      <span className={styles.windowState}>
        {(translate("Tooltip.LABEL[BetterBuildingMenu.ShowingOfTotal]", "Showing {0} of {1}")
          ?? "Showing {0} of {1}")
          .replace("{0}", `${items.length}`)
          .replace("{1}", `${totalCount}`)}
      </span>
      <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
        {remaining === null
          ? translate("Tooltip.LABEL[BetterBuildingMenu.LoadMore]", "Load more") ?? "Load more"
          : (translate("Tooltip.LABEL[BetterBuildingMenu.LoadMoreCount]", "Load {0} more")
            ?? "Load {0} more").replace("{0}", `${loadMoreCount(remaining)}`)}
      </Button>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={classNames(styles.catalog, densityClassNames[density])}
      data-density={density}
      data-row-height={rowGeometry.rowHeight}
      data-selector-height={rowGeometry.selectorHeight}
      data-metric-text-scale={getBuildingLensMetricTextScale(density)}
      // Published as data, not applied as a max-height: the panel states its
      // own height and .catalog is flex: 1 1 auto inside it, so a second
      // ceiling here could only cut the panel short.
      data-catalog-max-height={catalogMaxHeight}
    >
      {/* No toolbar band here. Identity, grouping, sort and view live in
          LensControlPane, which is on screen at every panel height. */}

      {/* No filter chrome either: the rail and the active-filter chips are the
          control plane's, so this component draws results and nothing else. */}

      {tableMode ? (
        <TableView
          items={items}
          emptyState={emptyState}
          density={density}
          columnStyle={columnStyle}
          nameBudget={nameBudget}
          resolveFacetLabel={resolveFacetLabel}
          sortColumn={sortColumn}
          descending={descending}
          onSort={setSort}
          expandedId={expandedId}
          onToggleExpanded={toggleExpanded}
          onPlace={activate}
          footer={catalogFooter}
        />
      ) : (
        <>
          {scopeNoticeBlock}
          {/* Filters compose, so an empty intersection is easy to reach by
              accident, and silence there reads as a broken panel. */}
          {items.length === 0
            ? (scopeNotice
                // The notice above already says the set is empty AND what to do
                // about it; a second line would say it twice and contradict it.
                ? null
                : <div className={styles.empty}>{emptyStateMessage}</div>)
            : (
              <GroupedResults
                entries={items}
                viewMode={viewMode}
                onPlace={activate}
                footer={catalogFooter}
              />
            )}
        </>
      )}

    </div>
  );
};
