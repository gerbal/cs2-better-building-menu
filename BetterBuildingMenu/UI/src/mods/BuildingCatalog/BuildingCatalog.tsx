import { useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { catalogWindowRemaining, loadMoreCount } from "domain/catalogWindow";
import { getNumberSeparators, groupDigits } from "domain/assetMenuMetricFormat";
import { getAssetMenuEmptyStateMessage } from "domain/assetMenuFilterSummary";
import { assetMenuPort } from "domain/assetMenuPort";
import { enterDecision, getSearchScopeNotice, isEnterForSearch, isPlainEnter, pageAnswers } from "domain/buildingSearchRank";
import { blurSearchField, isSearchField } from "mods/TopRow/searchField";
import { canPlace } from "domain/buildingLockState";
import { getAssetMenuAnchorKey, setAssetMenuAnchor } from "domain/assetMenuViewStore";
import { useMenuBody } from "mods/useMenuBody";
import { GroupedResults } from "mods/GroupedResults/GroupedResults";
import { type GroupDimensionId } from "domain/buildingGroups";
import { useCatalogWindow } from "./useCatalogWindow";
import { useScrollAnchor } from "./useScrollAnchor";
import { useSearchFieldKeys } from "./useSearchFieldKeys";
import {
  BuildingCatalogGroupBy$,
  BuildingCatalogMatchesElsewhere$,
  BuildingCatalogMetricRanges$,
  AssetMenuFacets$,
  CurrentSearch$,
  send,
} from "mods/bindings";
import styles from "./buildingCatalog.module.scss";

/**
 * Memoised, and takes no props: it re-renders on its own bindings only, not on
 * every height-drag echo or keystroke that re-renders the asset menu around it.
 */
export const BuildingCatalogComponent = memo(function BuildingCatalogComponent() {
  const { translate } = useLocalization();
  const currentSearch = useValue(CurrentSearch$);
  // The menu's body: a typed search's, its own VIEW pick, Default view, or the look's Auto. See
  // docs/design-notes.md, "The bodies".
  const body = useMenuBody().drawn;
  const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;

  // The root every DOM measurement below is scoped to. The hooks find the
  // rows and the scroller beneath it and never look above it.
  const rootRef = useRef<HTMLDivElement>(null);
  const { items, totalCount, status, hasMore, capped, bestMatchId, searchText: pageSearch, enterStep, anchorId, anchorIndex, listStart, loadMore } = useCatalogWindow(rootRef, { viewMode: body, groupBy });
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const matchesElsewhere = useValue(BuildingCatalogMatchesElsewhere$);

  // Names the constraints that actually emptied the list, rather than always
  // blaming search and category.
  const emptyStateMessage = getAssetMenuEmptyStateMessage({
    searchText: currentSearch,
    facets,
    metricRanges,
  });

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
   * and rendered by every body: widening is the whole answer to a scoped
   * miss, and which body the menu draws has nothing to do with it.
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

  // Scoped to the list and the body, because which element owns the scroll
  // and how tall its children are both depend on them: an offset remembered in
  // the tiles means nothing in the list.
  const anchorKey = getAssetMenuAnchorKey({ list: "catalog", viewMode: body, groupBy });

  // Arms a prefab by id, loaded or not: Enter's target can sit past the window.
  const armById = useCallback((id: number): void => {
    // The keys go back to the camera with the building in hand. See docs/design-notes.md, "The
    // search field's keys".
    blurSearchField();

    // Placing unmounts the whole asset menu, so this is the last moment the scroll
    // position exists — and the building just chosen is what to come back to.
    setAssetMenuAnchor(anchorKey, id);

    // The backend resolves this id through its prefab index and activates the
    // normal prefab tool.
    assetMenuPort.activatePrefab({ prefabId: id });
  }, [anchorKey]);

  // Stable across renders, like every callback a row receives, so a memoised
  // row skips the re-render its parent does on each keystroke.
  const activate = useCallback((entry: BuildingCatalogEntry): void => {
    // A milestone-locked asset cannot be placed, and vanilla refuses the same
    // selection. Guarded here rather than in TryActivatePrefabTool, which
    // arrow-key navigation also calls and must step past a locked tile.
    if (!canPlace(entry)) return;

    armById(entry.id);
  }, [armById]);

  useScrollAnchor(rootRef, anchorKey, { listStart, anchorId, anchorIndex, itemCount: items.length });

  // Up, Down, PageUp and PageDown while the search field has the keys; Up and Down only once the
  // field names a target, the page answering the query in it. A move is answered by a new step or
  // by a page for a new query.
  useSearchFieldKeys(rootRef, bestMatchId !== null && pageAnswers({ searchText: pageSearch }, currentSearch ?? ""), `${pageSearch}\n${enterStep}`);

  // Enter arms the backend's best match by id, wherever its row is, so a search
  // can be finished without leaving the keyboard. One listener for every view, on
  // the document because the search field is the top row's; the ref keeps it
  // reading this render. An Enter pressed before the page catches up with the box
  // is held for it.
  const pendingEnter = useRef<string | null>(null);
  const onEnter = useRef<(event: KeyboardEvent) => void>(() => undefined);
  onEnter.current = (event) => {
    const fromField = isSearchField(event.target);
    if (!isEnterForSearch(event.target, fromField)) return;

    const decision = enterDecision({ bestMatchId, searchText: pageSearch }, currentSearch ?? "");
    pendingEnter.current = decision && "wait" in decision ? decision.wait : null;
    if (decision && "arm" in decision) {
      armById(decision.arm);
    } else if (fromField) {
      // Enter from the field ends the typing, whatever it arms: the camera keys come back. An arm
      // has already given them back.
      blurSearchField();
    }
  };
  useEffect(() => {
    const waiting = pendingEnter.current;
    if (waiting === null) return;

    // Typing on after Enter takes it back.
    if ((currentSearch ?? "").trim() !== waiting) {
      pendingEnter.current = null;
      return;
    }

    const decision = enterDecision({ bestMatchId, searchText: pageSearch }, waiting);
    if (decision && "wait" in decision) return;

    pendingEnter.current = null;
    if (decision) armById(decision.arm);
  }, [bestMatchId, pageSearch, currentSearch, armById]);
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
   * owns the scroll — which differs by view mode, so it is passed down. The tab
   * row's readout states the window and its true total, so this says only what
   * the readout cannot: Load more while the window can grow, and at the
   * ceiling, how to narrow the list instead.
   */
  const remaining = catalogWindowRemaining({ shown: items.length, total: totalCount });
  const separators = useMemo(() => getNumberSeparators(translate), [translate]);
  // Memoised with what it shows, so the views it is handed to can skip a render.
  const catalogFooter = useMemo(() => {
    if (!hasMore && !capped) return null;

    const capLine = (translate("Tooltip.LABEL[BetterBuildingMenu.ShowingOfTotalCapped]", "Showing {0} of {1} · narrow with a tab, the search or a filter")
      ?? "Showing {0} of {1} · narrow with a tab, the search or a filter")
      .replace("{0}", groupDigits(items.length, separators))
      .replace("{1}", groupDigits(totalCount, separators));

    return (
      <div className={styles.loadMoreRow}>
        {capped && <span className={classNames(styles.windowState, styles.windowStateCapped)}>{capLine}</span>}
        {hasMore && (
          <Button className={styles.loadMore} variant="flat" onSelect={loadMore}>
            {remaining === null
              ? translate("Tooltip.LABEL[BetterBuildingMenu.LoadMore]", "Load more") ?? "Load more"
              : (translate("Tooltip.LABEL[BetterBuildingMenu.LoadMoreCount]", "Load {0} more")
                ?? "Load {0} more").replace("{0}", `${loadMoreCount(remaining)}`)}
          </Button>
        )}
      </div>
    );
  }, [hasMore, capped, items.length, totalCount, remaining, translate, separators, loadMore]);

  return (
    <div ref={rootRef} className={styles.catalog}>
      {/* No controls here: Sort, Filter, Group and View are the top row's, and the
          control pane's while it shows, so this component draws results and nothing else. */}
      {scopeNoticeBlock}
      {/* Filters compose, so an empty intersection is easy to reach by
          accident, and silence there reads as a broken asset menu. */}
      {status === "indexing" && items.length === 0
        ? <div className={styles.empty}>{translate("Tooltip.LABEL[BetterBuildingMenu.IndexingBuildings]", "Indexing buildings…")}</div>
        : items.length === 0
          ? (scopeNotice
              // The notice above already says the set is empty AND what to do
              // about it; a second line would say it twice and contradict it.
              ? null
              : <div className={styles.empty}>{emptyStateMessage}</div>)
          : (
            <GroupedResults
              entries={items}
              viewMode={body === "tiles" ? "grid" : body}
              onPlace={activate}
              footer={catalogFooter}
            />
          )}
    </div>
  );
});
