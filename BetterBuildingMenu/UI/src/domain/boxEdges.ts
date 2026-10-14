/**
 * The box's edges: where a release of the top edge lands, whole lines of the open body, and what the readout says
 * while an edge is dragged. Pure. See docs/design-notes.md, "The top edge".
 */
import { ASSET_MENU_MAX_HEIGHT, ASSET_MENU_MIN_HEIGHT, clampAssetMenuHeight } from "./assetMenuLayout";
import type { LineSpacing } from "./bodyGeometry";

/**
 * How far the pointer must travel, in pixels, before a press becomes a drag. A hand wobbles a pixel or two inside a
 * click, and that must stay a click: one counted as a drag would move the menu where the player never asked.
 */
export const DRAG_THRESHOLD_PX = 3;

/** The buildings the game's own build menu shows at its size, which the readout names beside a drag's. */
export const GAME_MENU_SCREEN = 18;

const thousandths = (rem: number): number => Math.round(rem * 1000) / 1000;

/**
 * The body's height that holds this many whole lines: the lines, the room above and below them, what it keeps under
 * them, to the thousandth of a rem, and a thousandth more where rounding leaves the last line a hair short, which the
 * body would count down.
 */
export function heightOfLines(lines: number, spacing: LineSpacing): number {
  const holds = (height: number) => Math.floor((height - 2 * spacing.edge - spacing.below + spacing.gap) / spacing.pitch) >= lines;
  let height = thousandths(lines * spacing.pitch - spacing.gap + 2 * spacing.edge + spacing.below);

  for (let nudge = 0; nudge < 3 && !holds(height); nudge++) height = thousandths(height + 0.001);
  return height;
}

/**
 * Where a release of the top edge lands: the height of the whole lines nearest the pointer's, inside the drag's
 * range, the lines nearest the floor or the ceiling where the pointer's are past them; the height itself, held to
 * the range, where the lines have no length or no whole line fits.
 */
export function snapToLines(height: number, spacing: LineSpacing): number {
  if (!Number.isFinite(height) || !(spacing.pitch > 0)) return clampAssetMenuHeight(height);

  let lines = Math.max(1, Math.round((height - spacing.below - 2 * spacing.edge + spacing.gap) / spacing.pitch));
  while (heightOfLines(lines, spacing) < ASSET_MENU_MIN_HEIGHT) lines += 1;
  while (lines > 1 && heightOfLines(lines, spacing) > ASSET_MENU_MAX_HEIGHT) lines -= 1;
  const snapped = heightOfLines(lines, spacing);

  return snapped >= ASSET_MENU_MIN_HEIGHT && snapped <= ASSET_MENU_MAX_HEIGHT ? snapped : clampAssetMenuHeight(height);
}

/** The readout's words for a drag: its templates, in the player's language. */
export interface EdgeWords {
  /** "{0} lines · {1} buildings (game: {2})". */
  lines: string;
  /** "{0} lines (game: {1})", where the body cannot say how many buildings its lines hold. */
  linesOnly: string;
}

/**
 * What the readout says while the top edge is dragged: the whole lines the release lands on, the buildings they
 * show where the body knows, and the game's own menu's beside them.
 */
export function heightReadout(lines: number, buildings: number | null, words: EdgeWords, format: (count: number) => string): string {
  return buildings === null
    ? words.linesOnly.replace("{0}", format(lines)).replace("{1}", format(GAME_MENU_SCREEN))
    : words.lines.replace("{0}", format(lines)).replace("{1}", format(buildings)).replace("{2}", format(GAME_MENU_SCREEN));
}
