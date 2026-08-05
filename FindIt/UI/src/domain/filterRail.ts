/**
 * The filter rail: one icon per dimension, popovers instead of drawers.
 *
 * The facet drawer and the metric drawer were stacked full-width bands that
 * cost 163px and 171px when open, against a panel of 625px. Measured with both
 * shut the content still only got a third of the panel. A rail of icons costs
 * one row, and a popover costs nothing in the layout at all because it floats.
 *
 * This module is the model only — which dimensions exist, how many selections
 * each holds, and which are too large to scan without their own search.
 */

export interface RailFacetOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface RailFacetGroup {
  id: string;
  label: string;
  options: RailFacetOption[];
}

export interface RailFacetState {
  groups?: RailFacetGroup[] | null;
  hasSelection?: boolean;
}

export interface RailDimension {
  id: string;
  label: string;
  selected: number;
  optionCount: number;
  needsSearch: boolean;
}

/**
 * Above this many options a popover is just the drawer again in a smaller box,
 * so the dimension gets a search field of its own. Extensions holds 109.
 */
export const RAIL_SEARCH_THRESHOLD = 20;

/** Stable id for the metric-ranges entry, which is not a facet group. */
export const RAIL_METRICS_ID = "metrics";

export function buildFilterRail(
  facets: RailFacetState | null | undefined,
  metrics: { active: number } | null | undefined
): RailDimension[] {
  const groups = facets?.groups ?? [];

  const dimensions: RailDimension[] = groups
    // A group with no options opens an empty popover, which is worse than no
    // icon — Role and Asset packs were both empty catalog-wide until recently.
    .filter((group) => (group.options?.length ?? 0) > 0)
    .map((group) => ({
      id: group.id,
      label: group.label,
      selected: group.options.filter((option) => option.selected).length,
      optionCount: group.options.length,
      needsSearch: group.options.length > RAIL_SEARCH_THRESHOLD,
    }));

  // Always last, so its position does not slide around as facet groups appear
  // and disappear with the player's DLC and mods.
  dimensions.push({
    id: RAIL_METRICS_ID,
    label: "Metrics",
    selected: metrics?.active ?? 0,
    optionCount: 0,
    needsSearch: false,
  });

  return dimensions;
}

/** A group's options, narrowed by the popover's own search. */
export function filterRailOptions(
  facets: RailFacetState | null | undefined,
  groupId: string,
  query: string
): RailFacetOption[] {
  const group = (facets?.groups ?? []).find((candidate) => candidate.id === groupId);
  if (!group) return [];

  const needle = query.trim().toLowerCase();
  if (!needle) return group.options;

  return group.options.filter((option) => option.label.toLowerCase().includes(needle));
}

export function hasAnyRailSelection(rail: readonly RailDimension[]): boolean {
  return rail.some((dimension) => dimension.selected > 0);
}

/**
 * How many metric bounds are actually set, for the metrics badge.
 *
 * The binding carries twelve numeric bounds plus a `hasSelection` flag.
 * Counting object values naively made `hasSelection: false` register as a set
 * bound, so the badge read 2 with nothing filtered. Zero is a real bound —
 * "at most 0 workers" is a legitimate filter — so only null and undefined
 * count as unset.
 */
export function countActiveMetricRanges(state: Record<string, unknown> | null | undefined): number {
  if (!state) return 0;

  return Object.entries(state).filter(
    ([key, value]) => key !== "hasSelection" && typeof value === "number" && Number.isFinite(value)
  ).length;
}
