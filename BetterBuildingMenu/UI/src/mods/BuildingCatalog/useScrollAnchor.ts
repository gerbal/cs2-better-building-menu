import { useEffect, type RefObject } from "react";
import {
  CATALOG_ANCHOR_MAX_FRAMES,
  anchorScrollTop,
  isAnchorMeasurable,
  isAnchorOnScreen,
  isScrollContainer,
  revealScrollTop,
} from "domain/catalogWindow";
import type { AnchorGeometry } from "domain/catalogWindow";
import { getLensAnchor, setLensAnchor } from "domain/lensViewStore";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

/**
 * Breathing room under a revealed detail, in CSS pixels. Small on purpose: it
 * keeps the last line clear of the panel edge, not centred.
 */
const EXPANDED_ROW_REVEAL_MARGIN = 6;

/**
 * Put the player back where they were, over as many frames as it takes. A
 * retry loop, not one measurement: Cohtml lays out asynchronously and the
 * window is still arriving from C#, so neither has settled by the first effect.
 */
export function useScrollAnchor(rootRef: RefObject<HTMLElement>, anchorKey: string, itemCount: number): void {
  useEffect(() => {
    const anchored = getLensAnchor(anchorKey);

    if (anchored === null || itemCount === 0) {
      return;
    }

    let frame = 0;
    let handle = 0;
    let cancelled = false;

    // Cleared only when the loop finishes: clearing up front would lose the
    // anchor to the first frame's zero-height rects.
    const finish = () => {
      setLensAnchor(anchorKey, null);
    };

    const measure = (): { scroller: HTMLElement; geometry: AnchorGeometry } | null => {
      const root = rootRef.current;
      const row = root ? lastCatalogRow(root, anchored) : null;

      if (!root || !row) {
        return null;
      }

      const scroller = findScrollContainer(row, root, isScrollContainer);

      if (!scroller) {
        return null;
      }

      const rowRect = row.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();

      return {
        scroller,
        geometry: {
          containerTop: scrollerRect.top,
          containerHeight: scroller.clientHeight,
          rowTop: rowRect.top,
          rowHeight: rowRect.height,
        },
      };
    };

    const step = () => {
      if (cancelled) {
        return;
      }

      if (frame++ >= CATALOG_ANCHOR_MAX_FRAMES) {
        // The row never became reachable — a predicate changed while the panel
        // was down, or it sits beyond a window that stopped growing. Top of
        // the list is the honest answer, and where we already are.
        finish();
        return;
      }

      const measured = measure();

      if (measured === null) {
        // Not rendered yet, or not in this match set at all. Both look the
        // same from here and both are worth another frame, up to the budget.
        handle = requestAnimationFrame(step);
        return;
      }

      if (!isAnchorMeasurable(measured.geometry)) {
        handle = requestAnimationFrame(step);
        return;
      }

      if (isAnchorOnScreen(measured.geometry)) {
        finish();
        return;
      }

      measured.scroller.scrollTop = anchorScrollTop(
        measured.scroller.scrollTop,
        measured.geometry.rowTop,
        measured.geometry.containerTop,
        measured.geometry.containerHeight,
      );

      // Verify next frame rather than trusting the arithmetic: it is computed
      // against a list still being filled, so the row it aims at moves.
      handle = requestAnimationFrame(step);
    };

    handle = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
    // itemCount rather than the items array: the effect has to wait for the
    // rows to be in the document before it can find one, and a new array
    // identity every publish would re-run it on data that has not moved.
  }, [rootRef, anchorKey, itemCount]);
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
