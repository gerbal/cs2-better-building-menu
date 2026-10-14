import { useEffect, useRef, useState, type RefObject } from "react";

import { deviceRem, nearLines, screenLine, type BodyGrid } from "domain/bodyGeometry";
import { listScroller } from "mods/BuildingCatalog/catalogDom";

/** How often the scroll is read: often enough that a wheel's few lines find their names planned. */
const SCROLL_POLL_MS = 100;

/** The lines on or near the screen; see `nearLines`. */
export interface NearLines {
  from: number;
  to: number;
}

/**
 * The lines on or near the screen, from where the body has scrolled: read on a frame every
 * `SCROLL_POLL_MS`, as Cohtml sends no scroll event, the scroller found again whenever `rows` changes,
 * and the top's until the body has drawn. They change only when `nearLines` moves them, so the body draws
 * again only then. The ref goes on the body's own element, under which the scroller is found.
 */
export function useNearLines(grid: BodyGrid, rows: unknown): { body: RefObject<HTMLDivElement>; near: NearLines } {
  const body = useRef<HTMLDivElement>(null);
  const [first, setFirst] = useState(0);

  useEffect(() => {
    const root = body.current;
    if (!root) return undefined;
    // Found once a row draws past the screen; until then the body is at its top.
    let scroller: HTMLElement | null = null;
    let handle = 0;
    let read = 0;
    const step = () => {
      const now = Date.now();
      if (now - read >= SCROLL_POLL_MS) {
        read = now;
        scroller ??= listScroller(root);
        const rem = deviceRem(window.innerHeight);
        const next = screenLine(grid, scroller !== null && rem > 0 ? scroller.scrollTop * rem : 0);
        setFirst((last) => {
          const [was, will] = [nearLines(grid, last), nearLines(grid, next)];
          return was.from === will.from && was.to === will.to ? last : next;
        });
      }
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [grid, rows]);

  return { body, near: nearLines(grid, first) };
}

/** Whether a slot's line is on or near the screen. */
export function slotIsNear(near: NearLines, cols: number, slot: number): boolean {
  const line = Math.floor(slot / Math.max(1, cols));
  return line >= near.from && line < near.to;
}
