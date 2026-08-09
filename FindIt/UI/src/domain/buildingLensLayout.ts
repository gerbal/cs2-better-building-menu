/**
 * Geometry shared by the Building Lens resize affordance and its contract
 * tests. Values are in the same rem-like units as the FindIt panel binding.
 */
export const BUILDING_LENS_PANEL_CHROME_WIDTH = 35;
export const BUILDING_LENS_MIN_WIDTH = 700 + BUILDING_LENS_PANEL_CHROME_WIDTH;
/**
 * The drag ceiling, and the twin of BuildingLensWidth.Max in C# — a test
 * asserts the two agree.
 *
 * They did not, quietly: this was 1200 + chrome = 1235 against a C# Max of
 * 1232, so the last 3rem of any drag was clamped away on commit. Stating the
 * band total and subtracting the chrome, the way the C# side derives it, makes
 * the two readable as the same number instead of two guesses that nearly meet.
 */
export const BUILDING_LENS_BAND_WIDTH = 1476;
export const BUILDING_LENS_MAX_WIDTH = BUILDING_LENS_BAND_WIDTH - BUILDING_LENS_PANEL_CHROME_WIDTH;
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
 * Return a deterministic max height for the catalog's bounded row viewport.
 * Gameface's viewport-unit calculation is not reliable across the game's
 * render targets. Its rem-like panel units are normalized to a 1080px design
 * height, so convert the physical viewport budget into those units here.
 *
 * In practice this is a constant, and knowing that saves the next reader an
 * experiment: the cohtml layer renders at a FIXED 1280x720 logical viewport
 * and scales it to the window, so `window.innerHeight` is always 720 and the
 * only value this is ever called with is 720 — giving 765 every time.
 * Measured 2026-08-09 with the game window at 1920x1080 (confirmed in
 * Player.log): window.innerWidth/innerHeight still read 1280x720 and
 * Page.captureScreenshot still returned a 1280x720 image.
 *
 * The parameter stays because the arithmetic is the honest statement of what
 * the number means, and because it is what makes the function testable. But
 * nothing here adapts to a real resolution change, and no layout in this mod
 * needs to — 1rem is 0.6667px at every resolution, not just at 720p.
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

/**
 * The catalog's height range, twin of BuildingLensHeight in C# — a test asserts
 * they agree.
 *
 * Min is two tile rows plus padding; Max is the viewport (a fixed 1080rem) less
 * the chrome below the panel. Between them the height is the player's, set by
 * dragging the panel's top edge.
 */
export const BUILDING_LENS_MIN_HEIGHT = 200;
export const BUILDING_LENS_MAX_HEIGHT = 960;
export const BUILDING_LENS_DEFAULT_HEIGHT = 420;

/**
 * Clamp a dragged height.
 *
 * Non-finite resolves to the default rather than passing through: the value
 * goes straight into an inline style, and `height: NaNrem` leaves the catalog
 * unsized rather than merely wrong.
 */
export function clampBuildingLensHeight(height: number): number {
  if (!Number.isFinite(height)) return BUILDING_LENS_DEFAULT_HEIGHT;
  return Math.max(BUILDING_LENS_MIN_HEIGHT, Math.min(BUILDING_LENS_MAX_HEIGHT, height));
}

/**
 * The height a drag of `delta` pixels from `startHeight` should produce.
 *
 * The panel is bottom-anchored and the handle is on its top edge, so dragging
 * up (negative delta) makes it taller — the sign flip is the whole reason this
 * is a named function rather than an addition at the call site.
 */
export function draggedBuildingLensHeight(startHeight: number, startY: number, currentY: number): number {
  const delta = Number.isFinite(startY) && Number.isFinite(currentY) ? startY - currentY : 0;
  return clampBuildingLensHeight(startHeight + delta / REM_IN_PX);
}

/**
 * Pixels per rem in the game's UI layer, at every resolution — see
 * getBuildingLensCatalogMaxHeight for why this is not resolution-dependent.
 */
export const REM_IN_PX = 0.6667;
