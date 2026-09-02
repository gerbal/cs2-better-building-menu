/**
 * One visual form for every way the result set has been narrowed.
 *
 * The facets used to be tab strips. They are not navigation — they narrow the
 * set exactly as Role or Cost do — and rendering them as strips cost a
 * permanent 27px band per dimension and made them mutually exclusive by
 * construction, so "Office AND high density" could not be asked for at all.
 * Measured: five stacked bands, 142px of chrome on a 625px panel.
 *
 * As chips they compose, they cost one wrapping row, and a new dimension costs
 * no chrome at all. The other thing chips buy is an account of the vanilla-menu
 * presets: clicking Electricity in the game's toolbar used to apply a filter in
 * silence, so the player saw a narrowed list with no stated cause. The preset
 * now arrives as chips they can read and remove one at a time.
 *
 * Model only. This module deliberately imports no values from its siblings —
 * Node's --experimental-strip-types rejects domain-to-domain value imports — so
 * the removal commands are written out as literals rather than borrowed.
 */

import type { BuildingLensFacetState } from "./buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "./buildingLensFilterSummary";
import type { MetricRangeId } from "./buildingCatalogRanges";

export interface ChipCommand {
  method: string;
  args: any[];
}

export interface FilterChip {
  /** Unique across every dimension, so React keys never collide. */
  id: string;
  dimension: string;
  label: string;
  /** Whether the chip has a removal gesture at all. */
  removable: boolean;
  /** What clears this chip. Null when it is not removable. */
  remove: ChipCommand | null;
}

export interface FilterChipInput {
  facets?: BuildingLensFacetState | null;
  metricRanges?: BuildingLensMetricRangeState | null;
}

const METRIC_LABELS: Record<MetricRangeId, string> = {
  cost: "Cost",
  upkeep: "Upkeep",
  workers: "Workers",
  capacity: "Capacity",
  lotWidth: "Lot width",
  lotDepth: "Lot depth",
};

const METRIC_BOUNDS: Record<MetricRangeId, [keyof BuildingLensMetricRangeState, keyof BuildingLensMetricRangeState]> = {
  cost: ["minCost", "maxCost"],
  upkeep: ["minUpkeep", "maxUpkeep"],
  workers: ["minWorkers", "maxWorkers"],
  capacity: ["minCapacity", "maxCapacity"],
  lotWidth: ["minLotWidth", "maxLotWidth"],
  lotDepth: ["minLotDepth", "maxLotDepth"],
};

/** Declaration order is display order within the metric block. */
const METRIC_IDS = Object.keys(METRIC_LABELS) as MetricRangeId[];

function formatBound(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${formatBound(min)}–${formatBound(max)}`;
  if (min !== null) return `≥ ${formatBound(min)}`;
  return `≤ ${formatBound(max as number)}`;
}

function readBound(state: BuildingLensMetricRangeState, key: keyof BuildingLensMetricRangeState): number | null {
  const value = state[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Every chip currently narrowing the result, in reading order.
 *
 * Facets first, then metric ranges: the row reads as a history of how the
 * player narrowed the set, in the order the rail offers the controls.
 */
export function buildFilterChips(input: FilterChipInput | null | undefined): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const group of input?.facets?.groups ?? []) {
    const options = group?.options ?? [];

    // The backend states whether the selection narrows. The UI cannot work it
    // out: "every option selected" is true of Availability at rest, which
    // excludes nothing, AND of a selection stranded by a menu switch — "Require
    // road" carried into Landscaping, where the stranded value is the group's
    // only option — which excludes everything. Guessing suppressed the chip for
    // both, leaving that second case a filter with no control attached.
    if (group?.narrowing === false) continue;

    for (const option of options) {
      if (!option?.selected) continue;

      chips.push({
        id: `facet:${group.id}:${option.id}`,
        dimension: group.id,
        label: option.label || option.id,
        removable: true,
        // The same trigger that selected it. Toggling is symmetric, so removal
        // needs no separate C# path.
        remove: { method: "ToggleBuildingLensFacet", args: [group.id, option.id] },
      });
    }
  }

  const ranges = input?.metricRanges;
  if (ranges) {
    for (const id of METRIC_IDS) {
      const [minKey, maxKey] = METRIC_BOUNDS[id];
      const min = readBound(ranges, minKey);
      const max = readBound(ranges, maxKey);

      // Both bounds unset is the default, not a filter. Reading `hasSelection`
      // per-dimension here is what previously made the rail badge report 2 with
      // nothing actually narrowed.
      if (min === null && max === null) continue;

      chips.push({
        id: `metric:${id}`,
        dimension: `metric:${id}`,
        label: `${METRIC_LABELS[id]} ${formatRange(min, max)}`,
        removable: true,
        remove: { method: "SetBuildingCatalogMetricRange", args: [id, "", ""] },
      });
    }
  }

  return chips;
}

/** Chips the Clear button can actually reset — everything but the breadcrumb. */
export function removableChipCount(chips: readonly FilterChip[]): number {
  return chips.filter((chip) => chip.removable).length;
}
