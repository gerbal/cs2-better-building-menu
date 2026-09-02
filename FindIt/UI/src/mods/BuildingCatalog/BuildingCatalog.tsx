import { bindValue, trigger, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useRef } from "react";
import classNames from "classnames";
import { shortenTileLabel, tableLabelCharBudget } from "domain/tileLabel";
import mod from "../../../mod.json";
import { BuildingCatalogEntry, formatBuildingCatalogLabels } from "domain/buildingCatalog";
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
  nextSortState,
  setSortColumnCommand,
  setSortDescendingCommand,
} from "domain/buildingCatalogContracts";
import { catalogWindowRemaining } from "domain/catalogWindow";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  formatBuildingLevel,
  formatBuildingMetric,
  METRIC_NOT_APPLICABLE,
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
import { getLensAnchorKey, getLensView, setLensAnchor, setLensView } from "domain/lensViewStore";
// The view mode is shared with the control plane, which is a sibling of this
// panel rather than a descendant, so it goes through the subscribing hook.
import { useLensView } from "mods/useLensView";
import { GroupedResults, type CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import {
  flattenGroupedRows,
  groupDimensionLabel,
  type GroupDimensionId,
} from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
// The rail, the metric popover and the filter summary all live in the chip row
// now, so the catalog no longer owns any filter chrome — only results.
import {
  BUILDING_LENS_COLUMN_SORT,
  getBuildingLensColumnSortIndicator,
} from "domain/buildingLensSortPresentation";
import { BuildingResultDetails } from "./BuildingResultDetails";
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
    findItSurfacePort.activatePrefab({ prefabId: entry.id });
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
          {flattenGroupedRows(items, (entry) => String(entry.id)).map((line) => {
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
                  // The row places. Every other view mode already behaved this
                  // way — a click in Grid, List and Cards arms the tool — and
                  // only the table disagreed, so a player who learned the verb
                  // anywhere else got something different here (cm-auzd).
                  //
                  // NOT disabled when the entry cannot be placed, deliberately.
                  // activate() already refuses, and disabling the row would
                  // take its hover card with it — which is exactly where a
                  // locked building explains what it is waiting for. The
                  // refusal is named in aria-label and title instead.
                  onSelect={() => activate(entry)}
                  aria-label={
                    entryStateWord(entry, lockedLabel, builtLabel)
                      ? `${rowPlaceLabel} — ${entryStateWord(entry, lockedLabel, builtLabel)}`
                      : rowPlaceLabel
                  }
                  data-refused={canPlace(entry) ? undefined : "true"}
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
                        {/* The row's own verb, which is now Place — or the
                            reason it will not, so a locked row says so where
                            the eye already is rather than only in a tooltip. */}
                        <span className={styles.placeHint} aria-hidden="true">
                          {entryStateWord(entry, lockedLabel, builtLabel) ?? placeLabel}
                        </span>
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
                  <div
                    className={classNames(styles.metric, styles.metricLevel)}
                    style={columnStyle("level")}
                    title={entry.buildingLevel >= 1 ? "Building level" : "No building level"}
                  >
                    {/* Not the raw number. A service building has no level, and
                        printing its 0 beside a Workers dash meaning "not known"
                        said it might have one we failed to read. See cm-ch0z. */}
                    {formatBuildingLevel(entry.buildingLevel)}
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
                    {entry.hasParking ? entry.parkingSlots : METRIC_NOT_APPLICABLE}
                  </div>
                </Button>
                </BuildingHoverCard>
                {/* Expanding is its own control now. It used to be the whole
                    row, which meant the row and every other view mode taught
                    two different verbs for the same gesture. A chevron says
                    "there is more inside this" without claiming the row. */}
                <Button
                  className={classNames(styles.rowDetailsButton, isExpanded && styles.rowDetailsButtonOpen)}
                  variant="icon"
                  onSelect={() => toggleExpanded(entry.id)}
                  aria-label={rowInspectLabel}
                  title={rowInspectLabel}
                  data-expanded={isExpanded ? "true" : undefined}
                >
                  <span aria-hidden="true">{isExpanded ? "\u2303" : "\u2304"}</span>
                </Button>
                {isExpanded && (
                  <BuildingResultDetails entry={entry} resolveFacetLabel={resolveFacetLabel} />
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
