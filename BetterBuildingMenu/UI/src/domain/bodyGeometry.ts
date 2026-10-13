/**
 * Where a body draws each building: a grid of slots, each placed from its index alone, since Cohtml
 * has no CSS grid. Every length is in rem, inside the body, which is the box less its side margins.
 * Wider boxes add columns, never lines: the lines are the body's height. See docs/design-notes.md,
 * "The bodies".
 */

import { BODY_SIDE_MARGIN } from "./assetMenuLayout";
import { LAYOUT_HEIGHT, WIDTH_STEP_VANILLA } from "./sharedContracts.generated";

/**
 * The list's forms: two-line plates at 100% text; above it one-line plates, or two-line ones whole; and
 * a small menu's big plates, which have room for a large picture, the name above the numbers.
 */
export type ListForm = "plate2" | "plate1" | "plateWhole" | "big";

/** Between two slots, across and down. */
export const SLOT_GAP = 2;

/** The narrowest a two-line plate may be: four across the game's own 706. */
export const PLATE_MIN_WIDTH = 171;

/** The narrowest a large-text plate may be: three across the game's own 706. */
export const LARGE_PLATE_MIN_WIDTH = 228;

/**
 * A one-line plate's height above 100% text, and the room its 24 rem picture overhangs it by above and
 * below: six plates a picture apart, the first a rem down, hold six whole pictures in the game's own body.
 */
export const PLATE1_HEIGHT = 22;
const PLATE1_OVERHANG = 1;

/** A whole-name plate's height above 100% text: four lines and three gaps make the game's own body. */
export const PLATE_WHOLE_HEIGHT = 34.56;

/** The Tiles view's name line needs this much room under the tiles, or it drops. */
export const TILE_NAME_LINE_MIN = 14;

/** A big plate's picture at its largest; a shorter plate's is its height less 4. */
const BIG_PICTURE_MAX = 66;

/** A list plate's name line and number line at 100% text (listBody.module.scss). */
const NAME_PITCH = 12.5;
const NUMBER_PITCH = 12;

/**
 * The room a grown plate keeps besides its lines of text, so they never touch its edges: the big
 * form's beside two name and two number lines, a one-line plate's beside two name lines.
 */
const GROWN_SPARE = 10;

/** The body's room at the first Width step, the game's own box less its side margins. */
const FIRST_STEP_ROOM = WIDTH_STEP_VANILLA - 2 * BODY_SIDE_MARGIN;

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
  /**
   * The picture's side: the big form's, as tall as the plate allows; the tiles' own; 0 in the other
   * list forms, whose stylesheet sets it.
   */
  picture: number;
  /**
   * How many columns the same form has at the first Width step, which a search's results fill
   * first.
   */
  firstCols: number;
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
  /**
   * The open menu's whole row count, which a small menu's list grows from; 0 or absent while
   * uncounted.
   */
  menuRows?: number;
  /**
   * The slots the list draws at its columns, its labels' included; a grown list gains the lines they
   * need.
   */
  drawnSlots?: number;
  /** The Small menus grow knob; absent is off. */
  smallMenusGrow?: boolean;
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
 * forgives before it drops. `edge` is the room the first line keeps above it and the last below it.
 */
