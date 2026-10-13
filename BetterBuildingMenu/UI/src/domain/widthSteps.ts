/**
 * The build menu's Width steps on this screen: their widths, the width a stored step draws
 * at, and the steps the right edge snaps to. The widths are C#'s rule (WidthSteps.cs), from
 * sharedContracts.generated.ts; where the box sits is the UI's. See docs/design-notes.md,
 * "The Width steps".
 */
import { CONTROL_PANE_TOTAL, TOP_ROW_INSET, VANILLA_TOOL_COLUMN_WIDTH, dragDistanceRem } from "./assetMenuLayout";
import {
  LAYOUT_HEIGHT,
  SOCIAL_COLUMN_RIGHT_OFFSET,
  WIDTH_ROOM_LEFT,
  WIDTH_ROOM_RIGHT_OFFSET,
  WIDTH_STEP_DEFAULT,
  WIDTH_STEP_REFERENCE_ASPECT,
  WIDTH_STEP_SHARE_DENOMINATOR,
  WIDTH_STEP_SHARES,
  WIDTH_STEP_VANILLA,
} from "./sharedContracts.generated";

/** The aspect read when the screen's cannot be: the layout's reference resolution's, C#'s own. */
export const REFERENCE_ASPECT = WIDTH_STEP_REFERENCE_ASPECT;

/**
 * How far from the screen's right edge the first three steps stop: 6 rem short of the
 * chirper. Only steps 4 and 5 run on over it, by the player's choice.
 */
export const CHIRPER_CLEARANCE_OFFSET = 420;

/** The widest step that stays clear of the chirper. */
const LAST_STEP_CLEAR_OF_THE_CHIRPER = 3;

/** The steps by number, narrowest first. */
export const WIDTH_STEP_NUMBERS: readonly number[] = WIDTH_STEP_SHARES.map((_, index) => index + 1);

/** Whether a step runs on over the chirper, by the player's choice. */
export function coversTheChirper(step: number): boolean {
  return step > LAST_STEP_CLEAR_OF_THE_CHIRPER;
}

/** What decides where a step can sit on this screen. */
export interface WidthStepScreen {
  /** The screen's width over its height. */
  aspect: number;
  /** The game's text scale, which widens the tool options column the box starts beside. */
  textScale: number;
  paneShown: boolean;
  /**
   * Where the game's slot starts, in rem, read off the screen: its rem width follows the pixel
   * ratio. Absent before the first layout, when the centred VANILLA_SLOT_WIDTH stands for it.
   */
  slotLeft?: number;
}

/** A step the right edge can snap to, and the width it draws at. */
export interface WidthSnap {
  step: number;
  width: number;
}

const usableAspect = (aspect: number): number => (Number.isFinite(aspect) && aspect > 0 ? aspect : REFERENCE_ASPECT);
const screenWidth = (aspect: number): number => LAYOUT_HEIGHT * usableAspect(aspect);

/** The five widths on a screen of this aspect, narrowest first: C#'s WidthSteps.For, computed in the same order. */
export function widthStepWidths(aspect: number): number[] {
  const room = Math.max(WIDTH_STEP_VANILLA, screenWidth(aspect) - WIDTH_ROOM_RIGHT_OFFSET - WIDTH_ROOM_LEFT);
  return WIDTH_STEP_SHARES.map((share) =>
    Math.round(WIDTH_STEP_VANILLA + ((room - WIDTH_STEP_VANILLA) * share) / WIDTH_STEP_SHARE_DENOMINATOR));
}

/** A stored step, or the first for anything that is not one. */
export function sanitizeWidthStep(step: unknown): number {
  return typeof step === "number" && Number.isInteger(step) && step >= 1 && step <= WIDTH_STEP_SHARES.length
    ? step
    : WIDTH_STEP_DEFAULT;
}

/** The tool options column's right edge, where the box starts: the column grows by half the text scale's increase. */
export function toolOptionsEdge(textScale: number): number {
  const scale = Number.isFinite(textScale) && textScale > 1 ? textScale : 1;
  return WIDTH_ROOM_LEFT + (VANILLA_TOOL_COLUMN_WIDTH * (scale - 1)) / 2;
}

