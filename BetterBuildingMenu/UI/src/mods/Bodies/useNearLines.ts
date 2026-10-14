import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { deviceRem, nearLines, screenLine, type BodyGrid } from "domain/bodyGeometry";
import { listScroller } from "mods/BuildingCatalog/catalogDom";

/** How often the scroll is read: often enough that a wheel's few lines find their names planned. */
const SCROLL_POLL_MS = 100;

/** The lines on or near the screen; see `nearLines`. */
export interface NearLines {
  from: number;
  to: number;
}

/** The first line on screen, as the body's scroller is scrolled; the top's where none is found. */
function screenFirst(grid: BodyGrid, scroller: HTMLElement | null): number {
  const rem = deviceRem(window.innerHeight);
  return screenLine(grid, scroller !== null && rem > 0 ? scroller.scrollTop * rem : 0);
}

/** The first line moved to `next`, only where that moves the lines near the screen. */
function moveFirst(setFirst: Dispatch<SetStateAction<number>>, grid: BodyGrid, next: number): void {
  setFirst((last) => {
    const [was, will] = [nearLines(grid, last), nearLines(grid, next)];
    return was.from === will.from && was.to === will.to ? last : next;
  });
}

/**
 * The lines on or near the screen, from where the body has scrolled: read before the paint whenever
 * `rows` changes, as a new result can bring the scroll back to its top, then on a frame every
 * `SCROLL_POLL_MS`, as Cohtml sends no scroll event, so a sketch drawn after a jump stays one poll at most.
 * The scroller is found again whenever `rows` changes, and the top's stands in until the body has drawn.
 * They change only when `nearLines` moves them, so the body draws again only then; and not at all where
 * nothing it draws is planned (`watched` false, the icons without names). The ref goes on the body's own
 * element, under which the scroller is found.
 */
export function useNearLines(grid: BodyGrid, rows: unknown, watched = true): { body: RefObject<HTMLDivElement>; near: NearLines } {
  const body = useRef<HTMLDivElement>(null);
  const [first, setFirst] = useState(0);

  useLayoutEffect(() => {
    const root = body.current;
    if (watched && root) moveFirst(setFirst, grid, screenFirst(grid, listScroller(root)));
  }, [grid, rows, watched]);

  useEffect(() => {
    const root = body.current;
    if (!watched || !root) return undefined;
    // Found once a row draws past the screen; until then the body is at its top.
    let scroller: HTMLElement | null = null;
    let handle = 0;
    let read = 0;
    const step = () => {
      const now = Date.now();
      if (now - read >= SCROLL_POLL_MS) {
        read = now;
        scroller ??= listScroller(root);
        moveFirst(setFirst, grid, screenFirst(grid, scroller));
      }
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [grid, rows, watched]);

  return { body, near: nearLines(grid, first) };
}

/** Whether a slot's line is on or near the screen. */
export function slotIsNear(near: NearLines, cols: number, slot: number): boolean {
  const line = Math.floor(slot / Math.max(1, cols));
  return line >= near.from && line < near.to;
}
