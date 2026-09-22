import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, useRef, type RefObject } from "react";
import mod from "../../../mod.json";
import type { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";
import { loadMoreCatalogCommand } from "domain/buildingCatalogContracts";
import { canRequestMore, isScrollContainer, shouldLoadMore, type PendingLoadMore } from "domain/catalogWindow";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

export type BuildingCatalogPageStatus = "indexing" | "ready" | "empty";
type BuildingCatalogBindingPage = BuildingCatalogPage & { status?: BuildingCatalogPageStatus };

const BuildingCatalog$ = bindValue<BuildingCatalogBindingPage>(mod.id, "BuildingCatalog");

/**
 * The page as the backend published it, plus the one command that grows it. The
 * window is the backend's and always comes back as a prefix of the same
 * ordering, so there is nothing to accumulate here and nothing to page.
 */
export interface CatalogWindow {
  items: BuildingCatalogEntry[];
  totalCount: number;
  offset: number;
  limit: number;
  status: BuildingCatalogPageStatus;
  hasMore: boolean;
  /** The row Enter arms while a search is active; see BuildingCatalogPage. */
  bestMatchId: number | null;
  loadMore(): void;
}

/**
 * The catalog's window over the result set, and the frame loop that grows it
 * when the player reaches the bottom. Everything it measures is a descendant
 * of `rootRef`, found under the root and never above it.
 */
export function useCatalogWindow(
  rootRef: RefObject<HTMLElement>,
  scope: { viewMode: string; groupBy: string }
): CatalogWindow {
  const page = useValue(BuildingCatalog$);
  const items = page?.items ?? [];
  const totalCount = page?.totalCount ?? 0;
  const offset = page?.offset ?? 0;
  const limit = page?.limit ?? 100;
  const status: BuildingCatalogPageStatus = page?.status
    ?? (page ? (totalCount === 0 ? "empty" : "ready") : "indexing");
  const hasMore = page?.hasMore ?? false;
  const bestMatchId = page?.bestMatchId ?? null;

  // The request in flight. Each one grows the window by a step, so a second
  // sent before the first is answered loads twice; see canRequestMore.
  const pending = useRef<PendingLoadMore | null>(null);

  /** Asks the backend for the next chunk, once per published page. */
  function loadMore(): void {
    const now = Date.now();
    if (!hasMore || !canRequestMore(pending.current, page, now)) {
      return;
    }

    pending.current = { page, at: now };
    const command = loadMoreCatalogCommand();
    trigger(mod.id, command.method, ...command.args);
  }

  /**
   * The passive half of the trigger: watch where the scroll actually is. It
   * POLLS because there is nothing to listen to — cs2/ui's Scrollable never
   * forwards onScroll and Cohtml emits no scroll event — but scrollTop is true.
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

      // The last row, for the same reason the anchor takes it — see
      // lastCatalogRow.
      const root = rootRef.current;
      const row = root ? lastCatalogRow(root) : null;
      const scroller = root && row ? findScrollContainer(row, root, isScrollContainer) : null;

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
  }, [hasMore, items.length, scope.viewMode, scope.groupBy]);

  return { items, totalCount, offset, limit, status, hasMore, bestMatchId, loadMore };
}
