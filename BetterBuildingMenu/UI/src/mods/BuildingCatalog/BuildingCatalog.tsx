import { useValue } from "mods/panelValue";
import { Button } from "cs2/ui";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import { tableLabelCharBudget } from "domain/tileLabel";
import { useNumberSeparators, useTextScale } from "mods/gameSettings";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  ASSET_MENU_CHROME_WIDTH,
  catalogLayoutWidth,
  getAssetMenuCatalogMaxHeight,
  ASSET_MENU_IDENTITY_MIN,
  CONTROL_PANE_TOTAL,
  ASSET_MENU_TABLE_ROW_FURNITURE,
  getAssetMenuColumnWidths,
  getAssetMenuDensity,
  getAssetMenuRowGeometry,
  getAssetMenuMetricTextScale,
  visibleTableMetrics,
} from "domain/assetMenuLayout";
import type { AssetMenuColumnWidths, AssetMenuDensityTier, AssetMenuMetric } from "domain/assetMenuLayout";
import { catalogWindowRemaining, loadMoreCount, rowsThatFit } from "domain/catalogWindow";
import { groupDigits } from "domain/assetMenuMetricFormat";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { sortedMetricFor } from "domain/sortedMetric";
import { getAssetMenuEmptyStateMessage } from "domain/assetMenuFilterSummary";
import { searchEverythingCommand, setCurrentPrefabCommand } from "domain/commands";
import { enterDecision, getSearchScopeNotice, isEnterForSearch, isPlainEnter } from "domain/buildingSearchRank";
import { isSearchField } from "mods/BuildingMenu/searchField";
import { canPlace } from "domain/buildingLockState";
import { getAssetMenuAnchor, getAssetMenuAnchorKey, getAssetMenuView, setAssetMenuAnchor, setAssetMenuView } from "domain/assetMenuViewStore";
import { useAssetMenuView } from "mods/useAssetMenuView";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useCaptureKeydown } from "mods/useCaptureKeydown";
import { useLabel } from "mods/useLabel";
import { useAssetMenuShown } from "mods/BuildingMenu/assetMenuShown";
import { GroupedResults } from "mods/GroupedResults/GroupedResults";
import { useViewShape } from "mods/viewShape";
import { TableView } from "./TableView";
import { useCatalogWindow } from "./useCatalogWindow";
import { useRevealExpandedRow, useScrollAnchor, useScrollToTopOnShow } from "./useScrollAnchor";
import {
  AssetMenuHeight$,
  BuildingCatalogMatchesElsewhere$,
  BuildingCatalogMetricRanges$,
  BuildingCatalogSortColumn$,
  BuildingCatalogSortDescending$,
  AssetMenuFacets$,
  CurrentSearch$,
  send,
  sendSort,
} from "mods/bindings";
import styles from "./buildingCatalog.module.scss";

const densityClassNames: Record<AssetMenuDensityTier, string> = {
  compact: styles.densityCompact,
  default: styles.densityDefault,
  expanded: styles.densityExpanded,
};

/**
 * Memoised, and takes no props: it re-renders on its own bindings only, not on
 * every height-drag echo or keystroke that re-renders the asset menu around it.
 * A width drag does re-render it, since the table's columns follow the width.
 */
