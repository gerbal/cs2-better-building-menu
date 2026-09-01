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
}

export interface BuildingLensFilterSummary {
  /** Every constraint narrowing the result. */
  count: number;
  text: string;
  details: string[];
  hasSelection: boolean;
  /**
   * The subset this panel's Clear button can reset. Equal to count since the
   * upstream filter bank went (cm-jjlv.9); kept as a field because the panel
   * reads it.
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

function selectedFacetLabels(state: BuildingLensFacetState | null | undefined): string[] {
  return (state?.groups ?? [])
    // Only groups that actually exclude something. The backend says which —
    // "every option selected" is true both of Availability at rest, which
    // narrows nothing, and of a selection stranded by a menu switch, which
    // narrows everything, so the UI cannot tell them apart itself.
    //
    // Counting the resting state produced the empty message "No buildings match
    // Locked, Unlocked" over a menu with no filter applied: it named the two
    // states as the reason nothing matched, when together they are every asset
    // there is. It also inflated the active-filter count on the pane.
    .filter((group) => group?.narrowing !== false)
    .flatMap((group) =>
      (group?.options ?? [])
        .filter((option) => option.selected)
        .map((option) => option.label || option.id),
    );
}

function selectedFacetCount(state: BuildingLensFacetState | null | undefined): number {
  return selectedFacetLabels(state).length;
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
  const ranges = rangesFromState(input?.metricRanges);
  const activeRanges = metricRangeIds.filter((id) => ranges[id].min !== null || ranges[id].max !== null).length;
  const count = facets + activeRanges;
  const details = [
    // Named, not counted. "No buildings match 1 facet" told the player nothing
    // they could act on; with filters composing freely an empty intersection is
    // easy to reach, so the message has to say which constraint to drop.
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
 * Explains an empty result by naming what is actually constraining it.
 *
 * The previous copy blamed "the current search and category" unconditionally,
 * which pointed the player at the two controls least likely to be responsible:
 * a facet or an unsatisfiable capacity floor could each empty the table while
 * the search box sat empty.
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
