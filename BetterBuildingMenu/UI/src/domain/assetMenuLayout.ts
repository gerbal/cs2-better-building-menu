import sizes from "./assetMenuLayout.module.scss";
import {
  ASSET_MENU_DEFAULT_HEIGHT,
  ASSET_MENU_MAX_HEIGHT,
  ASSET_MENU_MIN_HEIGHT,
} from "./sharedContracts.generated";

/**
 * A length assetMenuGeometry.scss states, exported by assetMenuLayout.module.scss,
 * in rem; NaN when there is no such length. The stylesheets draw these, so they
 * hold the numbers and the arithmetic here reads them rather than a copy.
 */
function sheetRem(name: string): number {
  const length = /^(\d+(?:\.\d+)?)rem$/.exec(sizes[name] ?? "");
  return length ? Number(length[1]) : Number.NaN;
}

/**
 * What the control pane takes out of the room beside the build menu: its own width plus the
 * margin beside it.
 */
export const CONTROL_PANE_TOTAL = sheetRem("paneTotal");

/** The bodies' side margin, each side: the slots are the box less these. */
export const BODY_SIDE_MARGIN = sheetRem("bodySideMargin");

/** The figures a row can state and sort by. */
export type AssetMenuMetric = "cost" | "upkeep" | "workers" | "capacity" | "lot" | "level" | "parking";

/** The catalog's height range: AssetMenuHeight's, generated into sharedContracts.generated.ts. */
export { ASSET_MENU_DEFAULT_HEIGHT, ASSET_MENU_MAX_HEIGHT, ASSET_MENU_MIN_HEIGHT };

/**
 * Clamp a dragged height to that range. Non-finite resolves to the default
 * rather than passing through: the value goes straight into an inline style,
 * and `height: NaNrem` leaves the catalog unsized rather than merely wrong.
 */
export function clampAssetMenuHeight(height: number): number {
  if (!Number.isFinite(height)) return ASSET_MENU_DEFAULT_HEIGHT;
  return Math.max(ASSET_MENU_MIN_HEIGHT, Math.min(ASSET_MENU_MAX_HEIGHT, height));
}

/**
 * The height a drag from `startY` to `currentY` should produce. The asset menu is
 * bottom-anchored with the handle on its top edge, so dragging up makes it
 * taller — the sign flip is why this is a function and not an addition.
 *
 * `pxPerRem` is measured when the drag starts: the game scales rem with the
 * resolution, so a fixed ratio moves the edge faster or slower than the cursor
 * on every screen but one.
 */
export function draggedAssetMenuHeight(
  startHeight: number,
  startY: number,
  currentY: number,
  pxPerRem?: number
): number {
  return clampAssetMenuHeight(startHeight + dragDistanceRem(currentY, startY, pxPerRem));
}

/**
 * How far a drag has gone, in rem, from `fromPx` to `toPx`: zero when either
 * is not a number, and measured at `pxPerRem` or, for a drag whose measurement
 * failed, the 720p ratio.
 */
export function dragDistanceRem(fromPx: number, toPx: number, pxPerRem?: number): number {
  const delta = Number.isFinite(fromPx) && Number.isFinite(toPx) ? toPx - fromPx : 0;
  const scale = pxPerRem !== undefined && Number.isFinite(pxPerRem) && pxPerRem > 0 ? pxPerRem : REM_IN_PX_AT_720P;
  return delta / scale;
}

/**
 * Pixels per rem at 1280x720, where the UI's 1920-wide design is drawn at 2/3.
 * Only the fallback for a drag whose measurement failed.
 */
export const REM_IN_PX_AT_720P = 2 / 3;

/**
 * Whether a press starts a drag: the left button only, as the game's own drags
 * have it. A press that names no button counts as the left.
 */
export function isPrimaryPress(event: { button?: number } | null | undefined): boolean {
  return event?.button === undefined || event.button === 0;
}

/** The resize strip's height, which a drag measures rem against. */
export const ASSET_MENU_RESIZE_HANDLE_HEIGHT = sheetRem("handleHeight");

/**
 * Pixels per rem from an element of known rem length as drawn, its height or its
 * width, or undefined when the rect is not a real measurement. Measured on
 * something already laid out: Cohtml answers a rect asked for before layout with
 * zeroes.
 */
export function pxPerRemFrom(lengthPx: number | null | undefined, lengthRem: number): number | undefined {
  if (typeof lengthPx !== "number" || !Number.isFinite(lengthPx) || lengthPx <= 0 || !(lengthRem > 0)) {
    return undefined;
  }

  return lengthPx / lengthRem;
}

/**
 * Vanilla's tool-side column at the game's own text size, which the box starts
 * beside. It grows by half the text scale's increase: see widthSteps.ts.
 */
export const VANILLA_TOOL_COLUMN_WIDTH = 380;

/** The width strip's width, which a width drag measures rem against. */
export const ASSET_MENU_WIDTH_HANDLE_WIDTH = sheetRem("widthHandleWidth");

/** The strip's grab area across the gap beside the pane, which a press there measures against. */
export const ASSET_MENU_WIDTH_HANDLE_REACH = sheetRem("widthHandleReach");

/** The tab row's band under the list: the gap, the row and the pad above the bar. */
export const TAB_ROW_BAND = sheetRem("tabRowBand");

