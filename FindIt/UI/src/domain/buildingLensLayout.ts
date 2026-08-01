/**
 * Geometry shared by the Building Lens resize affordance and its contract
 * tests. Values are in the same rem-like units as the FindIt panel binding.
 */
export const BUILDING_LENS_PANEL_CHROME_WIDTH = 35;
export const BUILDING_LENS_MIN_WIDTH = 700 + BUILDING_LENS_PANEL_CHROME_WIDTH;
export const BUILDING_LENS_MAX_WIDTH = 1200 + BUILDING_LENS_PANEL_CHROME_WIDTH;

export type BuildingLensDensityTier = "compact" | "default" | "expanded";
export type BuildingLensMetric = "cost" | "upkeep" | "workers" | "capacity" | "lot" | "level" | "parking";

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

/** Return a compact header label while keeping localized full labels available to callers. */
export function getBuildingLensMetricLabel(
  metric: BuildingLensMetric,
  tier: BuildingLensDensityTier,
  fullLabel: string,
): string {
  return tier === "compact" ? compactMetricLabels[metric] : fullLabel;
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
