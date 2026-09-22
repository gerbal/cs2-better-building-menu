import { fontSizeRatio } from "./textScale";

/**
 * Geometry shared by the Building Lens resize affordance and its contract
 * tests. Values are in the same rem-like units as the panel binding.
 */
export const BUILDING_LENS_PANEL_CHROME_WIDTH = 35;
export const BUILDING_LENS_MIN_WIDTH = 700 + BUILDING_LENS_PANEL_CHROME_WIDTH;
/**
 * The drag ceiling, and the twin of BuildingLensWidth.Max in C# — a test asserts
 * the two agree. Stated as the band total less the chrome, the way the C# side
 * derives it, so the two read as one number rather than two near guesses.
 */
export const BUILDING_LENS_BAND_WIDTH = 1476;
export const BUILDING_LENS_MAX_WIDTH = BUILDING_LENS_BAND_WIDTH - BUILDING_LENS_PANEL_CHROME_WIDTH;
export const BUILDING_LENS_TITLE_ICON = "coui://betterbuildingmenu/Icons/Colored/BuildingZoneSignature.svg";
export const BUILDING_LENS_TITLE_GAP = 6;
// The lens shell is bottom-aligned above the native toolbar. Reserve space
// for that toolbar, the shell chrome, and a small top/bottom safety margin so
// the catalog cannot push the shell's title/search bar outside a short view.
export const BUILDING_LENS_VIEWPORT_RESERVE = 210;
export const BUILDING_LENS_MIN_CATALOG_HEIGHT = 320;
export const BUILDING_LENS_REFERENCE_HEIGHT = 1080;

export type BuildingLensDensityTier = "compact" | "default" | "expanded";
export type BuildingLensMetric = "cost" | "upkeep" | "workers" | "capacity" | "lot" | "level" | "parking";

export interface BuildingLensRowGeometry {
  rowHeight: number;
  selectorHeight: number;
  identityHeight: number;
  selectorVerticalPadding: number;
}

const rowGeometryByTier: Record<BuildingLensDensityTier, BuildingLensRowGeometry> = {
  compact: { rowHeight: 84, selectorHeight: 80, identityHeight: 72, selectorVerticalPadding: 2 },
  default: { rowHeight: 92, selectorHeight: 88, identityHeight: 72, selectorVerticalPadding: 2 },
  expanded: { rowHeight: 92, selectorHeight: 88, identityHeight: 72, selectorVerticalPadding: 2 },
};

const compactMetricLabels: Record<BuildingLensMetric, string> = {
  cost: "Cost",
  upkeep: "Upk",
  workers: "Wkr",
  capacity: "Cap",
  lot: "Lot",
  level: "Lvl",
  parking: "Park",
};

/** Map the existing outer panel width to the deterministic visual density tier. */
export function getBuildingLensDensity(outerWidth: number): BuildingLensDensityTier {
  if (outerWidth < 800) return "compact";
  if (outerWidth < 1000) return "default";
  return "expanded";
}

export function getBuildingLensRowGeometry(tier: BuildingLensDensityTier): BuildingLensRowGeometry {
  return rowGeometryByTier[tier];
}

/** Return a compact header label while keeping localized full labels available to callers. */
export function getBuildingLensMetricLabel(
  metric: BuildingLensMetric,
  tier: BuildingLensDensityTier,
  fullLabel: string,
): string {
  return tier === "compact" ? compactMetricLabels[metric] : fullLabel;
}

/** Keep compact panels dense while restoring readable metric text at normal widths. */
export function getBuildingLensMetricTextScale(tier: BuildingLensDensityTier): "compact" | "readable" {
  return tier === "compact" ? "compact" : "readable";
}

/**
 * What each metric column costs at a comfortable width: the widest content each
 * one draws plus the right gutter the numeric columns carry, sized so nothing
 * clips.
 */