/** The tab row's own numbers, which its sheet draws and its plan budgets: see _assetMenuGeometry.scss. */
export const TAB_ROW_HEIGHT = sheetRem("tabRowHeight");
export const TAB_ROW_INSET = sheetRem("tabRowInset");
export const TAB_ROW_INSET_RIGHT = sheetRem("tabRowInsetRight");
export const TAB_CELL_MIN_WIDTH = sheetRem("tabCellMinWidth");
export const TAB_CELL_PADDING = sheetRem("tabCellPadding");
export const TAB_CELL_GAP = sheetRem("tabCellGap");
export const TAB_COUNT_SIZE = sheetRem("tabCountSize");
export const TAB_NAME_SIZE = sheetRem("tabNameSize");
export const TAB_NAME_GAP = sheetRem("tabNameGap");
export const TAB_SEGMENT_MARGIN = sheetRem("tabSegmentMargin");

/** The box less its body in every look, so the box is the stored height and this: see _assetMenuGeometry.scss. */
export const ASSET_MENU_BOX_CHROME = sheetRem("boxChrome");

/** What the box draws above its body: the top row's band. */
export const TOP_CHROME_HEIGHT = sheetRem("topBand");

/** The top edge's strip, which a height drag measures rem against. */
export const TOP_EDGE_HEIGHT = sheetRem("topEdgeHeight");

/** The top row's numbers, which its sheet draws and its plan budgets: see _assetMenuGeometry.scss. */
export const TOP_ROW_INSET = sheetRem("topRowInset");
export const FIELD_PADDING = sheetRem("fieldPadding");
export const FIELD_GAP = sheetRem("fieldGap");
export const FIELD_GLYPH = sheetRem("fieldGlyph");
export const FIELD_CLEAR = sheetRem("fieldClear");
export const TOP_ROW_TEXT = sheetRem("topRowText");
export const CLOSE_SIZE = sheetRem("closeSize");
export const CLOSE_GAP = sheetRem("closeGap");

/** The field's floor, which the controls fold to keep: a budget, never a CSS min-width. */
export const FIELD_MIN_WIDTH = sheetRem("fieldMinWidth");

/** The controls strip's numbers, which its sheet draws and its plan budgets: see _assetMenuGeometry.scss. */
export const CONTROLS_GAP = sheetRem("controlsGap");
export const CONTROL_PADDING = sheetRem("controlPadding");
export const CONTROL_PADDING_FOLDED = sheetRem("controlPaddingFolded");
export const CONTROL_WORD_GAP = sheetRem("controlWordGap");
export const CONTROL_GLYPH = sheetRem("controlGlyph");
export const CONTROL_CARET = sheetRem("controlCaret");
export const CONTROL_CARET_GAP = sheetRem("controlCaretGap");
export const CONTROL_DIVIDER = sheetRem("controlDivider");

/** A popover's width, and its gap above the box. */
export const POPOVER_WIDTH = sheetRem("popoverWidth");
export const POPOVER_GAP = sheetRem("popoverGap");

/** The room a popover's rows take: its width inside its padding. */
export const POPOVER_ROOM = POPOVER_WIDTH - 2 * sheetRem("popoverPadding");

/** A list row's padding each side, and the gap before its note: pickerList.module.scss draws them. */
export const PICKER_ROW_PADDING = sheetRem("pickerRowPadding");
export const PICKER_NOTE_GAP = sheetRem("pickerNoteGap");

/** FILTER's height, which its list scrolls past: the tallest a popover draws, so the room one needs. */
export const POPOVER_FILTER_HEIGHT = sheetRem("popoverFilterHeight");

/** The notch's width across its top, which it centres on the lit bar button: see _assetMenuGeometry.scss. */
export const NOTCH_TOP_WIDTH = sheetRem("notchTop");

/**
 * The box's bottom edge on the layout's 1080-tall frame, where vanilla's own menu ends above the
 * toolbar. The UI reads only the game's slot's left edge, so the frame above this edge stands for its bottom.
 */
export const BOX_BOTTOM = 954;

/**
 * The band along the screen's top that the game's HUD holds, with a margin: no popover opens into
 * it, and the box stops short of it. An estimate of the HUD's height, still to be measured in game.
 */
export const TOP_HUD_ALLOWANCE = 60;

/** The box's height: the stored body height and the chrome, the same in every look. */
export function assetMenuBoxHeight(storedHeight: number): number {
  return clampAssetMenuHeight(storedHeight) + ASSET_MENU_BOX_CHROME;
}

/**
 * The box's height as drawn: its height, stopped at the room between its bottom edge and the top
 * HUD's band, so a tall stored height never puts the top row under the HUD.
 */
export function drawnBoxHeight(storedHeight: number): number {
  return Math.min(assetMenuBoxHeight(storedHeight), BOX_BOTTOM - TOP_HUD_ALLOWANCE);
}

/**
 * The body's height as drawn: the drawn box less the chrome it draws, never below the drag's floor.
 * The stored height keeps its meaning for the drag, the settings and the upgrades panel's cap. See
 * docs/design-notes.md, "The box's height".
 */
export function drawnBodyHeight(storedHeight: number): number {
  return Math.max(ASSET_MENU_MIN_HEIGHT, drawnBoxHeight(storedHeight) - TOP_CHROME_HEIGHT - TAB_ROW_BAND);
}
