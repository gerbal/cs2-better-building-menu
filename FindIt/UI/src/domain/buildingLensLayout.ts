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

/** Sections that name no scope, and so have nothing keeping the catalog short. */
const UNSCOPED_SECTIONS = new Set(["AllBuildings", "Favorites"]);

export interface BuildingLensHeightState {
  /** The player's own choice, owned by the backend as IsExpanded. */
  isExpanded: boolean;
  /** BuildingLensSection — which bank of the lens is showing. */
  section: string | undefined;
  /** The live search text, if any. */
  searchText: string | undefined;
}

/**
 * True when the lens is showing a set that no category narrows — a search, or
 * one of the unscoped sections.
 *
 * The lens rests as a strip to match vanilla's footprint, which is right while
 * a category bounds the list. An unbounded set has no such bound, so the strip
 * would hide nearly all of it; this raises the floor in that case.
 */
export function isBuildingLensUnscoped(
  { section, searchText }: Pick<BuildingLensHeightState, "section" | "searchText">,
): boolean {
  return (searchText ?? "").trim().length > 0 || UNSCOPED_SECTIONS.has(section ?? "");
}

/**
 * Whether the catalog is drawn tall — the player's choice and the automatic
 * floor together.
 *
 * The panel and the control plane both need this answer and they sit in
 * different React subtrees, so deriving it twice is how the pane would come to
 * report "strip" over a panel that is plainly tall.
 */
export function isBuildingLensExpanded(state: BuildingLensHeightState): boolean {
  return state.isExpanded || isBuildingLensUnscoped(state);
}

/**
 * Whether the player's expand control can change anything right now.
 *
 * While the set is unscoped the floor holds the catalog tall whatever the
 * stored choice is, so the control moves and nothing happens — in either
 * direction. Callers disable it and say why instead.
 */
export function canToggleBuildingLensHeight(
  state: Pick<BuildingLensHeightState, "section" | "searchText">,
): boolean {
  return !isBuildingLensUnscoped(state);
}
