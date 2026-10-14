import { setPointed } from "domain/assetMenuViewStore";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { cellsInField, remRect, type Rect } from "domain/hoverCardPlace";
import { lastCatalogRow, listScroller } from "mods/BuildingCatalog/catalogDom";

/** A cell's mouse enter, as the bodies hand it on: the cell, and where the pointer is, in pixels. */
export interface CellEnter {
  currentTarget: { getBoundingClientRect?: () => DOMRect } | null;
  clientX?: number;
  clientY?: number;
}

/**
 * The pointer entered a building's cell: it is the one pointed at, its cell read off the screen in rem,
 * and where the pointer entered it, for the hover card. A cell leaves through `clearPointed(id)`. Real
 * input sends mouse events only, so the bodies call these from their cells' mouse enter and leave.
 */
export function pointAt(entry: BuildingCatalogEntry, event: CellEnter): void {
  const height = typeof window === "undefined" ? 0 : window.innerHeight;
  const cell = remRect(event.currentTarget?.getBoundingClientRect?.(), height);
  const known = Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && height > 0;
  const at = known ? remRect({ left: event.clientX!, top: event.clientY!, width: 0, height: 0 }, height) : null;
  setPointed(at === null ? { entry, cell } : { entry, cell, at: { x: at.x, y: at.y } });
}

/**
 * What the box draws now, in screen rem: the box, the pointed cell where it sits (null while it draws none),
 * and how to read the cells its body's field shows, which reads them once, on the first call.
 */
export interface DrawnCells {
  box: Rect;
  cells: () => Rect[];
  cell: Rect | null;
}

/**
 * Reads the box as drawn, for a card to place itself against: only the cells meeting the body's
 * scroller, as a cell scrolled out of it sits above or below the body. A body that fits scrolls none out.
 * The cells are read only when a card asks for them: up to a window's worth of rectangles, and a card that
 * fits above the box, or gives way to no cell, needs none.
 */
export function drawnCells(box: HTMLElement, pointedId: number, innerHeight: number): DrawnCells {
  const pointed = lastCatalogRow(box, pointedId);
  let cells: Rect[] | null = null;

  return {
    box: remRect(box.getBoundingClientRect(), innerHeight),
    cells: () => {
      if (cells === null) cells = cellsDrawn(box, innerHeight);
      return cells;
    },
    cell: pointed === null ? null : remRect(pointed.getBoundingClientRect(), innerHeight),
  };
}

/** The cells meeting the body's scroller, in screen rem. */
function cellsDrawn(box: HTMLElement, innerHeight: number): Rect[] {
  const all = Array.from(box.querySelectorAll("[data-bbm-item]")).map((cell) => remRect(cell.getBoundingClientRect(), innerHeight));
  const scroller = listScroller(box);

  return scroller === null ? all : cellsInField(all, remRect(scroller.getBoundingClientRect(), innerHeight));
}