export const BUILDING_LENS_COLUMN_MAX: Record<BuildingLensMetric, number> = {
  cost: 100,
  // The widest figure here is a road's per-kilometre-per-month cost, in the
  // game's own template, and it does not scale with the panel. The minimum
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
export const BUILDING_LENS_COLUMN_MIN: Record<BuildingLensMetric, number> = {
  cost: 76,
  // Holds the per-kilometre-per-month figure at any panel width — see above.
  upkeep: 116,
  workers: 48,
  capacity: 88,
  lot: 68,
  level: 38,
  parking: 44,
};

/**
 * What the identity column is expected to keep at the narrowest panel. A budget,
 * not a CSS min-width: in Cohtml a min-width on a flex item disables its
 * flex-grow, so this floor has to be left over by the column minima instead.
 */
export const BUILDING_LENS_IDENTITY_MIN = 180;

/**
 * Everything in a table row that is not the name, in rem: the trailing reserve,
 * the rows' scrollbar, the select padding and the thumbnail with its margin.
 * buildingCatalog.module.scss is the authority, and this has to follow it.
 */
export const BUILDING_LENS_TABLE_ROW_FURNITURE = 37 + 16 + 8 + 80;

/**
 * What the control pane takes out of the assembly: its own width plus the margin
 * beside it. Here because both the surface and the table subtract it from the
 * width binding, which measures the whole assembly and not the panel.
 */
export const BUILDING_LENS_CONTROL_PANE_TOTAL = 385;

/**
 * What the table's panel spends around its rows: the row viewport's scrollbar,
 * the rows' own padding and the panel's inner margins — the gap between the
 * panel's width and a row's.
 */
export const BUILDING_LENS_TABLE_CHROME = 30;

/**
 * The name column's basis: the room a row keeps for it before the metric
 * columns take theirs, and what it must keep as the panel narrows.
 */
export const BUILDING_LENS_TABLE_NAME_BASIS = 260;

/**
 * The room the metric columns really have: the assembly less the control pane,
 * the panel's chrome, the row's furniture and the name's basis. Never negative
 * — a narrow panel runs the arithmetic out and the columns sit at their minima.
 */
export function tableColumnRoom(outerWidth: number): number {
  const room = outerWidth
    - BUILDING_LENS_PANEL_CHROME_WIDTH
    - BUILDING_LENS_CONTROL_PANE_TOTAL
    - BUILDING_LENS_TABLE_CHROME
    - BUILDING_LENS_TABLE_ROW_FURNITURE
    - BUILDING_LENS_TABLE_NAME_BASIS;
  return Math.max(room, 0);
}

export type BuildingLensColumnWidths = Record<BuildingLensMetric, number>;

const sumWidths = (widths: BuildingLensColumnWidths): number =>
  Object.values(widths).reduce((total, width) => total + width, 0);

/**
 * The seven metric column widths, moving between minimum and comfortable by the
 * ROOM beside the name — every metric cell is flex: 0 0 auto and the name is
 * the only item that yields. The figures scale, so the room is read unscaled.
 */
export function getBuildingLensColumnWidths(outerWidth: number, textScale = 1): BuildingLensColumnWidths {
  const width = Number.isFinite(outerWidth) ? outerWidth : BUILDING_LENS_MIN_WIDTH;
  const textRatio = fontSizeRatio("s", textScale);
  const room = tableColumnRoom(width);

  // How far along from the minimum set to the comfortable set the room
  // reaches, read in unscaled units since the figures grow with the text.
  const minTotal = sumWidths(BUILDING_LENS_COLUMN_MIN);
  const span = sumWidths(BUILDING_LENS_COLUMN_MAX) - minTotal;
  // A degenerate range would divide by zero; every column simply gets its
  // comfortable width, which is what a single supported set deserves.
  const share = span <= 0
    ? 1
    : Math.max(0, Math.min(1, (room / textRatio - minTotal) / span));

  const base = {} as BuildingLensColumnWidths;
  for (const metric of Object.keys(BUILDING_LENS_COLUMN_MAX) as BuildingLensMetric[]) {
    const min = BUILDING_LENS_COLUMN_MIN[metric];
    const max = BUILDING_LENS_COLUMN_MAX[metric];
    base[metric] = min + (max - min) * share;
  }

  // The figures grow with the text scale as far as the room allows and no
  // further: a set already at its minima cannot also grow. What does not fit
  // clips inside its cell, which beats squeezing the name away.
  const baseTotal = sumWidths(base);
  const grow = room > 0 && baseTotal > 0
    ? Math.min(textRatio, Math.max(1, room / baseTotal))
    : 1;

  const widths = {} as BuildingLensColumnWidths;
  for (const metric of Object.keys(base) as BuildingLensMetric[]) {
    // Whole units: a fractional width lands on a different pixel in the header
    // than in the rows, and the columns stop lining up.
    widths[metric] = Math.round(base[metric] * grow);
  }

  return widths;
}

/**
 * A deterministic max height for the catalog's bounded row viewport, because
 * Gameface's viewport units are not reliable across the game's render targets.
 * A constant in practice; the parameter keeps the arithmetic testable.
 */
export function getBuildingLensCatalogMaxHeight(viewportHeight: number): number {
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 720;
  const physicalHeight = Math.max(BUILDING_LENS_MIN_CATALOG_HEIGHT, safeViewportHeight - BUILDING_LENS_VIEWPORT_RESERVE);
  return Math.floor((physicalHeight * BUILDING_LENS_REFERENCE_HEIGHT) / safeViewportHeight);
}

export type BuildingLensAlignment = "Left" | "Center" | "Right" | string;

/**
 * The catalog's height range, twin of BuildingLensHeight in C# — a test asserts
 * they agree. Min is one row of cards under two headings, the deepest grouping
 * a menu draws (catalog padding, two heading reserves, list padding, one
 * card); Max the viewport less the chrome below the panel; between them the
 * height is the player's to drag.
 */
export const BUILDING_LENS_MIN_HEIGHT = 108;
export const BUILDING_LENS_MAX_HEIGHT = 960;
export const BUILDING_LENS_DEFAULT_HEIGHT = 420;

/**
 * Clamp a dragged height. Non-finite resolves to the default rather than
 * passing through: the value goes straight into an inline style, and
 * `height: NaNrem` leaves the catalog unsized rather than merely wrong.
 */
export function clampBuildingLensHeight(height: number): number {
  if (!Number.isFinite(height)) return BUILDING_LENS_DEFAULT_HEIGHT;
  return Math.max(BUILDING_LENS_MIN_HEIGHT, Math.min(BUILDING_LENS_MAX_HEIGHT, height));
}

/**
 * The height a drag from `startY` to `currentY` should produce. The panel is
 * bottom-anchored with the handle on its top edge, so dragging up makes it
 * taller — the sign flip is why this is a function and not an addition.
 *
 * `pxPerRem` is measured when the drag starts: the game scales rem with the
 * resolution, so a fixed ratio moves the edge faster or slower than the cursor
 * on every screen but one.
 */
export function draggedBuildingLensHeight(
  startHeight: number,
  startY: number,
  currentY: number,
  pxPerRem?: number
): number {
  const delta = Number.isFinite(startY) && Number.isFinite(currentY) ? startY - currentY : 0;
  const scale = pxPerRem !== undefined && Number.isFinite(pxPerRem) && pxPerRem > 0 ? pxPerRem : REM_IN_PX_AT_720P;
  return clampBuildingLensHeight(startHeight + delta / scale);
}

/**
 * Pixels per rem at 1280x720, where the UI's 1920-wide design is drawn at 2/3.
 * Only the fallback for a drag whose measurement failed.
 */
export const REM_IN_PX_AT_720P = 2 / 3;
