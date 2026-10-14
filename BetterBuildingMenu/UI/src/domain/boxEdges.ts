/**
 * The box's edges: where a release of the top edge lands, whole lines of the open body, and what the readout says
 * while an edge is dragged. Pure. See docs/design-notes.md, "The top edge".
 */
import { ASSET_MENU_MAX_HEIGHT, ASSET_MENU_MIN_HEIGHT, clampAssetMenuHeight, drawnBodyHeight } from "./assetMenuLayout";
import type { LineSpacing } from "./bodyGeometry";
import type { Command } from "./command";

/**
 * How far the pointer must travel, in pixels, before a press becomes a drag. A hand wobbles a pixel or two inside a
 * click, and that must stay a click: one counted as a drag would move the menu where the player never asked.
 */
export const DRAG_THRESHOLD_PX = 3;

/**
 * The longest from one press on the top edge to the next that makes them a double press, in milliseconds. Timed here,
 * as the first press raises the drag's blocker, so the edge never hears a double click.
 */
export const DOUBLE_PRESS_MS = 400;

/** A press on the top edge, where and when, for the next to tell a double press by. */
export interface EdgePress {
  at: number;
  x: number;
  y: number;
}

/** Whether a press is the second of a double press: soon enough after the first, in its place, the first a click. */
export function isDoublePress(first: EdgePress | null, second: EdgePress): boolean {
  return first !== null
    && second.at - first.at >= 0
    && second.at - first.at <= DOUBLE_PRESS_MS
    && Math.abs(second.x - first.x) < DRAG_THRESHOLD_PX
    && Math.abs(second.y - first.y) < DRAG_THRESHOLD_PX;
}

/** The box collapsed to its top row and tabs, or opened again: C# keeps it and saves only a change. */
export const setCollapsedCommand = (collapsed: boolean): Command => ({ method: "SetAssetMenuCollapsed", args: [collapsed] });

/**
 * A height drag's release: C# saves the height it holds, and opens a collapsed box only where the release opens it,
 * a drag from the build menu's collapsed box, never the upgrades panel's.
 */
export const commitHeightCommand = (opens: boolean): Command => ({ method: "CommitAssetMenuHeight", args: [opens] });

/** A double press on the top edge: C# puts the box back at the game's own size, open, and saves once. */
export const restoreSizeCommand = (): Command => ({ method: "RestoreAssetMenuSize", args: [] });

/** The buildings the game's own build menu shows at its size, which the readout names beside a drag's. */
export const GAME_MENU_SCREEN = 18;

const thousandths = (rem: number): number => Math.round(rem * 1000) / 1000;

/** The most body the box draws, under the top HUD's band, which a release's whole lines must fit. */
const ROOM = Math.min(ASSET_MENU_MAX_HEIGHT, drawnBodyHeight(ASSET_MENU_MAX_HEIGHT));

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
 * Where a release of the top edge lands: the height of the whole lines nearest the pointer's, from the drag's floor
 * to the room the box draws its body in, the lines nearest the floor or the room where the pointer's are past them;
 * the height itself, held to that range, where the lines have no length or no whole line fits.
 */
export function snapToLines(height: number, spacing: LineSpacing): number {
  const held = (rem: number) => Math.min(ROOM, clampAssetMenuHeight(rem));
  if (!Number.isFinite(height) || !(spacing.pitch > 0)) return held(height);

  let lines = Math.max(1, Math.round((height - spacing.below - 2 * spacing.edge + spacing.gap) / spacing.pitch));
  while (heightOfLines(lines, spacing) < ASSET_MENU_MIN_HEIGHT) lines += 1;
  while (lines > 1 && heightOfLines(lines, spacing) > ROOM) lines -= 1;
  const snapped = heightOfLines(lines, spacing);

  return snapped >= ASSET_MENU_MIN_HEIGHT && snapped <= ROOM ? snapped : held(height);
}

/** The readout's words for a drag: its templates, in the player's language. */
export interface EdgeWords {
  /** "{0} lines · {1} buildings (game: {2})". */
  lines: string;
  /** "{0} lines (game: {1})", where the body cannot say how many buildings its lines hold. */
  linesOnly: string;
  /** "{0} line · {1} buildings (game: {2})", for one line. */
  line: string;
  /** "{0} line (game: {1})", for one line where the body cannot count its buildings. */
  lineOnly: string;
  /** "Release to collapse", for a drag below the body's floor. */
  collapse: string;
}

/**
 * What the readout says while the top edge is dragged: the whole lines the release lands on, the buildings they
 * show where the body knows, and the game's own menu's beside them.
 */
export function heightReadout(lines: number, buildings: number | null, words: EdgeWords, format: (count: number) => string): string {
  const one = lines === 1;
  return buildings === null
    ? (one ? words.lineOnly : words.linesOnly).replace("{0}", format(lines)).replace("{1}", format(GAME_MENU_SCREEN))
    : (one ? words.line : words.lines).replace("{0}", format(lines)).replace("{1}", format(buildings)).replace("{2}", format(GAME_MENU_SCREEN));
}

/** Whether a height the top edge is dragged to collapses the box on release: below the body's floor. */
export function collapses(height: number): boolean {
  return height < ASSET_MENU_MIN_HEIGHT;
}
