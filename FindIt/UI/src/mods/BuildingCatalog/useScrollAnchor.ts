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
 * Breathing room under a revealed detail, in CSS pixels.
 *
 * Small on purpose: this is the difference between the last line touching
 * the panel edge and sitting just clear of it, not an attempt to centre
 * anything.
 */
const EXPANDED_ROW_REVEAL_MARGIN = 6;

/**
 * Put the player back where they were, over as many frames as it takes.
 *
 * This is a retry loop rather than a single measurement because Cohtml lays
 * out asynchronously: on the frame the panel remounts, every rect it reports
 * is zero (see `isAnchorMeasurable`), and the window itself is still
 * arriving from C# — the scroll height was measured growing from 1,440 to
 * 3,606 across the same handful of frames. Both settle within a few frames,
 * but neither settles by the time a `useEffect` runs.
 *
 * Each frame does one of three things: wait, because the geometry is not
 * real yet; apply the scroll and check it next frame; or stop, because the
 * row is on screen, the budget ran out, or the anchor is not in this match
 * set.
 *
 * Every element it measures is under `rootRef`: the anchored row is the last
 * `[data-catalog-entry]` for that id beneath the root, and the scroller is
 * found walking up from it and never past the root.
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

    // Cleared only when the loop finishes, not on sight. Clearing up front
    // lost the anchor to the first frame's zero-height rects and left the
    // restore looking like it had run.
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
        // The row never became reachable — a predicate changed while the
        // panel was down, or it sits beyond a window that stopped growing.
        // Top of the list is the honest answer, and it is where we already
        // are.
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

      // Verify next frame rather than trusting the arithmetic: it was
      // computed against a list that is still being filled, so the row it
      // aimed at moves.
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
 * Bring a freshly expanded row's detail into view.
 *
 * Expanding grows the row downward and the list did not follow. Measured
 * live: a detail's bottom sat at 642 against a viewport whose content ends
 * at 630, with scrollTop still 0 — twelve pixels under the fold and no cue
 * they were there. Reported from play as "some of it was cut off below the
 * scroll", and cm-qnfs made the detail taller, so it will happen more often.
 *
 * A ResizeObserver rather than a rAF, because the box being measured is the
 * one that just changed size: Cohtml lays out a frame late, so a single rAF
 * reads the PRE-expansion height and concludes nothing overflows. The
 * observer fires when the new height actually exists, and disconnects on
 * the first reveal so a later resize — the player dragging the panel — does
 * not yank the list.
 *
 * `detailClassName` is the row-details class from the catalog's stylesheet,
 * passed in so this hook does not import it.
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
