/**
 * Where a body draws each building: a grid of slots, each placed from its index alone, since Cohtml
 * has no CSS grid. Every length is in rem, inside the body, which is the box less its side margins.
 * Wider boxes add columns, never lines: the lines are the body's height. See docs/design-notes.md,
 * "The bodies".
 */

import { BODY_SIDE_MARGIN } from "./assetMenuLayout";
import { LAYOUT_HEIGHT } from "./sharedContracts.generated";

/** The list's three forms: two-line plates at 100% text; above it one-line plates, or two-line ones whole. */
export type ListForm = "plate2" | "plate1" | "plateWhole";

/** Between two slots, across and down. */
export const SLOT_GAP = 2;

/** The narrowest a two-line plate may be: four across the game's own 706. */
export const PLATE_MIN_WIDTH = 171;

/** The narrowest a large-text plate may be: three across the game's own 706. */
export const LARGE_PLATE_MIN_WIDTH = 228;

/** A one-line plate's height above 100% text: six lines and five gaps make the game's own body. */
export const PLATE1_HEIGHT = 22.375;

/** A whole-name plate's height above 100% text: four lines and three gaps make the game's own body. */
export const PLATE_WHOLE_HEIGHT = 34.56;

/** The Tiles view's name line needs this much room under the tiles, or it drops. */
export const TILE_NAME_LINE_MIN = 14;

export interface BodyGrid {
  /** The list's form, or the tiles. */
  form: ListForm | "tile";
  cols: number;
  /** Whole lines one screen of the body shows. */
  lines: number;
  cellWidth: number;
  cellHeight: number;
  pitchX: number;
  pitchY: number;
  /** The first slot's left and top, inside the slots' box. */
  x0: number;
  y0: number;
  /** How many lines a list name may take. */
  nameLines: number;
  /** Under the tiles, the room left for the line naming the armed or pointed tile; 0 in the list. */
  nameLine: number;
}

export interface BodyGridInput {
  body: "list" | "tiles";
  /** The box's drawn width. */
  boxWidth: number;
  /** The body's drawn height. */
  bodyHeight: number;
  /** A device pixel in rem (`deviceRem`), the shortfall a line forgives; none when left out. */
  pixelRem?: number;
  textScale: number;
  /** At large text: "moreBuildings" or "wholeNames". */
  atLargeText: string;
  /** Tile size, the Tiles view's tile side. */
  tileSize: number;
  /** The two-line plate's height at 100% text, the List plate height knob. */
  plateHeight: number;
  /** The Name lines knob: 0 the form's own, else 1 or 2. */
  nameLines: number;
}

/** The list's form: the two-line plate at 100% text; above it, At large text's choice. */
export function listForm(textScale: number, atLargeText: string): ListForm {
  if (!(textScale > 1)) return "plate2";
  return atLargeText === "wholeNames" ? "plateWhole" : "plate1";
}

const across = (room: number, least: number): number => Math.max(1, Math.floor((room + SLOT_GAP) / (least + SLOT_GAP)));

/**
 * The whole lines of this pitch a height shows, at least one: the last line needs no gap below it.
 * The one line count, so paging steps by the lines the body draws. A height in pixels takes its gap
 * in pixels too. The game's scroller reports its height in whole device pixels, up to one short of
 * the height drawn, so `tolerance` (a device pixel, in the height's unit) is the shortfall a line
 * forgives before it drops.
 */
export function wholeLines(height: number, pitch: number, gap: number = SLOT_GAP, tolerance: number = 0): number {
  return Math.max(1, Math.floor((height + gap + tolerance) / pitch));
}

/** A device pixel in rem at this screen height: the layout is LAYOUT_HEIGHT rem tall; 0 where the screen is unknown. */
export function deviceRem(innerHeight: number): number {
  return innerHeight > 0 && Number.isFinite(innerHeight) ? LAYOUT_HEIGHT / innerHeight : 0;
}

/** The slots for a body at this box, height, text scale and settings. */
export function bodyGrid(input: BodyGridInput): BodyGrid {
  const room = Math.max(0, input.boxWidth - 2 * BODY_SIDE_MARGIN);
  const height = Math.max(0, input.bodyHeight);

  if (input.body === "tiles") {
    const side = input.tileSize;
    const pitch = side + SLOT_GAP;
    const cols = across(room, side);
    const lines = wholeLines(height, pitch, SLOT_GAP, input.pixelRem);

    return {
      form: "tile",
      cols,
      lines,
      cellWidth: side,
      cellHeight: side,
      pitchX: pitch,
      pitchY: pitch,
      x0: (room - (cols * pitch - SLOT_GAP)) / 2,
      y0: 0,
      nameLines: 1,
      nameLine: Math.max(0, height - (lines * pitch - SLOT_GAP)),
    };
  }

  const form = listForm(input.textScale, input.atLargeText);
  const cellHeight = form === "plate2" ? input.plateHeight : form === "plate1" ? PLATE1_HEIGHT : PLATE_WHOLE_HEIGHT;
  const cols = across(room, form === "plate2" ? PLATE_MIN_WIDTH : LARGE_PLATE_MIN_WIDTH);
  const cellWidth = (room - (cols - 1) * SLOT_GAP) / cols;
  const pitchY = cellHeight + SLOT_GAP;
  const ownLines = form === "plate1" ? 1 : 2;

  return {
    form,
    cols,
    lines: wholeLines(height, pitchY, SLOT_GAP, input.pixelRem),
    cellWidth,
    cellHeight,
    pitchX: cellWidth + SLOT_GAP,
    pitchY,
    x0: 0,
    y0: 0,
    nameLines: input.nameLines === 1 || input.nameLines === 2 ? input.nameLines : ownLines,
    nameLine: 0,
  };
}

/** How many buildings one screen of the body shows. */
export function screenSlots(grid: BodyGrid): number {
  return grid.cols * grid.lines;
}

/** Where slot k sits: left to right, then down. */
export function slotPosition(grid: BodyGrid, index: number): { left: number; top: number } {
  return {
    left: grid.x0 + (index % grid.cols) * grid.pitchX,
    top: grid.y0 + Math.floor(index / grid.cols) * grid.pitchY,
  };
}

/** Where a label plate sits and how big it is: its slot, or across this many slots of its line. */
export function labelPlace(grid: BodyGrid, slot: number, span: number): { left: number; top: number; width: number; height: number } {
  const { left, top } = slotPosition(grid, slot);

  return { left, top, width: span <= 1 ? grid.cellWidth : span * grid.pitchX - SLOT_GAP, height: grid.cellHeight };
}

/**
 * The lines a page of the body steps by, so a page lands them on the top edge as it found them: the
 * slots' pitch and gap, or the cards' rows and the gap between them; none where neither is drawn.
 */
export function bodyLines(grid: BodyGrid | null, cards: { pitchY: number; rowGap: number } | null): { pitch: number; gap: number } {
  if (grid !== null) return { pitch: grid.pitchY, gap: SLOT_GAP };
  if (cards !== null) return { pitch: cards.pitchY, gap: cards.rowGap };
  return { pitch: 0, gap: SLOT_GAP };
}

/** The slots' height for this many buildings: the scroller's whole content. */
export function slotsHeight(grid: BodyGrid, count: number): number {
  return count <= 0 ? 0 : grid.y0 + Math.ceil(count / grid.cols) * grid.pitchY - SLOT_GAP;
}
