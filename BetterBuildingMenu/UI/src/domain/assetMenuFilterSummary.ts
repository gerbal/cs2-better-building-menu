import type { NumberSeparators } from "./assetMenuMetricFormat";
import {
  countActiveMetricRanges,
  describeRange,
  metricRangesFromState,
  METRIC_RANGE_DEFINITIONS,
  type NormalizedMetricRange,
} from "./buildingCatalogRanges";
import type { AssetMenuFacetState } from "./buildingCatalogFacets";
import type { MetricBoundKey, MetricRangeId } from "./sharedContracts.generated";

/** The published bounds, a minimum and a maximum per metric, null where unset. */
export interface AssetMenuMetricRangeState extends Record<MetricBoundKey, number | null> {
  hasSelection: boolean;
}

export interface AssetMenuFilterSummaryInput {
  facets?: AssetMenuFacetState | null;
  metricRanges?: AssetMenuMetricRangeState | null;
  /** The player's number marks for a range's bounds; the fallback marks when absent. */
  separators?: NumberSeparators | null;
}

export interface AssetMenuFilterSummary {
  /** Every constraint narrowing the result. */
  count: number;
  text: string;
  details: string[];
  hasSelection: boolean;
  /** The subset the asset menu's Clear button can reset; equal to count today. */
  resultCount: number;
}


function selectedFacetLabels(state: AssetMenuFacetState | null | undefined): string[] {
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

function metricDetails(
  ranges: Record<MetricRangeId, NormalizedMetricRange>,
  separators: NumberSeparators | undefined,
): string[] {
  return METRIC_RANGE_DEFINITIONS
    .filter(({ id }) => ranges[id].min !== null || ranges[id].max !== null)
    .map(({ id, label }) => `${label} ${describeRange(ranges[id].min, ranges[id].max, separators)}`);
}

export function getAssetMenuFilterSummary(
  input: AssetMenuFilterSummaryInput | null | undefined,
): AssetMenuFilterSummary {
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
    ...metricDetails(ranges, input?.separators ?? undefined),
  ];

  const resultCount = count;

  return {
    count,
    text: count === 0 ? "No active filters" : `${count} active filter${count === 1 ? "" : "s"}`,
    details,
    hasSelection: count > 0,
    resultCount,
  };
}

/**
 * Explains an empty result by naming what is actually constraining it — a facet
 * or an unsatisfiable bound can empty the table with the search box untouched.
 */
export function getAssetMenuEmptyStateMessage(
  input: (AssetMenuFilterSummaryInput & { searchText?: string | null }) | null | undefined,
): string {
  const summary = getAssetMenuFilterSummary(input);
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
