import { useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import { tableLabelCharBudget } from "domain/tileLabel";
import { useTextScale } from "domain/textScaleSetting";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  ASSET_MENU_CHROME_WIDTH,
  getAssetMenuCatalogMaxHeight,
  ASSET_MENU_IDENTITY_MIN,
  CONTROL_PANE_TOTAL,
  ASSET_MENU_TABLE_ROW_FURNITURE,
  getAssetMenuColumnWidths,
  getAssetMenuDensity,
  getAssetMenuRowGeometry,
  getAssetMenuMetricTextScale,
} from "domain/assetMenuLayout";
import type { AssetMenuDensityTier, AssetMenuMetric } from "domain/assetMenuLayout";
import { catalogWindowRemaining, loadMoreCount } from "domain/catalogWindow";
import { getNumberSeparators, groupDigits } from "domain/assetMenuMetricFormat";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { getAssetMenuEmptyStateMessage } from "domain/assetMenuFilterSummary";
import { assetMenuPort } from "domain/assetMenuPort";
import { enterDecision, getSearchScopeNotice, isEnterForSearch, isPlainEnter } from "domain/buildingSearchRank";
import { isSearchField } from "mods/BuildingMenu/searchField";
import { canPlace } from "domain/buildingLockState";
import { getAssetMenuAnchorKey, getAssetMenuView, setAssetMenuAnchor, setAssetMenuView } from "domain/assetMenuViewStore";
// The view mode is shared with the control plane, which is a sibling of this
// asset menu rather than a descendant, so it goes through the subscribing hook.
import { useAssetMenuView } from "mods/useAssetMenuView";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { DEFAULT_VIEW_MODE } from "mods/GroupedResults/ViewModeBar";
import {
  type GroupDimensionId,
} from "domain/buildingGroups";
import { TableView } from "./TableView";
import { useCatalogWindow } from "./useCatalogWindow";
import { useRevealExpandedRow, useScrollAnchor } from "./useScrollAnchor";
import {
  BuildingCatalogGroupBy$,
  BuildingCatalogMatchesElsewhere$,
  BuildingCatalogMetricRanges$,
  BuildingCatalogSortColumn$,
  BuildingCatalogSortDescending$,
  AssetMenuFacets$,
  CurrentSearch$,
  AssetMenuWidth$,
  send,
  sendSort,
} from "mods/bindings";
import styles from "./buildingCatalog.module.scss";

/** Grid recognises, List scans, Table compares. */
type ViewMode = CatalogViewMode;

const densityClassNames: Record<AssetMenuDensityTier, string> = {
  compact: styles.densityCompact,
  default: styles.densityDefault,
  expanded: styles.densityExpanded,
};

/**
 * Memoised, and takes no props: it re-renders on its own bindings only, not on
 * every drag echo or keystroke that re-renders the asset menu around it.
 */
