import type { MetricRangeId, NormalizedMetricRange } from "./buildingCatalogRanges";
import type { BuildingLensFacetState } from "./buildingCatalogFacets";

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
  capacityFloor?: number | null;
  /**
   * Labels for the legacy FindIt filters that are currently narrowing the lens
   * index. The adapter applies these before the lens query runs, so omitting
   * them let the panel report "No active lens filters" while a legacy toggle
   * hid most of the catalog.
   */
  legacyFilters?: readonly string[] | null;
}

export interface BuildingLensFilterSummary {
  /** Every constraint narrowing the result, lens-owned or legacy. */
  count: number;
  text: string;
  details: string[];
  hasSelection: boolean;
  /**
   * The subset this panel's Clear button can actually reset. Legacy Find It
   * filters live on another surface, so offering to clear them here would be a
   * button that visibly fails to do what it says.
   */
  lensCount: number;
}

export interface BuildingLensFilterTriggerCommand {
  method: string;
  args: any[];
}

const metricLabels: Record<MetricRangeId, string> = {
  cost: "Cost",
  upkeep: "Upkeep",
  workers: "Workers",
  capacity: "Capacity",
  lotWidth: "Lot width",
  lotDepth: "Lot depth",
};

const metricRangeIds = Object.keys(metricLabels) as MetricRangeId[];

function rangesFromState(state: BuildingLensMetricRangeState | null | undefined): Record<MetricRangeId, NormalizedMetricRange> {
  return {
    cost: { min: state?.minCost ?? null, max: state?.maxCost ?? null },
    upkeep: { min: state?.minUpkeep ?? null, max: state?.maxUpkeep ?? null },
    workers: { min: state?.minWorkers ?? null, max: state?.maxWorkers ?? null },
    capacity: { min: state?.minCapacity ?? null, max: state?.maxCapacity ?? null },
    lotWidth: { min: state?.minLotWidth ?? null, max: state?.maxLotWidth ?? null },
    lotDepth: { min: state?.minLotDepth ?? null, max: state?.maxLotDepth ?? null },
  };
}

function selectedFacetCount(state: BuildingLensFacetState | null | undefined): number {
  return state?.groups.reduce(
    (count, group) => count + group.options.filter((option) => option.selected).length,
    0,
  ) ?? 0;
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
  const facets = selectedFacetCount(input?.facets);
  const ranges = rangesFromState(input?.metricRanges);
  const activeRanges = metricRangeIds.filter((id) => ranges[id].min !== null || ranges[id].max !== null).length;
  const capacityFloor = Number.isFinite(input?.capacityFloor) && (input?.capacityFloor ?? 0) > 0
    ? input?.capacityFloor ?? 0
    : 0;
  const legacyFilters = (input?.legacyFilters ?? []).filter((label) => typeof label === "string" && label.length > 0);
  const count = facets + activeRanges + (capacityFloor > 0 ? 1 : 0) + legacyFilters.length;
  const details = [
    ...(facets > 0 ? [`${facets} facet${facets === 1 ? "" : "s"}`] : []),
    ...metricDetails(ranges),
    ...(capacityFloor > 0 ? [`Education capacity ${formatBound(capacityFloor)}+`] : []),
    // Named individually: "3 filters" would not tell the player which legacy
    // toggle to reach for, and the legacy panel is a different surface.
    ...legacyFilters.map((label) => `Find It: ${label}`),
  ];

  const lensCount = facets + activeRanges + (capacityFloor > 0 ? 1 : 0);

  return {
    count,
    text: count === 0 ? "No active filters" : `${count} active filter${count === 1 ? "" : "s"}`,
    details,
    hasSelection: count > 0,
    lensCount,
  };
}

/**
 * Explains an empty result by naming what is actually constraining it.
 *
 * The previous copy blamed "the current search and category" unconditionally,
 * which pointed the player at the two controls least likely to be responsible:
 * a legacy Find It toggle, a facet, or an unsatisfiable capacity floor could
 * each empty the table while the search box sat empty.
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

  const ranges = rangesFromState(input?.metricRanges);
  const capacityFloor = Number.isFinite(input?.capacityFloor) && (input?.capacityFloor ?? 0) > 0
    ? input?.capacityFloor ?? 0
    : 0;
  const capacityMax = ranges.capacity.max;
  // The backend composes these as max(floor, minCapacity), so a floor above the
  // capacity maximum silently rejects every row while both controls look fine.
  const conflict = capacityFloor > 0 && capacityMax !== null && capacityFloor > capacityMax
    ? ` The Education capacity floor is above the capacity maximum, so nothing can match.`
    : "";

  return `No buildings match ${constraints.join(", ")}.${conflict}`;
}

export function clearBuildingLensFiltersCommand(): BuildingLensFilterTriggerCommand {
  return {
    method: "ClearBuildingLensFilters",
    args: [],
  };
}