export function wholeLines(height: number, pitch: number, gap: number = SLOT_GAP, tolerance: number = 0, edge: number = 0): number {
  return Math.max(1, Math.floor((height - 2 * edge + gap + tolerance) / pitch));
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
      picture: side - 4,
      firstCols: across(FIRST_STEP_ROOM, side),
    };
  }

  const form = listForm(input.textScale, input.atLargeText);
  const least = form === "plate2" ? PLATE_MIN_WIDTH : LARGE_PLATE_MIN_WIDTH;
  const cols = across(room, least);
  const cellWidth = (room - (cols - 1) * SLOT_GAP) / cols;
  const plateHeight = form === "plate2" ? input.plateHeight : form === "plate1" ? PLATE1_HEIGHT : PLATE_WHOLE_HEIGHT;
  // A one-line plate's picture overhangs it, so its first and last lines keep that room to the body's edges.
  const overhang = form === "plate1" ? PLATE1_OVERHANG : 0;
  const lines = wholeLines(height, plateHeight + SLOT_GAP, SLOT_GAP, input.pixelRem, overhang);
  const firstCols = across(FIRST_STEP_ROOM, least);
  // Grown lines share the body less a device pixel: the scroller reads its height in whole pixels, up
  // to one short, and lines that filled it exactly would scroll by that sliver.
  const shared = (count: number) => (height - (input.pixelRem ?? 0) - (count - 1) * SLOT_GAP) / count;
  const growth = grownLines(input, lines, firstCols, cols);
  // A one-line plate grown shorter than its picture would draw it past the body's edges: the form's own
  // plates keep the room for it instead.
  const grown = growth !== null && overhang > 0 && shared(growth) < plateHeight + 2 * overhang ? null : growth;
  const cellHeight = grown === null ? plateHeight : shared(grown);
  const big = grown !== null && cellHeight >= bigPlateMin(input.textScale);
  // A grown plate tall enough for two name lines takes them, whatever its form's own.
  const ownLines = form === "plate1" && !(grown !== null && cellHeight >= twoNameLines(input.textScale)) ? 1 : 2;

  return {
    form: big ? "big" : form,
    cols,
    lines: grown ?? lines,
    cellWidth,
    cellHeight,
    pitchX: cellWidth + SLOT_GAP,
    pitchY: cellHeight + SLOT_GAP,
    x0: 0,
    // A grown plate is tall enough for its picture: only the plate the form sizes needs the room.
    y0: grown === null ? overhang : 0,
    nameLines: input.nameLines === 1 || input.nameLines === 2 ? input.nameLines : big ? 2 : ownLines,
    nameLine: 0,
    picture: big ? Math.min(BIG_PICTURE_MAX, cellHeight - 4) : 0,
    firstCols,
  };
}

/**
 * The lines a small menu's list grows to: as many as its rows fill at the first Width step's columns,
 * two at least, where they leave a line of the form's own to spare; null for a menu that does not grow.
 * Fixed per menu, from its whole row count at a text scale, so no tab, filter or Width step resizes its
 * plates: a wider step adds columns, never taller plates. Labels take slots too, so where the slots
 * drawn need more lines it gains them, and a grown list never scrolls; past the form's own lines it
 * does not grow.
 */
function grownLines(input: BodyGridInput, lines: number, firstCols: number, cols: number): number | null {
  const rows = input.menuRows ?? 0;

  if (input.smallMenusGrow !== true || rows <= 0 || rows > firstCols * (lines - 1)) {
    return null;
  }

  const grown = Math.max(2, Math.ceil(rows / firstCols), Math.ceil((input.drawnSlots ?? 0) / cols));
  return grown > lines ? null : grown;
}

/** The shortest plate the big form fits: two name lines, two number lines and room to spare. */
function bigPlateMin(textScale: number): number {
  return 2 * (NAME_PITCH + NUMBER_PITCH) * textScale + GROWN_SPARE;
}

/** The shortest plate two name lines fit, with room to spare: a grown one-line plate's room. */
function twoNameLines(textScale: number): number {
  return 2 * NAME_PITCH * textScale + GROWN_SPARE;
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
 * slots' pitch and gap, or the cards' rows and the gap between them; none where neither is drawn. The
 * edge is the room the slots keep above the first line and below the last, which a one-line plate's
 * picture overhangs into: line 1 sits that far down, and a screen holds the lines that fit inside it.
 */
export function bodyLines(grid: BodyGrid | null, cards: { pitchY: number; rowGap: number } | null): { pitch: number; gap: number; edge: number } {
  if (grid !== null) return { pitch: grid.pitchY, gap: SLOT_GAP, edge: grid.y0 };
  if (cards !== null) return { pitch: cards.pitchY, gap: cards.rowGap, edge: 0 };
  return { pitch: 0, gap: SLOT_GAP, edge: 0 };
}

/** The slots' height for this many buildings: the scroller's whole content, the first slot's top room again below the last. */
export function slotsHeight(grid: BodyGrid, count: number): number {
  return count <= 0 ? 0 : 2 * grid.y0 + Math.ceil(count / grid.cols) * grid.pitchY - SLOT_GAP;
}
