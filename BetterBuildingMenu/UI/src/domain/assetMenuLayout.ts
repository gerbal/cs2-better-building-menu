import { fontSizeRatio } from "./textScale";
import sizes from "./assetMenuLayout.module.scss";
import {
  ASSET_MENU_CATALOG_FILL,
  ASSET_MENU_CATALOG_FILL_SNAP,
  ASSET_MENU_CATALOG_MIN_WIDTH,
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
 * Geometry shared by the asset menu resize affordance and its contract
 * tests. Values are in the same rem-like units as the width binding.
 */
export const ASSET_MENU_CHROME_WIDTH = 35;
export const ASSET_MENU_MIN_WIDTH = 700 + ASSET_MENU_CHROME_WIDTH;
// The asset menu shell is bottom-aligned above the native toolbar. Reserve space
// for that toolbar, the shell chrome, and a small top/bottom safety margin so
// the catalog cannot push the shell's title/search bar outside a short view.
export const ASSET_MENU_VIEWPORT_RESERVE = 210;
export const ASSET_MENU_MIN_CATALOG_HEIGHT = 320;
export const ASSET_MENU_REFERENCE_HEIGHT = 1080;

export type AssetMenuDensityTier = "compact" | "default" | "expanded";
export type AssetMenuMetric = "cost" | "upkeep" | "workers" | "capacity" | "lot" | "level" | "parking";

export interface AssetMenuRowGeometry {
  rowHeight: number;
  selectorHeight: number;
  identityHeight: number;
  selectorVerticalPadding: number;
}

const rowGeometryByTier: Record<AssetMenuDensityTier, AssetMenuRowGeometry> = {
  compact: { rowHeight: 84, selectorHeight: 80, identityHeight: 72, selectorVerticalPadding: 2 },
  default: { rowHeight: 92, selectorHeight: 88, identityHeight: 72, selectorVerticalPadding: 2 },
  expanded: { rowHeight: 92, selectorHeight: 88, identityHeight: 72, selectorVerticalPadding: 2 },
};

const compactMetricLabels: Record<AssetMenuMetric, string> = {
  cost: "Cost",
  upkeep: "Upk",
  workers: "Wkr",
  capacity: "Cap",
  lot: "Lot",
  level: "Lvl",
  parking: "Park",
};

/** Map the assembly's outer width to the deterministic visual density tier. */
export function getAssetMenuDensity(outerWidth: number): AssetMenuDensityTier {
  if (outerWidth < 800) return "compact";
  if (outerWidth < 1000) return "default";
  return "expanded";
}

export function getAssetMenuRowGeometry(tier: AssetMenuDensityTier): AssetMenuRowGeometry {
  return rowGeometryByTier[tier];
}

/** Return a compact header label while keeping localized full labels available to callers. */
export function getAssetMenuMetricLabel(
  metric: AssetMenuMetric,
  tier: AssetMenuDensityTier,
  fullLabel: string,
): string {
  return tier === "compact" ? compactMetricLabels[metric] : fullLabel;
}

/** Keep compact panels dense while restoring readable metric text at normal widths. */
export function getAssetMenuMetricTextScale(tier: AssetMenuDensityTier): "compact" | "readable" {
  return tier === "compact" ? "compact" : "readable";
}

/**
 * What each metric column costs at a comfortable width: the widest content each
 * one draws plus the right gutter the numeric columns carry, sized so nothing
 * clips.
 */
export const ASSET_MENU_COLUMN_MAX: Record<AssetMenuMetric, number> = {
  cost: 100,
  // The widest figure here is a road's per-kilometre-per-month cost, in the
  // game's own template, and it does not scale with the build menu. The minimum
  // below holds the same figure for the same reason.
  upkeep: 116,
  workers: 62,
  capacity: 122,
  lot: 88,
  level: 46,
  parking: 52,
};

/**
 * What each column may be squeezed to before the name gives up any more. These
 * clip the rare widest value and fit the common one, and never fall below what
 * a two-digit figure and its gutter need.
 */
export const ASSET_MENU_COLUMN_MIN: Record<AssetMenuMetric, number> = {
  cost: 76,
  // Holds the per-kilometre-per-month figure at any width — see above.
  upkeep: 116,
  workers: 48,
  capacity: 88,
  lot: 68,
  level: 38,
  parking: 44,
};

/**
 * What the identity column is expected to keep at the narrowest build menu. A budget,
 * not a CSS min-width: in Cohtml a min-width on a flex item disables its
 * flex-grow, so this floor has to be left over by the column minima instead.
 */
export const ASSET_MENU_IDENTITY_MIN = 180;

/**
 * Everything in a table row that is not the name, in rem: the trailing reserve,
 * the rows' scrollbar, the select padding and the thumbnail with its margin.
 */
export const ASSET_MENU_TABLE_ROW_FURNITURE = sheetRem("tableRowFurniture");

/**
 * What the control pane takes out of the assembly: its own width plus the margin
 * beside it. Here because both the asset menu and the table subtract it from the
 * width binding, which measures the whole assembly and not the build menu.
 */
export const CONTROL_PANE_TOTAL = sheetRem("paneTotal");

/**
 * What the build menu spends around the table's rows: the row viewport's
 * scrollbar, the rows' own padding and the build menu's inner margins — the gap
 * between the build menu's width and a row's.
 */
export const ASSET_MENU_TABLE_CHROME = 30;

/**
 * The name column's basis: the room a row keeps for it before the metric
 * columns take theirs, and what it must keep as the build menu narrows.
 */
export const ASSET_MENU_TABLE_NAME_BASIS = 260;

/**
 * The room the metric columns really have: the assembly less the control pane,
 * the build menu's chrome, the row's furniture and the name's basis. Never negative
 * — a narrow build menu runs the arithmetic out and the columns sit at their minima.
 */
export function tableColumnRoom(outerWidth: number): number {
  const room = outerWidth
    - ASSET_MENU_CHROME_WIDTH
    - CONTROL_PANE_TOTAL
    - ASSET_MENU_TABLE_CHROME
    - ASSET_MENU_TABLE_ROW_FURNITURE
    - ASSET_MENU_TABLE_NAME_BASIS;
  return Math.max(room, 0);
}

/** The widths of the metric columns the table draws; a column it drops has none. */
export type AssetMenuColumnWidths = Partial<Record<AssetMenuMetric, number>>;

const sumWidths = (widths: AssetMenuColumnWidths): number =>
  Object.values(widths).reduce<number>((total, width) => total + (width ?? 0), 0);

/** The metric columns, in the order the table draws them. */
export const ASSET_MENU_TABLE_METRICS: readonly AssetMenuMetric[] = [
  "cost", "upkeep", "workers", "capacity", "lot", "level", "parking",
];

/** The order the table gives its columns up when the build menu is too narrow for all of them: the least asked-for first. */
export const ASSET_MENU_COLUMN_DROP_ORDER: readonly AssetMenuMetric[] = [
  "parking", "level", "lot", "workers", "capacity", "upkeep", "cost",
];

/**
 * The metric columns the table draws at this width: as many as fit beside the
 * name at their comfortable widths, grown by the text scale, so a figure is
 * never clipped. A narrow build menu drops the least asked-for first; the column
 * the table is sorted by always stays, and so does at least one.
 *
 * Not the column minima: the table was only ever drawn at the comfortable set
 * before the width could change, and at the minima a network's per-km cost
 * ("¢3,500 /km") clips in every row.
 */
export function visibleTableMetrics(
  outerWidth: number,
  textScale = 1,
  sorted: AssetMenuMetric | null = null
): AssetMenuMetric[] {
  const room = tableColumnRoom(Number.isFinite(outerWidth) ? outerWidth : ASSET_MENU_MIN_WIDTH);
  const textRatio = fontSizeRatio("s", textScale);
  const kept = new Set<AssetMenuMetric>(ASSET_MENU_TABLE_METRICS);
  const needs = () => [...kept].reduce((total, metric) => total + ASSET_MENU_COLUMN_MAX[metric], 0) * textRatio;

  for (const metric of ASSET_MENU_COLUMN_DROP_ORDER) {
    if (needs() <= room || kept.size === 1) break;
    if (metric !== sorted) kept.delete(metric);
  }

  return ASSET_MENU_TABLE_METRICS.filter((metric) => kept.has(metric));
}

/**
 * The metric column widths, moving between minimum and comfortable by the ROOM
 * beside the name — every metric cell is flex: 0 0 auto and the name is the
 * only item that yields. The figures scale, so the room is read unscaled. Only
 * the columns given are sized: the ones the table draws (visibleTableMetrics).
 */
export function getAssetMenuColumnWidths(
  outerWidth: number,
  textScale = 1,
  metrics: readonly AssetMenuMetric[] = ASSET_MENU_TABLE_METRICS
): AssetMenuColumnWidths {
  const width = Number.isFinite(outerWidth) ? outerWidth : ASSET_MENU_MIN_WIDTH;
  const textRatio = fontSizeRatio("s", textScale);
  const room = tableColumnRoom(width);

  // How far along from the minimum set to the comfortable set the room
  // reaches, read in unscaled units since the figures grow with the text.
  const minTotal = metrics.reduce((total, metric) => total + ASSET_MENU_COLUMN_MIN[metric], 0);
  const span = metrics.reduce((total, metric) => total + ASSET_MENU_COLUMN_MAX[metric], 0) - minTotal;
  // A degenerate range would divide by zero; every column simply gets its
  // comfortable width, which is what a single supported set deserves.
  const share = span <= 0
    ? 1
    : Math.max(0, Math.min(1, (room / textRatio - minTotal) / span));

  const base: AssetMenuColumnWidths = {};
  for (const metric of metrics) {
    const min = ASSET_MENU_COLUMN_MIN[metric];
    const max = ASSET_MENU_COLUMN_MAX[metric];
    base[metric] = min + (max - min) * share;
  }

  // The figures grow with the text scale as far as the room allows and no
  // further: a set already at its minima cannot also grow. What does not fit
  // clips inside its cell, which beats squeezing the name away.
  const baseTotal = sumWidths(base);
  const grow = room > 0 && baseTotal > 0
    ? Math.min(textRatio, Math.max(1, room / baseTotal))
    : 1;

  const widths: AssetMenuColumnWidths = {};
  for (const metric of metrics) {
    // Whole units: a fractional width lands on a different pixel in the header
    // than in the rows, and the columns stop lining up.
    widths[metric] = Math.round((base[metric] ?? 0) * grow);
  }

  return widths;
}

/**
 * A deterministic max height for the catalog's bounded row viewport, because
 * Gameface's viewport units are not reliable across the game's render targets.
 * A constant in practice; the parameter keeps the arithmetic testable.
 */
export function getAssetMenuCatalogMaxHeight(viewportHeight: number): number {
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 720;
  const physicalHeight = Math.max(ASSET_MENU_MIN_CATALOG_HEIGHT, safeViewportHeight - ASSET_MENU_VIEWPORT_RESERVE);
  return Math.floor((physicalHeight * ASSET_MENU_REFERENCE_HEIGHT) / safeViewportHeight);
}

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
  const delta = Number.isFinite(startY) && Number.isFinite(currentY) ? startY - currentY : 0;
  const scale = pxPerRem !== undefined && Number.isFinite(pxPerRem) && pxPerRem > 0 ? pxPerRem : REM_IN_PX_AT_720P;
  return clampAssetMenuHeight(startHeight + delta / scale);
}

