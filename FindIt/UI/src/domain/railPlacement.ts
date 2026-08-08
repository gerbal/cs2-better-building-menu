/**
 * Where each facet dimension lives.
 *
 * A flat row of ten icons is a ten-way choice with no hierarchy. Short,
 * enumerable dimensions read better as the game's own icon rows in the options
 * bank — which is where Theme and Pack already live, so this also ends the
 * split where sibling dimensions used two different idioms for one job.
 */
import { RAIL_SEARCH_THRESHOLD, type RailFacetState } from "./filterRail.ts";

export type RailHome = "bank" | "dropdown" | "searchableDropdown";

/**
 * At or below this many options a dimension is an icon row, not a menu.
 *
 * Unlike RAIL_SEARCH_THRESHOLD this is not inherited from anything measured —
 * it is a starting value to confirm against a real catalog.
 */
export const RAIL_BANK_THRESHOLD = 8;

export function railHomeFor(optionCount: number): RailHome {
  if (!Number.isFinite(optionCount) || optionCount <= RAIL_BANK_THRESHOLD) return "bank";
  return optionCount > RAIL_SEARCH_THRESHOLD ? "searchableDropdown" : "dropdown";
}

export function railPlacement(
  facets: RailFacetState | null | undefined
): Array<{ id: string; home: RailHome }> {
  return (facets?.groups ?? []).map((group) => ({
    id: group.id,
    home: railHomeFor(group.options?.length ?? 0),
  }));
}
