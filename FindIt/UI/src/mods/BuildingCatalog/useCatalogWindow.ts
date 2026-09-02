import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, type RefObject } from "react";
import mod from "../../../mod.json";
import type { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";
import { loadMoreCatalogCommand } from "domain/buildingCatalogContracts";
import { isScrollContainer, shouldLoadMore } from "domain/catalogWindow";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

export type BuildingCatalogPageStatus = "indexing" | "ready" | "empty";
type BuildingCatalogBindingPage = BuildingCatalogPage & { status?: BuildingCatalogPageStatus };

const BuildingCatalog$ = bindValue<BuildingCatalogBindingPage>(mod.id, "BuildingCatalog");

/**
 * The page as the backend published it, plus the one command that grows it.
 *
 * The window is the backend's: it grows by Limit and always comes back as a
 * prefix of the same ordering, so there is nothing to accumulate here and
 * nothing to page. hasMore is C#'s answer, because it is the only side that
 * knows both the match count and the ceiling — a client computing
 * `rendered < total` would keep offering to load rows the backend has
 * already refused to serve.
 */
export interface CatalogWindow {
  items: BuildingCatalogEntry[];
  totalCount: number;
  offset: number;
  limit: number;
  status: BuildingCatalogPageStatus;
  hasMore: boolean;
  loadMore(): void;
}

/**
 * The catalog's window over the result set, and the frame loop that grows
 * it when the player reaches the bottom.
 *
 * `rootRef` is the catalog's root element. Everything this measures is a
 * descendant of it — the last row, and the container that scrolls it —
 * found under the root rather than in the document, and never above it.
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

  /**
   * Asks the backend for the next chunk.
   *
   * Guarded against re-entry by `hasMore` alone rather than by a local
   * "loading" flag: the backend republishes the whole window, so a second
   * request that overtakes the first is idempotent, while a stale local flag
   * could latch on and stop the list growing for the rest of the session.
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
   * This polls instead of listening because, measured live on 2026-08-09,
   * there is nothing to listen to. cs2/ui's `Scrollable` accepts an
   * `onScroll` prop and never forwards it: walking the fiber from the
   * scrolling div to the Scrollable shows the prop arriving and no DOM node
   * below it carrying an onScroll — and a sweep of every element in the
   * running UI found not one scroll or wheel handler anywhere. Cohtml also
   * emits no native `scroll` event when `scrollTop` changes, so adding our
   * own listener would be just as dead. The engine scrolls its own overflow
   * containers and tells no one.
   *
   * What it does do is keep `scrollTop` readable and accurate, so a frame
   * loop sees the player arrive at the bottom just as well as an event would.
   * It only runs while there is more to fetch, and it stops the moment it
   * asks: the request changes `items.length`, which restarts the effect
   * against the larger window.
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

      // The last row, for the same reason the anchor takes it: the shelf
      // sits outside the body's scroll, so walking up from the first entry
      // can find the panel instead of the list.
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

  return { items, totalCount, offset, limit, status, hasMore, loadMore };
}