/**
 * Pixels per rem at 1280x720, where the UI's 1920-wide design is drawn at 2/3.
 * Only the fallback for a drag whose measurement failed.
 */
export const REM_IN_PX_AT_720P = 2 / 3;

/** The resize strip's height, which a drag measures rem against. */
export const ASSET_MENU_RESIZE_HANDLE_HEIGHT = sheetRem("handleHeight");

/**
 * Pixels per rem from an element of known rem height as drawn, or undefined when
 * the rect is not a real measurement. Measured on something already laid out:
 * Cohtml answers a rect asked for before layout with zeroes.
 */
export function pxPerRemFrom(heightPx: number | null | undefined, heightRem: number): number | undefined {
  if (typeof heightPx !== "number" || !Number.isFinite(heightPx) || heightPx <= 0 || !(heightRem > 0)) {
    return undefined;
  }

  return heightPx / heightRem;
}

/** The build menu's width range and its fill value: AssetMenuCatalogWidth's, generated. */
export { ASSET_MENU_CATALOG_FILL, ASSET_MENU_CATALOG_FILL_SNAP, ASSET_MENU_CATALOG_MIN_WIDTH };

/** The width strip's width, which a width drag measures rem against. */
export const ASSET_MENU_WIDTH_HANDLE_WIDTH = sheetRem("widthHandleWidth");

