import { useEffect, useRef, type RefObject } from "react";
import {
  CATALOG_ANCHOR_MAX_FRAMES,
  anchorScrollTop,
  isAnchorMeasurable,
  isAnchorOnScreen,
  isOnLineOne,
  isScrollContainer,
  lineOneScrollTop,
  revealScrollTop,
} from "domain/catalogWindow";
import type { AnchorGeometry } from "domain/catalogWindow";
import { getAssetMenuAnchor, getAssetMenuListStart, setAssetMenuAnchor, setAssetMenuListStart } from "domain/assetMenuViewStore";
import { planListScroll, type ListScroll } from "domain/listScroll";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

/**
 * Breathing room under a revealed detail, in CSS pixels. Small on purpose: it
 * keeps the last line clear of the asset menu's edge, not centred.
 */
const EXPANDED_ROW_REVEAL_MARGIN = 6;

/** What a page says about where its list starts; see BuildingCatalogPage. */
export interface ListStartPage {
  /** Which start of the list the page answers, or null before C# sends one. */
  listStart: number | null;
  anchorId: number;
  anchorIndex: number;
  itemCount: number;
}

type Move = Exclude<ListScroll, { kind: "none" }>;

/**
 * One frame of a move: true once the list is where the move puts it. A row that has not rendered,
 * or rects still at Cohtml's pre-layout zeroes, are worth another frame.
 */
function moveList(root: HTMLElement | null, move: Move): boolean {
  const row = root ? lastCatalogRow(root, move.kind === "top" ? undefined : move.id) : null;

  if (!root || !row) {
    return false;
  }

  const scroller = findScrollContainer(row, root, isScrollContainer);

  if (move.kind === "top") {
    // A list that fits has nothing to scroll.
    if (scroller) scroller.scrollTop = 0;
    return true;
  }

  if (!scroller) {
    return false;
  }

  const rowRect = row.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const geometry: AnchorGeometry = {
    containerTop: scrollerRect.top,
    containerHeight: scroller.clientHeight,
    rowTop: rowRect.top,
    rowHeight: rowRect.height,
  };

  if (!isAnchorMeasurable(geometry)) {
    return false;
  }

  if (move.kind === "restore") {
    if (isAnchorOnScreen(geometry)) return true;

    scroller.scrollTop = anchorScrollTop(scroller.scrollTop, geometry.rowTop, geometry.containerTop, geometry.containerHeight);
    return false;
  }

  if (isOnLineOne(geometry)) {
    return true;
  }

  const before = scroller.scrollTop;
  scroller.scrollTop = lineOneScrollTop(before, geometry.rowTop, geometry.containerTop);

  // In the list's last screen the row cannot reach line 1: in view, where the scroll stops, is in place.
  return scroller.scrollTop === before && isAnchorOnScreen(geometry);
}

/**
 * Puts the list in place when a page lands, over as many frames as it takes: at a new start (an
 * open, a tab pick, a sort) the anchored row on line 1, or the list at its top; on a remount, the
 * kept row back in view, once. A retry loop, not one measurement: Cohtml lays out asynchronously and
 * the window is still arriving from C#. See docs/design-notes.md, "Opening on the building's tab".
 */
export function useScrollAnchor(rootRef: RefObject<HTMLElement>, anchorKey: string, page: ListStartPage): void {
  // Per mount: a remount brings its row back once, and a start in this mount puts that aside.
  const settled = useRef(false);
  const { listStart, anchorId, anchorIndex, itemCount } = page;

  useEffect(() => {
    const move = planListScroll({
      listStart,
      positioned: getAssetMenuListStart(),
      anchorId,
      anchorIndex,
      itemCount,
      stored: getAssetMenuAnchor(anchorKey),
      settled: settled.current,
    });

    // The mount's first page with rows is its one chance to restore: a row armed after it is not a
    // remount. A restore in flight stays unsettled until it ends, so a page landing mid-move redoes it.
    if (move.kind === "none") {
      if (itemCount > 0) settled.current = true;
      return;
    }

    let frame = 0;
    let handle = 0;
    let cancelled = false;

    // Recorded only when the loop ends: a page that lands mid-move plans the same move again.
    const finish = () => {
      settled.current = true;

      if (move.kind !== "restore") {
        setAssetMenuListStart(move.start);
        setAssetMenuAnchor(anchorKey, move.kind === "lineOne" ? move.id : null);
      }
    };

    const step = () => {
      if (cancelled) {
        return;
      }

      // Out of budget, the list stays where it is: a row that never rendered is not worth chasing.
      if (frame++ >= CATALOG_ANCHOR_MAX_FRAMES || moveList(rootRef.current, move)) {
        finish();
        return;
      }

      handle = requestAnimationFrame(step);
    };

    handle = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
    // The page's numbers rather than its rows: a new array every publish would restart the move on
    // data that has not moved.
  }, [rootRef, anchorKey, listStart, anchorId, anchorIndex, itemCount]);
}

/**
 * Bring a freshly expanded row's detail into view, since expanding grows the
 * row downward and the list does not follow. A ResizeObserver, not a rAF:
 * Cohtml lays out a frame late, so a rAF reads the pre-expansion height.
 */
export function useRevealExpandedRow(
  rootRef: RefObject<HTMLElement>,
  expandedId: number | null,
  detailClassName: string
): void {
  useEffect(() => {
    const root = rootRef.current;

    if (expandedId === null || !root) {
      return;
    }

    const row = lastCatalogRow(root, expandedId);

    if (!row) {
      return;
    }

    const detail = row.querySelector(`.${detailClassName}`) ?? row;
    const scroller = findScrollContainer(row, root, isScrollContainer);

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
  }, [rootRef, expandedId, detailClassName]);
}
