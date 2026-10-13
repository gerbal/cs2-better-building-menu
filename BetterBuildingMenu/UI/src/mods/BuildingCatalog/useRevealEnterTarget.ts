import { useEffect, type RefObject } from "react";

import { CATALOG_ANCHOR_MAX_FRAMES, isAnchorMeasurable, isScrollContainer, revealScrollTop } from "domain/catalogWindow";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

/**
 * When Up or Down moves Enter's target, its row comes wholly on screen, the list moving as little as it
 * takes. Only a moved target (a new step, so the page that answers a move, never a repeat the keys
 * dropped): the best match is the list's first row under Match. A row past the window is armed by id
 * all the same, and the list stays. Its own frame loop, as Cohtml lays out a frame late, and it ends
 * with one set on the first measurable frame: plates are placed by slot, so a late wrap moves no row.
 * See docs/design-notes.md, "The search field's keys".
 */
export function useRevealEnterTarget(rootRef: RefObject<HTMLElement>, targetId: number | null, step: number): void {
  useEffect(() => {
    if (targetId === null || step === 0) {
      return undefined;
    }

    let frame = 0;
    let handle = 0;
    let cancelled = false;

    const reveal = () => {
      if (cancelled || frame++ >= CATALOG_ANCHOR_MAX_FRAMES) {
        return;
      }

      const root = rootRef.current;
      const row = root ? lastCatalogRow(root, targetId) : null;
      const scroller = row && root ? findScrollContainer(row, root, isScrollContainer) : null;

      if (!row) {
        return;
      }

      if (scroller) {
        const rowRect = row.getBoundingClientRect();
        const box = scroller.getBoundingClientRect();
        const geometry = { containerTop: box.top, containerHeight: scroller.clientHeight, rowTop: rowRect.top, rowHeight: rowRect.height };

        if (isAnchorMeasurable(geometry)) {
          scroller.scrollTop = revealScrollTop(scroller.scrollTop, rowRect.top, rowRect.height, box.top, scroller.clientHeight);
          return;
        }
      }

      handle = requestAnimationFrame(reveal);
    };

    handle = requestAnimationFrame(reveal);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [rootRef, targetId, step]);
}
