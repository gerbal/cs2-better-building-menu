import { useEffect, useRef, type RefObject } from "react";
import {
  CATALOG_ANCHOR_MAX_FRAMES,
  anchorScrollTop,
  isAnchorMeasurable,
  isAnchorOnScreen,
  isOnLineOne,
  isScrollContainer,
  lineOneScrollTop,
} from "domain/catalogWindow";
import type { AnchorGeometry } from "domain/catalogWindow";
import { getAssetMenuAnchor, getAssetMenuListStart, setAssetMenuAnchor, setAssetMenuListStart } from "domain/assetMenuViewStore";
import { planListScroll, type ListScroll, type StartMove } from "domain/listScroll";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

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
 * How many frames running the list must read in place before a move ends: one frame after a set,
 * Cohtml can still re-wrap the rows above the anchored one and drop it off line 1.
 */
const IN_PLACE_READINGS = 2;

/**
 * One frame of a move: true when the list reads where the move puts it, or else a set towards it. A
 * row that has not rendered, or rects still at Cohtml's pre-layout zeroes, are worth another frame.
 */
function moveList(root: HTMLElement | null, move: Move): boolean {
  const row = root ? lastCatalogRow(root, move.kind === "top" ? undefined : move.id) : null;

  if (!root || !row) {
    return false;
  }

  const scroller = findScrollContainer(row, root, isScrollContainer);

  if (move.kind === "top") {
    // A list that fits has nothing to scroll.
    if (!scroller || scroller.scrollTop <= 0) return true;

    scroller.scrollTop = 0;
    return false;
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
  // A start's move from its first page until it ends, so a page landing mid-move carries it on.
  const underWay = useRef<StartMove | null>(null);
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
      underWay: underWay.current,
    });

    // The mount's first page with rows is its one chance to restore: a row armed after it is not a
    // remount. A restore in flight stays unsettled until it ends, so a page landing mid-move redoes it.
    if (move.kind === "none") {
      if (itemCount > 0) settled.current = true;
      return;
    }

    if (move.kind !== "restore") underWay.current = move;

    let frame = 0;
    let inPlace = 0;
    let handle = 0;
    let cancelled = false;

    // Recorded only when the loop ends: a page that lands mid-move plans the same move again.
    const finish = () => {
      settled.current = true;

      if (move.kind !== "restore") {
        underWay.current = null;
        setAssetMenuListStart(move.start);
        setAssetMenuAnchor(anchorKey, move.kind === "lineOne" ? move.id : null);
      }
    };

    const step = () => {
      if (cancelled) {
        return;
      }

      // Out of budget, the list stays where it is: a row that never rendered is not worth chasing.
      if (frame++ >= CATALOG_ANCHOR_MAX_FRAMES) {
        finish();
        return;
      }

      inPlace = moveList(rootRef.current, move) ? inPlace + 1 : 0;

      if (inPlace >= IN_PLACE_READINGS) {
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
