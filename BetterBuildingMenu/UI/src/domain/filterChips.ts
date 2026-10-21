/**
 * One visual form for every way the result set has been narrowed. Chips
 * compose, cost one wrapping row, and give a toolbar preset's filters a stated
 * cause. Model only, so Node runs it as the components do.
 */

import type { AssetMenuFacetState } from "./buildingCatalogFacets";
import { setBuildingCatalogMetricRangeCommand, toggleAssetMenuFacetCommand, type Command } from "./commands";
import type { AssetMenuMetricRangeState } from "./assetMenuFilterSummary";
import { METRIC_RANGE_DEFINITIONS } from "./buildingCatalogRanges";
import type { MetricBoundKey, MetricRangeId } from "./sharedContracts.generated";

export type ChipCommand = Command;

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
  facets?: AssetMenuFacetState | null;
  metricRanges?: AssetMenuMetricRangeState | null;
}

const METRIC_LABELS: Record<MetricRangeId, string> = {
  cost: "Cost",
  upkeep: "Upkeep",
  workers: "Workers",
  capacity: "Capacity",
  lotWidth: "Lot width",
  lotDepth: "Lot depth",
};

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

function readBound(state: AssetMenuMetricRangeState, key: MetricBoundKey): number | null {
  const value = state[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Every chip currently narrowing the result, in reading order: facets first,
 * then metric ranges, matching the order the rail offers the controls.
 */
export function buildFilterChips(input: FilterChipInput | null | undefined): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const group of input?.facets?.groups ?? []) {
    const options = group?.options ?? [];

    // The backend states whether the selection narrows, because the UI cannot:
    // "every option selected" describes both a group at rest, excluding
    // nothing, and one stranded by a menu switch, excluding everything.
    if (group?.narrowing === false) continue;

    for (const option of options) {
      if (!option?.selected) continue;

      chips.push({
        id: `facet:${group.id}:${option.id}`,
        dimension: group.id,
        label: option.label || option.id,
        removable: true,
        // The same trigger that selected it: toggling is symmetric, so removal
        // needs no C# path of its own.
        remove: toggleAssetMenuFacetCommand(group.id, option.id),
      });
    }
  }

  const ranges = input?.metricRanges;
  if (ranges) {
    // Definition order is display order within the metric block.
    for (const { id, minKey, maxKey } of METRIC_RANGE_DEFINITIONS) {
      const min = readBound(ranges, minKey);
      const max = readBound(ranges, maxKey);

      // Both bounds unset is the default, not a filter. The state's
      // `hasSelection` flag is about the whole set and says nothing here.
      if (min === null && max === null) continue;

      chips.push({
        id: `metric:${id}`,
        dimension: `metric:${id}`,
        label: `${METRIC_LABELS[id]} ${formatRange(min, max)}`,
        removable: true,
        remove: setBuildingCatalogMetricRangeCommand(id, "", ""),
      });
    }
  }

  return chips;
}

/** Chips the Clear button can actually reset — everything but the breadcrumb. */
export function removableChipCount(chips: readonly FilterChip[]): number {
  return chips.filter((chip) => chip.removable).length;
}
