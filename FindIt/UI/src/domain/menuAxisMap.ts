/**
 * Which identity dimension a toolbar menu's tab strip shows.
 *
 * Vanilla's own sub-tabs are adaptive in content but constant in relationship:
 * always the natural subdivision of the menu you just picked. Holding that
 * relationship constant is what makes an adaptive axis read as familiar rather
 * than arbitrary.
 */
export type AxisId = "section" | "subCategory" | "zoneFamily" | "buildingType" | "zone";

/** Dimensions that can be a tab axis: they name what a thing *is*. */
export const TAXONOMIC_AXIS_IDS: readonly AxisId[] = [
  "section",
  "subCategory",
  "zoneFamily",
  "buildingType",
  "zone",
];

/**
 * Dimensions that must never be a tab axis, however well they partition.
 *
 * A tab label's job is to predict what is behind it. "DLC" may split Healthcare
 * cleanly and is still a nonsense subdivision — nobody goes looking for the
 * Base Game hospitals.
 */
export const PROVENANCE_AXIS_IDS: readonly string[] = [
  "provenance",
  "dlc",
  "assetPack",
  "availability",
  "placement",
  "extension",
  "metrics",
];

export function isTaxonomicAxis(id: string): boolean {
  return (TAXONOMIC_AXIS_IDS as readonly string[]).includes(id);
}

const normalise = (value: string): string => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Keyed by the toolbar menu's tooltip, which is what ToolSurfaceBar already
 * reads off the game's own toolbar bindings.
 */
const AUTHORED: Record<string, AxisId> = {
  zones: "zoneFamily",
  electricity: "subCategory",
  water: "subCategory",
  healthcare: "subCategory",
  garbage: "subCategory",
  education: "subCategory",
  firesafety: "subCategory",
  police: "subCategory",
  transportation: "subCategory",
  parksandrecreation: "subCategory",
  communications: "subCategory",
};

export function authoredAxisFor(menuToolTip: string): AxisId | null {
  return AUTHORED[normalise(menuToolTip)] ?? null;
}