/**
 * The room the build menu has: the band, less the control pane while it is
 * shown. Without the pane, less half the width strip instead: the strip is
 * centred on the menu's edge, and its outer half would otherwise reach past the
 * band over the social icons beside it.
 */
export function catalogRoom(bandWidth: number, paneShown: boolean): number {
  return paneShown ? bandWidth - CONTROL_PANE_TOTAL : bandWidth - ASSET_MENU_WIDTH_HANDLE_WIDTH / 2;
}

/**
 * The width the build menu draws at. Fill takes the room; a chosen width is held
 * at the minimum or above and at the room or below, so a width chosen with the
 * pane hidden draws narrower beside the pane and comes back when it goes.
 */
export function resolveCatalogWidth(
  chosen: number,
  bandWidth: number,
  paneShown: boolean
): number {
  const room = catalogRoom(bandWidth, paneShown);
  if (!Number.isFinite(chosen) || chosen <= ASSET_MENU_CATALOG_FILL) return room;
  return Math.min(room, Math.max(ASSET_MENU_CATALOG_MIN_WIDTH, chosen));
}

/**
 * The width a drag from `startX` to `currentX` asks for. The strip is on the right
 * edge, so moving right widens. Clamped here rather than resolved, because a drag
 * far to the left would otherwise reach zero, which reads as fill.
 */
