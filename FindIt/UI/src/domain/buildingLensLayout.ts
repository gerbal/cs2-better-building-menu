/**
 * Geometry shared by the Building Lens resize affordance and its contract
 * tests. Values are in the same rem-like units as the FindIt panel binding.
 */
export const BUILDING_LENS_PANEL_CHROME_WIDTH = 35;
export const BUILDING_LENS_MIN_WIDTH = 700 + BUILDING_LENS_PANEL_CHROME_WIDTH;
export const BUILDING_LENS_MAX_WIDTH = 1200 + BUILDING_LENS_PANEL_CHROME_WIDTH;
export const BUILDING_LENS_TITLE_ICON = "coui://finditbuildingmenu/Icons/Colored/BuildingZoneSignature.svg";
export const BUILDING_LENS_TITLE_GAP = 6;
// The FindIt shell is bottom-aligned above the native toolbar. Reserve space
// for that toolbar, the FindIt chrome, and a small top/bottom safety margin so
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
 * What each metric column costs at a comfortable width.
 *
 * Measured content, not guesses: "5 600 000" in Cost, "225 000/mo" in Upkeep,
 * "15 000 students" in Capacity, plus the 8rem right gutter the numeric columns
 * carry. Sized so nothing clips — an earlier set of 54-58rem columns clipped 234
 * of 600 rendered cells.
 */
export const BUILDING_LENS_COLUMN_MAX: Record<BuildingLensMetric, number> = {
  cost: 100,
  upkeep: 108,
  workers: 62,
  capacity: 122,
  lot: 88,
  level: 46,
  parking: 52,
};

/**
 * What each column may be squeezed to before the name gives up any more.
 *
 * These clip the rare widest value and fit the common one, which is the trade
 * this whole function exists to make. Roughly three quarters of the comfortable
 * width, rounded to whole units, and never below what a two-digit figure and
 * its gutter need.
 */
export const BUILDING_LENS_COLUMN_MIN: Record<BuildingLensMetric, number> = {
  cost: 76,
  upkeep: 80,
  workers: 48,
  capacity: 88,
  lot: 68,
  level: 38,
  parking: 44,
};

/**
 * What the identity column is expected to keep at the narrowest panel.
 *
 * Not a CSS min-width — that was tried and it backfires. In Cohtml a min-width
 * on a flex item disables its flex-grow: measured on the live row, the identity
 * cell froze at exactly 120px with 112px of free space unclaimed beside it, and
 * setting min-width back to 0 grew it to 225px on the spot. So the floor cannot
 * be declared; it has to be left over.
 *
 * This is therefore a budget, and the column floors below are chosen so that
 * roughly this much survives at BUILDING_LENS_MIN_WIDTH. Measured after: the
 * name renders 77px at the narrowest panel, where it used to be ZERO — squeezed
 * out of existence while Capacity held 122 units to draw "—".
 */
export const BUILDING_LENS_IDENTITY_MIN = 180;

export type BuildingLensColumnWidths = Record<BuildingLensMetric, number>;

/**
 * Spend the panel's width on the name when it is scarce and on the numbers when
 * it is not.
 *
 * The metric columns are fixed-width by necessity — Gameface has no CSS grid and
 * no table column sizing, so the table is a stack of independent flex rows and
 * only identical fixed widths keep them in line. The identity column is the
 * flexible remainder, and that arrangement had one failure mode: because the
 * metric cells are `flex: 0 0 auto`, they never yield, so every unit the panel
 * lacks comes out of the name alone.
 *
 * So the columns interpolate: at the widest panel they get their comfortable
 * width, at the narrowest they get their floor, and the difference goes to the
 * name. This deliberately inverts the note on cm-kvf2 that narrowing should
 * "crowd the name rather than truncate a number" — measurement changed the
 * answer. A clipped "225 000/mo" is a number you can still get from the hover
 * card; a title of zero width is a row you cannot identify at all.
 */
export function getBuildingLensColumnWidths(outerWidth: number): BuildingLensColumnWidths {
  const width = Number.isFinite(outerWidth) ? outerWidth : BUILDING_LENS_MIN_WIDTH;
  const span = BUILDING_LENS_MAX_WIDTH - BUILDING_LENS_MIN_WIDTH;
  // A degenerate range would divide by zero; every column simply gets its
  // comfortable width, which is what a single supported panel size deserves.
  const ratio = span <= 0
    ? 1
    : Math.max(0, Math.min(1, (width - BUILDING_LENS_MIN_WIDTH) / span));

  const widths = {} as BuildingLensColumnWidths;

  for (const metric of Object.keys(BUILDING_LENS_COLUMN_MAX) as BuildingLensMetric[]) {
    const min = BUILDING_LENS_COLUMN_MIN[metric];
    const max = BUILDING_LENS_COLUMN_MAX[metric];
    // Whole units: a fractional width is a column that lands on a different
    // pixel in the header than in the rows, which is the alignment bug this
    // table has already been fixed for once.
    widths[metric] = Math.round(min + (max - min) * ratio);
  }

  return widths;
}

/**
 * Return a deterministic max height for the catalog's bounded row viewport.
 * Gameface's viewport-unit calculation is not reliable across the game's
 * render targets. Its rem-like panel units are normalized to a 1080px design
 * height, so convert the physical viewport budget into those units here.
 */
export function getBuildingLensCatalogMaxHeight(viewportHeight: number): number {
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 720;
  const physicalHeight = Math.max(BUILDING_LENS_MIN_CATALOG_HEIGHT, safeViewportHeight - BUILDING_LENS_VIEWPORT_RESERVE);
  return Math.floor((physicalHeight * BUILDING_LENS_REFERENCE_HEIGHT) / safeViewportHeight);
}

export type BuildingLensAlignment = "Left" | "Center" | "Right" | string;

export function clampBuildingLensWidth(width: number): number {
  if (!Number.isFinite(width)) return BUILDING_LENS_MIN_WIDTH;
  return Math.max(BUILDING_LENS_MIN_WIDTH, Math.min(BUILDING_LENS_MAX_WIDTH, width));
}

/**
 * Calculate the outer panel width for a pointer move. Center alignment moves
 * both edges, so the same pointer delta changes the width twice as much.
 * Right-aligned panels grow when the handle moves left; left/unknown
 * alignments grow when it moves right.
 */
export function resizedBuildingLensWidth(
  startWidth: number,
  startX: number,
  currentX: number,
  alignment: BuildingLensAlignment,
): number {
  const direction = alignment === "Right" ? -1 : alignment === "Center" ? 2 : 1;
  const delta = Number.isFinite(startX) && Number.isFinite(currentX) ? currentX - startX : 0;
  return clampBuildingLensWidth(startWidth + delta * direction);
}
