/**
 * The filter rail: one icon per dimension, with floating popovers rather than
 * stacked drawers, so the filters cost one row of the panel. The model only —
 * which dimensions exist, how many selections each holds, which need a search.
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
 * Above this many options a popover is the drawer again in a smaller box, so
 * the dimension gets a search field of its own.
 */
export const RAIL_SEARCH_THRESHOLD = 20;

/** Stable id for the metric-ranges entry, which is not a facet group. */
export const RAIL_METRICS_ID = "metrics";

/**
 * Dimensions that live in the game's tool-options bank instead of on the rail.
 * ONE list read by both homes, because two can disagree and strand a dimension
 * in neither. filterRail.test.ts asserts the partition rather than assuming it.
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
    // icon at all.
    .filter((group) => (group.options?.length ?? 0) > 0)
    // ...and the bank's dimensions are not the rail's. See BANK_DIMENSION_IDS.
    .filter((group) => !isBankDimension(group.id))
    .map((group) => ({
      id: group.id,
      label: group.label,
      // What is NARROWING, not what is ticked: a group with every option
      // selected filters nothing, and only the backend can tell that from a
      // selection stranded by a menu switch. buildFilterChips repeats this.
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
