import { useValue } from "cs2/api";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { loadMoreCatalogCommand } from "domain/buildingCatalogContracts";
import { CATALOG_WINDOW_STEP, drawnCount, isScrollContainer, nextGrowth, nextWindowLimit, shouldFillViewport, shouldLoadMore } from "domain/catalogWindow";
import { reuseUnchanged } from "domain/stableEntries";
import { BuildingCatalog$, send, type BuildingCatalogPageStatus } from "mods/bindings";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

export type { BuildingCatalogPageStatus };

/** How often the scroll position is checked: often enough to meet the bottom. */
const LOAD_MORE_POLL_MS = 100;

/**
 * The page as the backend published it, plus the one command that grows it. The
 * window is the backend's and always comes back as a prefix of the same
 * ordering, so there is nothing to accumulate here and nothing to page. A view
 * may draw only the first rows of it (see CatalogDrawing); `items` is what it
 * draws and `pageItems` the whole page.
 */
export interface CatalogWindow {
  /** The entries to draw: the page, or its first rows while the view draws fewer. */
  items: BuildingCatalogEntry[];
  /** Every entry of the page, drawn or not: what Enter's best match is looked up in. */
  pageItems: BuildingCatalogEntry[];
  /** How many rows the next loadMore adds: a screen of the page, or a step from C#. */
  nextCount: number;
  totalCount: number;
  offset: number;
  limit: number;
  status: BuildingCatalogPageStatus;
  hasMore: boolean;
  /** The row Enter arms while a search is active; see BuildingCatalogPage. */
  bestMatchId: number | null;
  /** The search this page answers, which trails the box by a debounce. */
  searchText: string;
  loadMore(): void;
}

/**
 * How much of the page a view draws. `rows` is a screen's worth for a list view
 * (see rowsThatFit), or null to draw the whole page; `mustIncludeId` is a row the
 * menu must return to, which is drawn wherever it is.
 */
export interface CatalogDrawing {
  rows: number | null;
  mustIncludeId: number | null;
}

const DRAW_WHOLE_PAGE: CatalogDrawing = { rows: null, mustIncludeId: null };

/**
 * The catalog's window over the result set, and the frame loop that grows it
 * when the player reaches the bottom. Everything it measures is a descendant
 * of `rootRef`, found under the root and never above it.
 */