/** How far right the box may reach at a step: short of the chirper or at the room's edge, and short of a shown pane. */
function rightLimit(step: number, screen: WidthStepScreen): number {
  const width = screenWidth(screen.aspect);
  const limit = step <= LAST_STEP_CLEAR_OF_THE_CHIRPER ? width - CHIRPER_CLEARANCE_OFFSET : width - WIDTH_ROOM_RIGHT_OFFSET;
  return screen.paneShown ? Math.min(limit, width - SOCIAL_COLUMN_RIGHT_OFFSET - CONTROL_PANE_TOTAL) : limit;
}

const roomAt = (step: number, screen: WidthStepScreen): number => rightLimit(step, screen) - toolOptionsEdge(screen.textScale);

/** Whether a step can draw beside the shown pane: the first three narrow to fit, a wider one fits whole or not at all. */
const fitsBesideThePane = (step: number, widths: readonly number[], screen: WidthStepScreen): boolean =>
  step <= LAST_STEP_CLEAR_OF_THE_CHIRPER || widths[step - 1] <= roomAt(step, screen);

/**
 * The width a stored step draws at. A step wider than its room narrows to it, never below
 * the game's own width; beside the shown pane, a step above the third that does not fit
 * draws as the widest that does, and the stored step comes back when the pane hides.
 */
export function drawnStepWidth(step: number, screen: WidthStepScreen): number {
  const widths = widthStepWidths(screen.aspect);
  const drawn = drawnStep(step, screen);

  return Math.max(widths[0], Math.min(widths[drawn - 1], roomAt(drawn, screen)));
}

/** The step a stored step draws as: itself, or beside the shown pane the widest step that fits. */
export function drawnStep(step: number, screen: WidthStepScreen): number {
  const widths = widthStepWidths(screen.aspect);
  let drawn = sanitizeWidthStep(step);

  while (screen.paneShown && !fitsBesideThePane(drawn, widths, screen)) {
    drawn -= 1;
  }

  return drawn;
}

/**
 * The game's slot for its build menu, which it centres on the screen, at its widest: the fallback
 * until the slot is measured. See docs/design-notes.md, "The box at its Width step, and the control pane".
 */
export const VANILLA_SLOT_WIDTH = 712;

/** Where the game's slot starts before it is measured: centred at VANILLA_SLOT_WIDTH. */
export function vanillaBoxLeft(aspect: number): number {
  return (screenWidth(aspect) - VANILLA_SLOT_WIDTH) / 2;
}

/** Where the game's slot starts, and so where the box at offset 0 draws: step 1 sits at its left. */
const slotLeft = (screen: WidthStepScreen): number =>
  screen.slotLeft !== undefined && Number.isFinite(screen.slotLeft) ? screen.slotLeft : vanillaBoxLeft(screen.aspect);

/** The game's slot's left edge in rem, from its rect in pixels; null for a rect not laid out yet. */
export function measuredSlotLeft(rect: { left: number; width: number } | null | undefined, innerHeight: number): number | null {
  if (!rect || !Number.isFinite(rect.left) || !(rect.width > 0) || !(innerHeight > 0)) return null;

  return (rect.left * LAYOUT_HEIGHT) / innerHeight;
}

/** Where the box draws: its left edge on the screen, and that edge less the game's slot's. */
export interface BoxPlacement {
  left: number;
  /** Negative for a box that reaches left of the game's slot. */
  offset: number;
}

/**
 * Where a box this wide sits: at the game's slot's left edge while its right edge stays short of the
 * chirper's clearance, or beside the shown pane short of the pane's room; then growing left, never
 * past the tool options' edge, even on a screen where vanilla's own box would.
 */
export function boxPlacement(width: number, screen: WidthStepScreen): BoxPlacement {
  const vanilla = slotLeft(screen);
  const left = Math.max(toolOptionsEdge(screen.textScale), Math.min(vanilla, growsTo(screen) - width));

  return { left, offset: left - vanilla };
}

/** The game's margin either side of its slot: its tool options column ends this far short of it. */
const VANILLA_SLOT_MARGIN = 6;

/**
 * How far the game's tool options column moves, in rem, for a box drawn here: none while the box
 * stays clear of the column, which ends a margin short of the slot, and once it reaches past that,
 * to where the width model puts the column, ending at the tool options' edge, so the box never
 * covers it. See docs/design-notes.md, "Patching vanilla's layout for the asset menu".
 */
