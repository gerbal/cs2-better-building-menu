/**
 * One visual form for every way the result set has been narrowed.
 *
 * Scope and zone family used to be tab strips. They are not navigation — they
 * narrow the set exactly as Role or Cost do — and rendering them as strips cost
 * a permanent 27px band per dimension and made them mutually exclusive by
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
  /**
   * False only for the section chip: there is always an active section, so
   * there is nothing to remove. It stays clickable, which is what makes it a
   * breadcrumb rather than a filter.
   */
  removable: boolean;
  /** What clears this chip. Null when it is not removable. */
  remove: ChipCommand | null;
}

export interface FilterChipInput {
  section?: { id: string; label: string } | null;
  subCategory?: { id: string; label: string } | null;
  /**
   * Zoning families currently selected, empty meaning all of them. These are
   * not part of the catalog facet state: zones are a separate catalog, but they
   * narrow the visible set the same way and so wear the same chip.
   */
  zoneFamilies?: readonly { id: string; label: string }[] | null;
  facets?: BuildingLensFacetState | null;
  metricRanges?: BuildingLensMetricRangeState | null;
}

/** Ids the subcategory uses for "no subcategory chosen". */
const SUBCATEGORY_ANY = "Any";

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
 * Navigation first, then facets, then metric ranges: the leftmost chips are the
 * ones the navigation put there and the rightmost are the ones the player added
 * deliberately, so the row reads as a history of how they got here.
 */
export function buildFilterChips(input: FilterChipInput | null | undefined): FilterChip[] {
  const chips: FilterChip[] = [];

  const section = input?.section;
  if (section && typeof section.id === "string" && section.id !== "") {
    chips.push({
      id: `section:${section.id}`,
      dimension: "section",
      label: section.label || section.id,
      removable: false,
      remove: null,
    });
  }

  const subCategory = input?.subCategory;
  if (
    subCategory
    && typeof subCategory.id === "string"
    && subCategory.id !== ""
    && subCategory.id !== SUBCATEGORY_ANY
  ) {
    chips.push({
      id: `subCategory:${subCategory.id}`,
      dimension: "subCategory",
      label: subCategory.label || subCategory.id,
      removable: true,
      remove: { method: "SetBuildingLensSubCategory", args: [SUBCATEGORY_ANY] },
    });
  }

  for (const family of input?.zoneFamilies ?? []) {
    if (!family?.id) continue;

    chips.push({
      id: `zoneFamily:${family.id}`,
      dimension: "zoneFamily",
      label: family.label || family.id,
      removable: true,
      remove: { method: "ToggleBuildingLensZoneFamily", args: [family.id] },
    });
  }

  for (const group of input?.facets?.groups ?? []) {
    for (const option of group?.options ?? []) {
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