export function draggedCatalogWidth(
  startWidth: number,
  startX: number,
  currentX: number,
  bandWidth: number,
  paneShown: boolean,
  pxPerRem?: number
): number {
  const delta = Number.isFinite(startX) && Number.isFinite(currentX) ? currentX - startX : 0;
  const scale = pxPerRem !== undefined && Number.isFinite(pxPerRem) && pxPerRem > 0 ? pxPerRem : REM_IN_PX_AT_720P;
  const raw = startWidth + delta / scale;
  if (!Number.isFinite(raw)) return startWidth;
  return Math.min(catalogRoom(bandWidth, paneShown), Math.max(ASSET_MENU_CATALOG_MIN_WIDTH, raw));
}

/** What a drag that ended at `width` stores: fill when it ended against the room, else the width. */
export function releasedCatalogWidth(width: number, bandWidth: number, paneShown: boolean): number {
  return width >= catalogRoom(bandWidth, paneShown) - ASSET_MENU_CATALOG_FILL_SNAP ? ASSET_MENU_CATALOG_FILL : width;
}

/**
 * The row's width: the build menu, and the pane beside it while shown. Sized to
 * what it holds, so no empty stretch of the row is left to take the mouse.
 */
export function assetMenuRowWidth(menuWidth: number, paneShown: boolean): number {
  return paneShown ? menuWidth + CONTROL_PANE_TOTAL : menuWidth;
}

/**
 * The width the catalog's table arithmetic takes. Its functions were tuned
 * against the whole row with the pane in it, and they subtract the pane
 * themselves, so they get the build menu plus the pane, whether or not the pane
 * is shown. At today's 1,091 that is the 1,476 they always had.
 */
export function catalogLayoutWidth(menuWidth: number): number {
  return menuWidth + CONTROL_PANE_TOTAL;
}