export function toolOptionsShift(placement: BoxPlacement, screen: WidthStepScreen): number | null {
  const columnEnd = slotLeft(screen) - VANILLA_SLOT_MARGIN;
  const shift = toolOptionsEdge(screen.textScale) - columnEnd;

  return placement.left < columnEnd && shift < 0 ? shift : null;
}

/** The first three steps' limit: where a box stops growing right and starts growing left. */
const growsTo = (screen: WidthStepScreen): number => rightLimit(LAST_STEP_CLEAR_OF_THE_CHIRPER, screen);

/** How much further short of the chirper the top row stops than the box: its controls stay off the chirper's edge. */
const TOP_ROW_CHIRPER_GAP = 4;

/**
 * How far in from the box's right edge the top row ends: its inner edge, 4 rem in, or where the
 * box runs over the chirper, 10 rem short of the chirper, so no control sits over it.
 */
export function topRowRightInset(placement: BoxPlacement, width: number, aspect: number): number {
  const end = screenWidth(aspect) - CHIRPER_CLEARANCE_OFFSET - TOP_ROW_CHIRPER_GAP;

  return Math.max(TOP_ROW_INSET, placement.left + width - end);
}

/** Where a popover may end, in the box: its right edge, or 6 rem short of the chirper where the box runs over it. */
export function popoverRightLimit(placement: BoxPlacement, width: number, aspect: number): number {
  return Math.min(width, screenWidth(aspect) - CHIRPER_CLEARANCE_OFFSET - placement.left);
}

/** The steps the right edge snaps to, narrowest first: beside the shown pane, only those that fit. */
export function snapTargets(screen: WidthStepScreen): WidthSnap[] {
  const widths = widthStepWidths(screen.aspect);
  return WIDTH_STEP_NUMBERS
    .filter((step) => !screen.paneShown || fitsBesideThePane(step, widths, screen))
    .map((step) => ({ step, width: drawnStepWidth(step, screen) }));
}

/** The snap nearest a width; a tie goes to the narrower step. */
export function nearestSnapStep(width: number, snaps: readonly WidthSnap[]): number {
  let nearest: WidthSnap | undefined;
  for (const snap of snaps) {
    if (nearest === undefined || Math.abs(snap.width - width) < Math.abs(nearest.width - width)) nearest = snap;
  }
  return nearest?.step ?? WIDTH_STEP_DEFAULT;
}

/**
 * The widest box whose drawn right edge is no further right than `edge`. A box grows left, its
 * edge fixed, once it reaches the first three steps' limit, so the edge only moves again past
 * the width that fills the room: an edge at the limit or beyond takes that width.
 */
function widthWithEdgeAt(edge: number, screen: WidthStepScreen): number {
  const reach = edge >= growsTo(screen) ? Infinity : edge - slotLeft(screen);

  return Math.min(edge - toolOptionsEdge(screen.textScale), reach);
}

/**
 * How far the pointer must travel, in rem, before the box leaves the width it was pressed at. Short
 * of it a release keeps the step the box draws: where two steps share a right edge, a nudge of a few
 * pixels would otherwise take the wider or the narrower one.
 */
export const WIDTH_DRAG_DEAD_ZONE = 12;

/**
 * The width a drag from `startX` to `currentX` shows, held between the narrowest and the widest
 * step the edge snaps to. Short of the dead zone it is the width pressed; past it, the box whose
 * drawn right edge sits under the pointer, as far from it as the press was. `pxPerRem` is measured
 * off the strip as it was pressed.
 */
export function draggedStepWidth(
  startWidth: number,
  startX: number,
  currentX: number,
  snaps: readonly WidthSnap[],
  screen: WidthStepScreen,
  pxPerRem?: number
): number {
  const travelled = dragDistanceRem(startX, currentX, pxPerRem);
  const startEdge = boxPlacement(startWidth, screen).left + startWidth;
  const raw = widthWithEdgeAt(startEdge + travelled, screen);
  if (!Number.isFinite(raw) || snaps.length === 0 || Math.abs(travelled) < WIDTH_DRAG_DEAD_ZONE) return startWidth;

  const widths = snaps.map((snap) => snap.width);
  return Math.min(Math.max(...widths), Math.max(Math.min(...widths), raw));
}