export function useCatalogWindow(
  rootRef: RefObject<HTMLElement>,
  scope: { viewMode: string; groupBy: string },
  shown = true,
  drawing: CatalogDrawing = DRAW_WHOLE_PAGE
): CatalogWindow {
  const page = useValue(BuildingCatalog$);
  // Unchanged rows keep their objects across pages, so memoised cards skip their
  // render when the window grows or a page is republished. See stableEntries.
  const kept = useRef<ReadonlyMap<number, BuildingCatalogEntry>>(new Map());
  const pageItems = useMemo(() => {
    const next = reuseUnchanged(kept.current, page?.items ?? []);
    kept.current = next.byId;
    return next.items;
  }, [page]);
  const totalCount = page?.totalCount ?? 0;
  const offset = page?.offset ?? 0;
  const limit = page?.limit ?? 100;
  const status: BuildingCatalogPageStatus = page?.status
    ?? (page ? (totalCount === 0 ? "empty" : "ready") : "indexing");
  const pageHasMore = page?.hasMore ?? false;
  const bestMatchId = page?.bestMatchId ?? null;
  const searchText = page?.searchText ?? "";

  // The rows drawn: a screen of the page to start, a screen more at a time as the
  // player scrolls, back to a screen whenever the menu is hidden (the next open
  // starts at the top). Kept with the screen size it grew from, so a new size (a
  // view, a height) starts over in the same render rather than drawing the whole
  // page once first.
  const [grown, setGrown] = useState(() => ({ screen: drawing.rows, count: drawing.rows }));
  const drawnRows = grown.screen === drawing.rows ? grown.count : drawing.rows;
  useEffect(() => {
    if (!shown) {
      setGrown({ screen: drawing.rows, count: drawing.rows });
    }
  }, [shown, drawing.rows]);
  const mustInclude = drawing.mustIncludeId === null ? -1 : pageItems.findIndex((item) => item.id === drawing.mustIncludeId);
  const count = drawnCount({ pageLength: pageItems.length, drawn: drawnRows, mustInclude });
  // A row the menu returned to stays drawn after the anchor that reached it clears.
  useEffect(() => {
    if (drawnRows !== null && count > drawnRows) {
      setGrown({ screen: drawing.rows, count });
    }
  }, [count, drawnRows, drawing.rows]);
  const items = useMemo(() => count >= pageItems.length ? pageItems : pageItems.slice(0, count), [pageItems, count]);
  const hasMore = count < pageItems.length || pageHasMore;
  const growth = nextGrowth({
    pageLength: pageItems.length,
    drawn: count,
    screen: drawing.rows ?? CATALOG_WINDOW_STEP,
    remaining: pageHasMore ? Math.max(1, totalCount - pageItems.length) : 0,
  });
  const drawTo = growth.kind === "draw" ? growth.count : -1;
  const nextCount = growth.kind === "draw"
    ? growth.count - count
    : Math.min(CATALOG_WINDOW_STEP, Math.max(0, totalCount - pageItems.length));

  /**
   * Draws a screen more of the page while it has undrawn rows; once it is all
   * drawn, asks the backend for the next chunk, by the limit wanted rather than
   * "one more": the same request arriving twice then grows the window once.
   */
  const loadMore = useCallback((): void => {
    if (drawTo >= 0) {
      setGrown({ screen: drawing.rows, count: drawTo });
      return;
    }

    if (growth.kind === "fetch") {
      send(loadMoreCatalogCommand(nextWindowLimit(limit, CATALOG_WINDOW_STEP, totalCount)));
    }
  }, [drawTo, growth.kind, drawing.rows, limit, totalCount]);

  // The poll below outlives the render it started in; through the ref it always
  // asks from the page on screen, not the one it started under.
  const latestLoadMore = useRef(loadMore);
  latestLoadMore.current = loadMore;

  /**
   * The passive half of the trigger: watch where the scroll actually is. It
   * POLLS because there is nothing to listen to — cs2/ui's Scrollable never
   * forwards onScroll and Cohtml emits no scroll event — but scrollTop is true.
   */
  useEffect(() => {
    // Hidden, the kept menu measures as nothing at all, which reads as a
    // viewport to fill: polling then would grow the window behind a closed menu.
    if (!shown || !hasMore || items.length === 0) {
      return;
    }

    let handle = 0;
    let cancelled = false;
    let lastCheck = 0;
    // Found once per layout, which is what this effect re-runs on: the walk up
    // from the last row reads every ancestor's scrollHeight.
    let scroller: HTMLElement | null = null;

    const step = () => {
      if (cancelled) {
        return;
      }

      const now = Date.now();

      if (now - lastCheck >= LOAD_MORE_POLL_MS) {
        lastCheck = now;

        // The last row, for the same reason the anchor takes it — see
        // lastCatalogRow.
        const root = rootRef.current;

        if (!scroller && root) {
          const row = lastCatalogRow(root);
          scroller = row ? findScrollContainer(row, root, isScrollContainer) : null;

          // Nothing scrolls yet: the window may not fill a tall menu or a dense view.
          if (!scroller && row) {
            const rowBox = row.getBoundingClientRect();

            if (shouldFillViewport({
              hasMore,
              lastRowBottom: rowBox.bottom,
              lastRowHeight: rowBox.height,
              viewportBottom: root.getBoundingClientRect().bottom,
            })) {
              latestLoadMore.current();
              return;
            }
          }
        }

        if (scroller && shouldLoadMore({
          scrollTop: scroller.scrollTop,
          clientHeight: scroller.clientHeight,
          scrollHeight: scroller.scrollHeight,
        })) {
          latestLoadMore.current();
          return;
        }
      }

      handle = requestAnimationFrame(step);
    };

    handle = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
    // The page's length as well as the drawn rows': a Load more that C# answers grows
    // the page, not the rows drawn, and the poll stopped when it asked.
  }, [rootRef, shown, hasMore, items.length, pageItems.length, scope.viewMode, scope.groupBy]);

  return { items, pageItems, nextCount, totalCount, offset, limit, status, hasMore, bestMatchId, searchText, loadMore };
}
