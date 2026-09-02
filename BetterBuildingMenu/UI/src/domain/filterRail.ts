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
  /** Whether this group's selection actually excludes anything in view. */
  narrowing?: boolean;
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

/**
 * Dimensions that live in the game's tool-options bank instead of on the rail.
 *
 * ONE list, read by both homes, because the last time this axis was split the
 * two sides disagreed and the dimension ended up in neither. 593e756 moved the
 * mod's filters out of that bank while the rail still excluded them, and
 * Availability, Source, DLC, Theme and Density were left in the query,
 * toggleable by the backend, and drawn in no UI at all; 3fff26e put them all
 * back on the rail and deleted the split.
 *
 * Splitting again is a deliberate product call (cm-2xvs.15): availability is
 * chrome the game's own left-hand panel should carry. The guarantee that makes
 * it safe is that the bank renders exactly this set and the rail renders
 * exactly its complement — asserted in filterRail.test.ts, not just intended.
 */
export const BANK_DIMENSION_IDS: readonly string[] = ["availability"];

/** Whether this dimension is drawn in the bank rather than on the rail. */
export function isBankDimension(id: string): boolean {
  return BANK_DIMENSION_IDS.includes(id);
}

export function buildFilterRail(
  facets: RailFacetState | null | undefined,
  metrics: { active: number } | null | undefined
): RailDimension[] {
  const groups = facets?.groups ?? [];

  const dimensions: RailDimension[] = groups
    // A group with no options opens an empty popover, which is worse than no
    // icon — Role and Asset packs were both empty catalog-wide until recently.
    .filter((group) => (group.options?.length ?? 0) > 0)
    // ...and the bank's dimensions are not the rail's. See BANK_DIMENSION_IDS.
    .filter((group) => !isBankDimension(group.id))
    .map((group) => ({
      id: group.id,
      label: group.label,
      // What is NARROWING, not what is ticked. A group with every option
      // selected narrows nothing, so counting it lit the icon and drew a badge
      // reading "2" over a menu that was filtering nothing — which is how
      // Availability looks at rest now that both states are shown as selected.
      //
      // The same rule as buildFilterChips. Repeated rather than imported
      // because a domain-to-domain VALUE import breaks one of the two build
      // paths (see vanillaToolbarSelection.ts); if this rule changes, change it
      // in both.
      // The backend says whether the selection narrows; the UI cannot tell the
      // two all-selected cases apart. Availability at rest reports both options
      // selected and excludes nothing; a selection stranded by a menu switch is
      // also all-selected and excludes everything.
      selected: group.narrowing === false ? 0 : group.options.filter((option) => option.selected).length,
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