export const BuildingCatalogComponent = memo(function BuildingCatalogComponent() {
  const label = useLabel();
  // The build menu as drawn, plus the pane: the row the table arithmetic was tuned
  // against, which subtracts the pane itself.
  const layoutWidth = catalogLayoutWidth(useAssetMenuLayout().menuWidth);
  const currentSearch = useValue(CurrentSearch$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  // Obeyed at every asset menu height. A control that lights up and changes nothing
  // is the same defect as a control that is missing, and the height is the
  // player's to set.
  const { viewMode, groupBy } = useViewShape();
  const tableMode = viewMode === "table";
  // In the store rather than useState so the open row survives the remount
  // that placing a building causes, the way the anchor does.
  const expandedId = useAssetMenuView((view) => view.expandedId);

  // The root every DOM measurement below is scoped to. The hooks find the
  // rows and the scroller beneath it and never look above it.
  const rootRef = useRef<HTMLDivElement>(null);
  // False while the menu is kept built behind a closed menu; see KeptAssetMenu.
  const shown = useAssetMenuShown();
  // Scoped to the list and the layout, because which element owns the scroll
  // and how tall its children are both depend on them: an offset remembered in
  // the table means nothing in the grid.
  const anchorKey = getAssetMenuAnchorKey({ list: "catalog", viewMode, groupBy });
  // The table draws a screen of rows and more as the player scrolls: its 92 rem rows
  // show four or five of the page's 40, and drawing the rest cost about 55 ms of DOM
  // and layout on every open. The other views show most of a page and draw all of it.
  const catalogHeight = useValue(AssetMenuHeight$);
  const tableRows = tableMode ? rowsThatFit(catalogHeight, getAssetMenuRowGeometry(getAssetMenuDensity(layoutWidth)).rowHeight) : null;
  // The anchor is read on every render, not memoised: it is set by placing a building,
  // while this kept menu stays built, and the open after that must draw its row.
  const anchoredId = getAssetMenuAnchor(anchorKey);
  const drawing = useMemo(() => ({ rows: tableRows, mustIncludeId: anchoredId }), [tableRows, anchoredId]);
  const { items, pageItems, nextCount, totalCount, status, hasMore, bestMatch, searchText: pageSearch, loadMore } =
    useCatalogWindow(rootRef, { viewMode, groupBy }, shown, drawing);
  useRevealExpandedRow(rootRef, expandedId, styles.rowDetails);
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const matchesElsewhere = useValue(BuildingCatalogMatchesElsewhere$);

  const separators = useNumberSeparators();

  // Names the constraints that actually emptied the table, rather than always
  // blaming search and category.
  const emptyStateMessage = getAssetMenuEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
    separators,
  });

  const density = getAssetMenuDensity(layoutWidth);
  // One set of numbers for the header and every row: a table with no CSS grid
  // lines up only because both read the same widths. Figures do not scale with
  // the build menu but do with the game's text scale.
  const textScale = useTextScale();
  // The columns the table draws at this width: a narrow menu drops the least
  // asked-for rather than clip their figures, and never the one sorted by.
  const sortedMetric = sortedMetricFor(sortColumn);
  // Kept by value, not by width: a width drag changes the width every frame, and
  // new column props would redraw every memoised row even where nothing moved.
  const metricsKey = visibleTableMetrics(layoutWidth, textScale, sortedMetric).join(",");
  const tableMetrics = useMemo(() => metricsKey.split(",") as AssetMenuMetric[], [metricsKey]);
  const widthsKey = JSON.stringify(getAssetMenuColumnWidths(layoutWidth, textScale, tableMetrics));
  const columnWidths = useMemo(() => JSON.parse(widthsKey) as AssetMenuColumnWidths, [widthsKey]);
  // The widths are estimates and stay estimates: the row is a flex layout whose
  // column bases already exceed the room beside the name, so cells shrink to
  // what the row allows and an inline width is not what gets drawn.
  const columnStyle = useCallback((metric: AssetMenuMetric) => ({
    width: `${columnWidths[metric]}rem`,
    flexBasis: `${columnWidths[metric]}rem`,
  }), [columnWidths]);
  // The width the NAME actually gets: the layout width less the pane and the
  // chrome is the build menu, then the columns and the row's furniture come off.
  // Erring small shortens sooner, never later.
  const nameWidth = Math.max(
    ASSET_MENU_IDENTITY_MIN - ASSET_MENU_TABLE_ROW_FURNITURE,
    layoutWidth
      - ASSET_MENU_CHROME_WIDTH
      - CONTROL_PANE_TOTAL
      - Object.values(columnWidths).reduce<number>((total, width) => total + (width ?? 0), 0)
      - ASSET_MENU_TABLE_ROW_FURNITURE
  );
  const nameBudget = tableLabelCharBudget(nameWidth, textScale);
  const rowGeometry = getAssetMenuRowGeometry(density);
  const catalogMaxHeight = getAssetMenuCatalogMaxHeight(typeof window === "undefined" ? 720 : window.innerHeight);
  // Row and filter name the same asset the same way: the entry carries raw ids
  // while the facet groups hold the display names, so resolving through those
  // beats a second lookup table that would drift.
  const resolveFacetLabel = useCallback((groupId: string, value: string): string | null => {
    const group = facets?.groups?.find((candidate) => candidate.id === groupId);

    return group?.options?.find((option) => option.id === value)?.label ?? null;
  }, [facets]);
  const scopeNotice = getSearchScopeNotice({
    searchText: currentSearch ?? "",
    shown: items.length,
    elsewhere: matchesElsewhere ?? 0,
  });
  const scopeNoticeText = scopeNotice
    ? label("Tooltip.LABEL[BetterBuildingMenu.MatchesElsewhere]", "No matches here — {0} elsewhere")
      .replace("{0}", `${scopeNotice.elsewhere}`)
    : "";
  const searchEverywhereLabel = label("Tooltip.LABEL[BetterBuildingMenu.SearchEverything]", "Search everything");
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
        onSelect={() => send(searchEverythingCommand())}
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
        {label("Tooltip.LABEL[BetterBuildingMenu.IndexingBuildings]", "Indexing buildings…")}
      </div>
    : scopeNoticeBlock ?? <div className={styles.empty}>{emptyStateMessage}</div>;

  const toggleExpanded = useCallback((id: number): void => {
    setAssetMenuView({ expandedId: getAssetMenuView().expandedId === id ? null : id });
  }, []);

  // Stable across renders, like every callback a row receives, so a memoised
  // row skips the re-render its parent does on each keystroke.
  const activate = useCallback((entry: BuildingCatalogEntry): void => {
    // A milestone-locked asset cannot be placed, and vanilla refuses the same
    // selection. Guarded here rather than in TryActivatePrefabTool, which
    // arrow-key navigation also calls and must step past a locked tile.
    if (!canPlace(entry)) return;

    // The next open would start at the top, and the building just chosen is
    // what to come back to: the anchor takes the menu there instead.
    setAssetMenuAnchor(anchorKey, entry.id);

    // The backend resolves this id through its prefab index and activates the
    // normal prefab tool.
    send(setCurrentPrefabCommand(entry.id));
  }, [anchorKey]);

  const setSort = useCallback(
    (column: SortColumn): void => sendSort({ column: sortColumn, descending }, column),
    [sortColumn, descending]
  );

  useScrollAnchor(rootRef, anchorKey, items.length, shown);
  useScrollToTopOnShow(rootRef, anchorKey, shown);

  // Enter arms the backend's best match, so a search can be finished without
  // leaving the keyboard. One listener for every view, on the document because
  // the search field is the header's. An Enter pressed before the page catches
  // up with the box is held for it.
  const pendingEnter = useRef<string | null>(null);
  useCaptureKeydown((event) => {
    if (!isPlainEnter(event)) return;
    // Every menu's panel is kept built and listens; only the one shown was typed in.
    if (!shown) return;
    if (!isEnterForSearch(event.target, isSearchField(event.target))) return;

    const decision = enterDecision({ bestMatch, searchText: pageSearch }, currentSearch ?? "");
    pendingEnter.current = decision && "wait" in decision ? decision.wait : null;
    if (decision && "arm" in decision) activate(decision.arm);
  });
  useEffect(() => {
    const waiting = pendingEnter.current;
    if (waiting === null) return;

    // Typing on after Enter takes it back.
    if ((currentSearch ?? "").trim() !== waiting) {
      pendingEnter.current = null;
      return;
    }

    const decision = enterDecision({ bestMatch, searchText: pageSearch }, waiting);
    if (decision && "wait" in decision) return;

    pendingEnter.current = null;
    if (decision) activate(decision.arm);
  }, [bestMatch, pageSearch, currentSearch, activate]);

  /*
   * The end of the feed, rendered as the last child INSIDE whichever element
   * owns the scroll — which differs by view mode, so it is passed down. It
   * names both ends, so a truncated list reads as one rather than as the whole,
   * including one the window's ceiling cut short, where nothing more can load.
   */
  const remaining = catalogWindowRemaining({ shown: items.length, total: totalCount });
  // Memoised with what it shows, so the views it is handed to can skip a render.
  const catalogFooter = useMemo(() => hasMore || remaining !== null ? (
    <div className={styles.loadMoreRow}>
      <span className={styles.windowState}>
        {label("Tooltip.LABEL[BetterBuildingMenu.ShowingOfTotal]", "Showing {0} of {1}")
          .replace("{0}", groupDigits(items.length, separators))
          .replace("{1}", groupDigits(totalCount, separators))}
      </span>
      {hasMore ? (
        <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
          {remaining === null
            ? label("Tooltip.LABEL[BetterBuildingMenu.LoadMore]", "Load more")
            : label("Tooltip.LABEL[BetterBuildingMenu.LoadMoreCount]", "Load {0} more")
              .replace("{0}", `${loadMoreCount(remaining, nextCount)}`)}
        </Button>
      ) : (
        <span className={styles.narrowHint}>
          {label("Tooltip.LABEL[BetterBuildingMenu.NarrowToSeeRest]", "Search, pick a tab or add a filter to see the rest.")}
        </span>
      )}
    </div>
  ) : null, [hasMore, items.length, totalCount, remaining, nextCount, label, separators, loadMore]);

  return (
    <div
      ref={rootRef}
      className={classNames(styles.catalog, densityClassNames[density])}
      data-density={density}
      data-row-height={rowGeometry.rowHeight}
      data-selector-height={rowGeometry.selectorHeight}
      data-metric-text-scale={getAssetMenuMetricTextScale(density)}
      // Published as data, not applied as a max-height: the asset menu states its
      // own height and .catalog is flex: 1 1 auto inside it, so a second
      // ceiling here could only cut the asset menu short.
      data-catalog-max-height={catalogMaxHeight}
    >
      {/* No toolbar band here. Identity, grouping, sort and view live in
          ControlPane, beside the menu at every height while the player shows it. */}

      {/* No filter chrome either: the rail and the active-filter chips are the
          control plane's, so this component draws results and nothing else. */}

      {tableMode ? (
        <TableView
          items={pageItems}
          drawCount={items.length}
          emptyState={emptyState}
          density={density}
          metrics={tableMetrics}
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
              accident, and silence there reads as a broken asset menu. */}
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
});
