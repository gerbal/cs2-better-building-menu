/**
 * Which identity dimension a toolbar menu's tab strip shows.
 *
 * Vanilla's own sub-tabs are adaptive in content but constant in relationship:
 * always the natural subdivision of the menu you just picked. Holding that
 * relationship constant is what makes an adaptive axis read as familiar rather
 * than arbitrary.
 */
export type AxisId = "section" | "subCategory" | "role" | "zoneFamily" | "buildingType" | "zone";

/** Dimensions that can be a tab axis: they name what a thing *is*. */
export const TAXONOMIC_AXIS_IDS: readonly AxisId[] = [
  "section",
  "subCategory",
  "role",
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

/**
 * The fallback for menus the authored map does not name.
 *
 * Optimises for information scent, not partition quality: only taxonomic
 * dimensions are eligible, and where none partitions the scope the answer is
 * no strip. A well-scoring wrong label is worse than none.
 */
export interface AxisCandidate {
  id: string;
  optionCount: number;
}

/** Fewer than this many options and a tab bar is noise rather than navigation. */
const MIN_AXIS_OPTIONS = 2;

export function computeAxis(candidates: AxisCandidate[]): AxisId | null {
  const eligible = (candidates ?? [])
    .filter((c) => isTaxonomicAxis(c.id))
    .filter((c) => Number.isFinite(c.optionCount) && c.optionCount >= MIN_AXIS_OPTIONS);
  if (!eligible.length) return null;

  // Most options wins; ties break on declaration order for determinism.
  let best = eligible[0];
  for (const candidate of eligible) {
    if (candidate.optionCount > best.optionCount) best = candidate;
  }
  return best.id as AxisId;
}

/**
 * Role is the finest real subdivision of the menu the player actually
 * opened — section and subCategory are both at or above the menu itself
 * (subCategory for a service menu enumerates its *siblings*, the 13 service
 * menus, not what is inside the one already selected). So whenever the
 * backend has found two or more roles in the current scope, role wins
 * outright rather than competing with subCategory/section on option count:
 * it is not "the best-scoring axis", it is "the one below where we are".
 *
 * The backend (BuildingLensRoleScope) already applies the two-role floor
 * before publishing BuildingLensRoleList, so "present" here just means
 * non-empty — there is no separate MIN_AXIS_OPTIONS check to duplicate.
 * The Zones menu never produces a role list (it doesn't render the catalog
 * at all), so this can't fire ahead of the zoneFamily short-circuit below.
 */
function roleAxisApplies(candidates: AxisCandidate[]): boolean {
  const role = (candidates ?? []).find((c) => c.id === "role");
  return !!role && Number.isFinite(role.optionCount) && role.optionCount > 0;
}

export function resolveAxis(menuToolTip: string, candidates: AxisCandidate[]): AxisId | null {
  if (roleAxisApplies(candidates)) return "role";

  const authored = authoredAxisFor(menuToolTip);

  // Every AUTHORED entry that resolves to "subCategory" is one of the ten
  // ServiceBuildings toolbar tooltips (electricity, water, healthcare, …),
  // and subCategory at that point is not a subdivision of the menu the
  // player opened — GetSubcategoryDescriptors on the C# side is keyed by
  // section, not by the specific submenu, so it hands back the *siblings*:
  // the same 13 service menus vanilla's own toolbar already shows. That is
  // the exact "redraws the game's own toolbar inside the panel" bug role
  // exists to fix, for all ten of these menus, not only the ones the
  // backend happens to find roles in. So when role has nothing (e.g.
  // Transportation: 41 buildings, zero role groups), the answer is no
  // strip, not "fall back to the wrong axis instead".
  if (authored === "subCategory") return null;

  return authored ?? computeAxis(candidates);
}
