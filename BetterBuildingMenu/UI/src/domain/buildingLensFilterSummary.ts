import { countActiveMetricRanges, metricRangesFromState, type MetricRangeId, type NormalizedMetricRange } from "./buildingCatalogRanges";
import type { BuildingLensFacetState } from "./buildingCatalogFacets";
import type { Command } from "./command";

export interface BuildingLensMetricRangeState {
  minCost: number | null;
  maxCost: number | null;
  minUpkeep: number | null;
  maxUpkeep: number | null;
  minWorkers: number | null;
  maxWorkers: number | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  minLotWidth: number | null;
  maxLotWidth: number | null;
  minLotDepth: number | null;
  maxLotDepth: number | null;
  hasSelection: boolean;
}

export interface BuildingLensFilterSummaryInput {
  facets?: BuildingLensFacetState | null;
  metricRanges?: BuildingLensMetricRangeState | null;
}

export interface BuildingLensFilterSummary {
  /** Every constraint narrowing the result. */
  count: number;
  text: string;
  details: string[];
  hasSelection: boolean;
  /** The subset this panel's Clear button can reset; equal to count today. */
  lensCount: number;
}

export type BuildingLensFilterTriggerCommand = Command;

const metricLabels: Record<MetricRangeId, string> = {
  cost: "Cost",
  upkeep: "Upkeep",
  workers: "Workers",
  capacity: "Capacity",
  lotWidth: "Lot width",
  lotDepth: "Lot depth",
};

const metricRangeIds = Object.keys(metricLabels) as MetricRangeId[];

function selectedFacetLabels(state: BuildingLensFacetState | null | undefined): string[] {
  return (state?.groups ?? [])
    // Only groups that actually exclude something, and the backend says which:
    // "every option selected" describes both a group at rest, which narrows
    // nothing, and one stranded by a menu switch, which narrows everything.
    .filter((group) => group?.narrowing !== false)
    .flatMap((group) =>
      (group?.options ?? [])
        .filter((option) => option.selected)
        .map((option) => option.label || option.id),
    );
}

function formatBound(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatRange(range: NormalizedMetricRange): string {
  if (range.min !== null && range.max !== null) {
    return `${formatBound(range.min)}–${formatBound(range.max)}`;
  }

  if (range.min !== null) {
    return `≥ ${formatBound(range.min)}`;
  }

  return `≤ ${formatBound(range.max as number)}`;
}

function metricDetails(ranges: Record<MetricRangeId, NormalizedMetricRange>): string[] {
  return metricRangeIds
    .filter((id) => ranges[id].min !== null || ranges[id].max !== null)
    .map((id) => `${metricLabels[id]} ${formatRange(ranges[id])}`);
}

export function getBuildingLensFilterSummary(
  input: BuildingLensFilterSummaryInput | null | undefined,
): BuildingLensFilterSummary {
  const facetLabels = selectedFacetLabels(input?.facets);
  const facets = facetLabels.length;
  // The same count the rail's badge and the drawer show.
  const ranges = metricRangesFromState(input?.metricRanges);
  const activeRanges = countActiveMetricRanges(ranges);
  const count = facets + activeRanges;
  const details = [
    // Named, not counted: with filters composing freely an empty intersection
    // is easy to reach, so the message has to say which constraint to drop.
    ...facetLabels,
    ...metricDetails(ranges),
  ];

  const lensCount = count;

  return {
    count,
    text: count === 0 ? "No active filters" : `${count} active filter${count === 1 ? "" : "s"}`,
    details,
    hasSelection: count > 0,
    lensCount,
  };
}

/**
 * Explains an empty result by naming what is actually constraining it — a facet
 * or an unsatisfiable bound can empty the table with the search box untouched.
 */
export function getBuildingLensEmptyStateMessage(
  input: (BuildingLensFilterSummaryInput & { searchText?: string | null }) | null | undefined,
): string {
  const summary = getBuildingLensFilterSummary(input);
  const searchText = (input?.searchText ?? "").trim();
  const constraints = [
    ...(searchText.length > 0 ? [`search "${searchText}"`] : []),
    ...summary.details,
  ];

  if (constraints.length === 0) {
    return "No buildings in this category.";
  }

  return `No buildings match ${constraints.join(", ")}.`;
}

export function clearBuildingLensFiltersCommand(): BuildingLensFilterTriggerCommand {
  return {
    method: "ClearBuildingLensFilters",
    args: [],
  };
}
