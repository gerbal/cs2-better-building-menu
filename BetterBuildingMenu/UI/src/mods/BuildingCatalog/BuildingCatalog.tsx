import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useRef } from "react";
import classNames from "classnames";
import { shortenTileLabel, tableLabelCharBudget } from "domain/tileLabel";
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
import { catalogWindowRemaining } from "domain/catalogWindow";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  getBuildingLensEmptyStateMessage,
  type BuildingLensMetricRangeState,
} from "domain/buildingLensFilterSummary";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import { menuSurfacePort } from "domain/menuSurfacePort";
import { getSearchScopeNotice } from "domain/buildingSearchRank";
import { canPlace } from "domain/buildingLockState";
import { getLensAnchorKey, getLensView, setLensAnchor, setLensView } from "domain/lensViewStore";
// The view mode is shared with the control plane, which is a sibling of this
// panel rather than a descendant, so it goes through the subscribing hook.
import { useLensView } from "mods/useLensView";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import {
  type GroupDimensionId,
} from "domain/buildingGroups";
// The rail, the metric popover and the filter summary all live in the chip row
// now, so the catalog no longer owns any filter chrome — only results.
import { TableView } from "./TableView";
import { useCatalogWindow } from "./useCatalogWindow";
import { useRevealExpandedRow, useScrollAnchor } from "./useScrollAnchor";
import styles from "./buildingCatalog.module.scss";

const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth");
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
// The order lives in the backend query, which outlives this component. Reading
// it back keeps the header honest across the remounts that close/reopen, the
// Catalog/Tools switch, and the lens toggle all cause.
const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn");
const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending");
// Backend-owned too: placing a building unmounts this panel, which used to
// throw away the shortlist the player built in order to make that choice.
const BuildingLensFacets$ = bindValue<BuildingLensFacetState>(mod.id, "BuildingLensFacets");
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState>(mod.id, "BuildingCatalogMetricRanges");
const BuildingCatalogMatchesElsewhere$ = bindValue<number>(mod.id, "BuildingCatalogMatchesElsewhere", 0);
const LensDefaultToTable$ = bindValue<boolean>(mod.id, "BuildingLensDefaultToTable", false);
// The grouping the page is ordered by — the player's choice or the menu's
// default, resolved on the C# side (BuildingCatalogGrouping.Effective). This
// component used to derive it from three bindings and push it back, which
// refreshed every menu twice on first open.
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
  const viewModeChoice = useLensView((view) => view.viewMode) || (defaultToTable ? "table" : "grid");
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
  const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;
  // In the store rather than useState so the open row survives the remount
  // that placing a building causes, the way the anchor does.
  const expandedId = useLensView((view) => view.expandedId);

  // The root every DOM measurement below is scoped to. The hooks find the
  // rows and the scroller beneath it and never look above it.
  const rootRef = useRef<HTMLDivElement>(null);
  const { items, totalCount, limit, status, hasMore, loadMore } = useCatalogWindow(rootRef, { viewMode, groupBy });
  useRevealExpandedRow(rootRef, expandedId, styles.rowDetails);
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const matchesElsewhere = useValue(BuildingCatalogMatchesElsewhere$);

  // Name the constraints that actually emptied the table; the old copy always
  // blamed search and category, which are often not the cause.
  const emptyStateMessage = getBuildingLensEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
  });

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
        "Tooltip.LABEL[BetterBuildingMenu.MatchesElsewhere]",
        "No matches here — {0} elsewhere"
      ) ?? "No matches here — {0} elsewhere").replace("{0}", `${scopeNotice.elsewhere}`)
    : "";
  const searchEverywhereLabel =
    translate("Tooltip.LABEL[BetterBuildingMenu.SearchEverything]", "Search everything")
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
  // What the table draws with no rows: the indexing notice, or the scope
  // notice, or the message naming the constraints that emptied it.
  const emptyState = status === "indexing"
    ? <div className={styles.empty}>
        {translate("Tooltip.LABEL[BetterBuildingMenu.IndexingBuildings]", "Indexing buildings…")}
      </div>
    : scopeNoticeBlock ?? <div className={styles.empty}>{emptyStateMessage}</div>;

  /**
   * Draws one leaf's entries in whichever mode is active.
   *
   * Grouping is a property of the result, not of a mode, so all three render
   * the same tree. The zoning view is the same idea by hand — family, density,
   * tiles — which is why it can eventually drop its bespoke component.
   */
  function toggleExpanded(id: number): void {
    setLensView({ expandedId: getLensView().expandedId === id ? null : id });
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
    menuSurfacePort.activatePrefab({ prefabId: entry.id });
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

  useScrollAnchor(rootRef, anchorKey, items.length);


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
        {(translate("Tooltip.LABEL[BetterBuildingMenu.ShowingOfTotal]", "Showing {0} of {1}")
          ?? "Showing {0} of {1}")
          .replace("{0}", `${items.length}`)
          .replace("{1}", `${totalCount}`)}
      </span>
      <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
        {remaining === null
          ? translate("Tooltip.LABEL[BetterBuildingMenu.LoadMore]", "Load more") ?? "Load more"
          : (translate("Tooltip.LABEL[BetterBuildingMenu.LoadMoreCount]", "Load {0} more")
            ?? "Load {0} more").replace("{0}", `${Math.min(remaining, limit)}`)}
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
      // No max-height. The panel states its own height now (the surface sets
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
