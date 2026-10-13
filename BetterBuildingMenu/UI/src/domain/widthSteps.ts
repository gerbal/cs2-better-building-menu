/**
 * The build menu's Width steps on this screen: their widths, the width a stored step draws
 * at, and the steps the right edge snaps to. The widths are C#'s rule (WidthSteps.cs), from
 * sharedContracts.generated.ts; where the box sits is the UI's. See docs/design-notes.md,
 * "The Width steps".
 */
import { CONTROL_PANE_TOTAL, VANILLA_TOOL_COLUMN_WIDTH, dragDistanceRem } from "./assetMenuLayout";
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

/** What decides where a step can sit on this screen. */
export interface WidthStepScreen {
  /** The screen's width over its height. */
  aspect: number;
  /** The game's text scale, which widens the tool options column the box starts beside. */
  textScale: number;
  paneShown: boolean;
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

/** The tool options column's right edge, where the row starts: the column grows by half the text scale's increase. */
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
  let drawn = sanitizeWidthStep(step);

  while (screen.paneShown && !fitsBesideThePane(drawn, widths, screen)) {
    drawn -= 1;
  }

  return Math.max(widths[0], Math.min(widths[drawn - 1], roomAt(drawn, screen)));
}

/** Where vanilla's build menu starts: the game centres its 706 rem box on the screen. */
export function vanillaBoxLeft(aspect: number): number {
  return (screenWidth(aspect) - WIDTH_STEP_VANILLA) / 2;
}

/** Where the box draws: its left edge on the screen, and that edge less vanilla's. */
export interface BoxPlacement {
  left: number;
  /** Negative for a box that reaches left of vanilla's slot. */
  offset: number;
}

/**
 * Where a box this wide sits: at vanilla's left edge while its right edge stays short of the
 * chirper's clearance, or beside the shown pane short of the pane's room; then growing left, never
 * past the tool options' edge, even on a screen where vanilla's own box would.
 */
export function boxPlacement(width: number, screen: WidthStepScreen): BoxPlacement {
  const vanilla = vanillaBoxLeft(screen.aspect);
  // The first three steps' limit: where a box stops growing right and starts growing left.
  const growsTo = rightLimit(LAST_STEP_CLEAR_OF_THE_CHIRPER, screen);
  const left = Math.max(toolOptionsEdge(screen.textScale), Math.min(vanilla, growsTo - width));

  return { left, offset: left - vanilla };
}

/** The steps the right edge snaps to, narrowest first: beside the shown pane, only those that fit. */
export function snapTargets(screen: WidthStepScreen): WidthSnap[] {
  const widths = widthStepWidths(screen.aspect);
  return widths
    .map((_, index) => index + 1)
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
 * The width a drag from `startX` to `currentX` shows, held between the narrowest and the
 * widest step the edge snaps to. `pxPerRem` is measured off the strip as it was pressed.
 */
export function draggedStepWidth(
  startWidth: number,
  startX: number,
  currentX: number,
  snaps: readonly WidthSnap[],
  pxPerRem?: number
): number {
  const raw = startWidth + dragDistanceRem(startX, currentX, pxPerRem);
  if (!Number.isFinite(raw) || snaps.length === 0) return startWidth;

  const widths = snaps.map((snap) => snap.width);
  return Math.min(Math.max(...widths), Math.max(Math.min(...widths), raw));
}