export const BuildingCatalogComponent = memo(function BuildingCatalogComponent() {
  const { translate } = useLocalization();
  const assetMenuWidth = useValue(AssetMenuWidth$);
  const currentSearch = useValue(CurrentSearch$);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  // In the shared store, not useState: the control plane is a sibling of this
  // asset menu rather than a descendant, and the choice has to survive the remount
  // that placing a building causes.
  const viewModeChoice = useAssetMenuView((view) => view.viewMode) || DEFAULT_VIEW_MODE;
  // Obeyed at every asset menu height. A control that lights up and changes nothing
  // is the same defect as a control that is missing, and the height is the
  // player's to set.
  const viewMode = viewModeChoice as ViewMode;
  const tableMode = viewMode === "table";
  const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;
  // In the store rather than useState so the open row survives the remount
  // that placing a building causes, the way the anchor does.
  const expandedId = useAssetMenuView((view) => view.expandedId);

  // The root every DOM measurement below is scoped to. The hooks find the
  // rows and the scroller beneath it and never look above it.
  const rootRef = useRef<HTMLDivElement>(null);
  const { items, totalCount, status, hasMore, bestMatchId, searchText: pageSearch, loadMore } = useCatalogWindow(rootRef, { viewMode, groupBy });
  useRevealExpandedRow(rootRef, expandedId, styles.rowDetails);
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const matchesElsewhere = useValue(BuildingCatalogMatchesElsewhere$);

  // Names the constraints that actually emptied the table, rather than always
  // blaming search and category.
  const emptyStateMessage = getAssetMenuEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
  });

  const density = getAssetMenuDensity(assetMenuWidth + ASSET_MENU_CHROME_WIDTH);
  // One set of numbers for the header and every row: a table with no CSS grid
  // lines up only because both read the same widths. Figures do not scale with
  // the build menu but do with the game's text scale.
  const textScale = useTextScale();
  const columnWidths = useMemo(
    () => getAssetMenuColumnWidths(assetMenuWidth + ASSET_MENU_CHROME_WIDTH, textScale),
    [assetMenuWidth, textScale]
  );
  // The widths are estimates and stay estimates: the row is a flex layout whose
  // column bases already exceed the room beside the name, so cells shrink to
  // what the row allows and an inline width is not what gets drawn.
  const columnStyle = useCallback((metric: AssetMenuMetric) => ({
    width: `${columnWidths[metric]}rem`,
    flexBasis: `${columnWidths[metric]}rem`,
  }), [columnWidths]);
  // The width the NAME actually gets. assetMenuWidth is NOT the build menu: it is
  // the whole assembly, control pane included, so the pane comes off here as it
  // does in AssetMenu. Erring small shortens sooner, never later.
  const nameWidth = Math.max(
    ASSET_MENU_IDENTITY_MIN - ASSET_MENU_TABLE_ROW_FURNITURE,
    assetMenuWidth
      - CONTROL_PANE_TOTAL
      - Object.values(columnWidths).reduce((total, width) => total + width, 0)
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
        onSelect={() => send({ method: "SearchEverything", args: [] })}
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

  const toggleExpanded = useCallback((id: number): void => {
    setAssetMenuView({ expandedId: getAssetMenuView().expandedId === id ? null : id });
  }, []);

  // Scoped to the list and the layout, because which element owns the scroll
  // and how tall its children are both depend on them: an offset remembered in
  // the table means nothing in the grid.
  const anchorKey = getAssetMenuAnchorKey({ list: "catalog", viewMode, groupBy });

  // Stable across renders, like every callback a row receives, so a memoised
  // row skips the re-render its parent does on each keystroke.
  const activate = useCallback((entry: BuildingCatalogEntry): void => {
    // A milestone-locked asset cannot be placed, and vanilla refuses the same
    // selection. Guarded here rather than in TryActivatePrefabTool, which
    // arrow-key navigation also calls and must step past a locked tile.
    if (!canPlace(entry)) return;

    // Placing unmounts the whole asset menu, so this is the last moment the scroll
    // position exists — and the building just chosen is what to come back to.
    setAssetMenuAnchor(anchorKey, entry.id);

    // The backend resolves this id through its prefab index and activates the
    // normal prefab tool.
    assetMenuPort.activatePrefab({ prefabId: entry.id });
  }, [anchorKey]);

  const setSort = useCallback(
    (column: SortColumn): void => sendSort({ column: sortColumn, descending }, column),
    [sortColumn, descending]
  );

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
  }, [items, bestMatchId, pageSearch, currentSearch, activate]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isPlainEnter(event)) onEnter.current(event);
    };

    // Capture phase: the game's app container stops keydown propagation, so a
    // bubble listener on the document never hears an Enter typed in the search
    // box. VanillaMenuWatcher's Escape listens the same way.
    document.addEventListener("keydown", onKey, true);

    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  /*
   * The end of the feed, rendered as the last child INSIDE whichever element
   * owns the scroll — which differs by view mode, so it is passed down. It
   * names both ends, so a truncated list reads as one rather than as the whole.
   */
  const remaining = catalogWindowRemaining({ shown: items.length, total: totalCount });
  const separators = useMemo(() => getNumberSeparators(translate), [translate]);
  // Memoised with what it shows, so the views it is handed to can skip a render.
  const catalogFooter = useMemo(() => hasMore ? (
    <div className={styles.loadMoreRow}>
      <span className={styles.windowState}>
        {(translate("Tooltip.LABEL[BetterBuildingMenu.ShowingOfTotal]", "Showing {0} of {1}")
          ?? "Showing {0} of {1}")
          .replace("{0}", groupDigits(items.length, separators))
          .replace("{1}", groupDigits(totalCount, separators))}
      </span>
      <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
        {remaining === null
          ? translate("Tooltip.LABEL[BetterBuildingMenu.LoadMore]", "Load more") ?? "Load more"
          : (translate("Tooltip.LABEL[BetterBuildingMenu.LoadMoreCount]", "Load {0} more")
            ?? "Load {0} more").replace("{0}", `${loadMoreCount(remaining)}`)}
      </Button>
    </div>
  ) : null, [hasMore, items.length, totalCount, remaining, translate, separators, loadMore]);

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
          ControlPane, which is on screen at every asset menu height. */}

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
