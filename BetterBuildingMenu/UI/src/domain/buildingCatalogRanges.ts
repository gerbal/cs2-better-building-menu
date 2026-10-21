import type { AssetMenuMetricRangeState } from "./assetMenuFilterSummary";
import { METRIC_RANGES, type MetricBoundKey, type MetricRangeId } from "./sharedContracts.generated";

export interface MetricRangeInput {
  minText: string;
  maxText: string;
}

export interface NormalizedMetricRange {
  min: number | null;
  max: number | null;
}

export interface MetricRangeDefinition {
  id: MetricRangeId;
  /** Where the published range state carries this metric's bounds. */
  minKey: MetricBoundKey;
  maxKey: MetricBoundKey;
  label: string;
  localizationKey: string;
  integer: boolean;
}

export const METRIC_RANGE_MAX = 1_000_000_000;
export const LOT_RANGE_MAX = 10_000;

/** What the drawer calls each metric; the rest of a definition is C#'s. */
const METRIC_LABELS: Record<MetricRangeId, Pick<MetricRangeDefinition, "label" | "localizationKey">> = {
  cost: { label: "Cost", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Cost]" },
  upkeep: { label: "Upkeep", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Upkeep]" },
  workers: { label: "Workers", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Workers]" },
  capacity: { label: "Capacity", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Capacity]" },
  lotWidth: { label: "Lot Width", localizationKey: "Options.LABEL[BetterBuildingMenu.LotWidth]" },
  lotDepth: { label: "Lot Depth", localizationKey: "Options.LABEL[BetterBuildingMenu.LotDepth]" },
};

export const METRIC_RANGE_DEFINITIONS: readonly MetricRangeDefinition[] = METRIC_RANGES.map((metric) => ({
  ...metric,
  ...METRIC_LABELS[metric.id],
}));

/** Every bound the range state carries, a minimum and a maximum per metric, in definition order. */
export const BOUND_KEYS: readonly MetricBoundKey[] = METRIC_RANGES.flatMap((metric) => [metric.minKey, metric.maxKey]);

function definitionFor(id: MetricRangeId | string): MetricRangeDefinition | undefined {
  return METRIC_RANGE_DEFINITIONS.find((definition) => definition.id === id);
}

function normalizeBound(definition: MetricRangeDefinition, text: string): number | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }

  const parsed = Number(text.trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const maximum = definition.integer ? LOT_RANGE_MAX : METRIC_RANGE_MAX;
  const bounded = Math.min(maximum, Math.max(0, parsed));
  return definition.integer ? Math.round(bounded) : Math.round(bounded * 100) / 100;
}

/**
 * Reports text the player typed that will never become a bound. Dropped in
 * silence, a typo reads exactly like an applied filter and the empty result
 * has no visible cause. Blank is not invalid — it means "no bound".
 */
export function getInvalidMetricBounds(
  id: MetricRangeId | string,
  input: MetricRangeInput,
): { min: boolean; max: boolean } {
  const definition = definitionFor(id);
  if (!definition) {
    return { min: false, max: false };
  }

  const isInvalid = (text: string): boolean => {
    const trimmed = (text ?? "").trim();
    if (trimmed.length === 0) {
      return false;
    }

    return normalizeBound(definition, trimmed) === null;
  };

  return {
    min: isInvalid(input?.minText ?? ""),
    max: isInvalid(input?.maxText ?? ""),
  };
}

/** True when the normalizer had to swap reversed bounds to make sense of them. */
export function didSwapMetricBounds(id: MetricRangeId | string, input: MetricRangeInput): boolean {
  const definition = definitionFor(id);
  if (!definition) {
    return false;
  }

  const min = normalizeBound(definition, input?.minText ?? "");
  const max = normalizeBound(definition, input?.maxText ?? "");

  return min !== null && max !== null && min > max;
}

export function hasMetricRange(range: NormalizedMetricRange | null | undefined): boolean {
  return range != null && (range.min != null || range.max != null);
}

/** The published bounds as one range per metric; absent state or bounds read as unset. */
export function metricRangesFromState(
  state: AssetMenuMetricRangeState | null | undefined,
): Record<MetricRangeId, NormalizedMetricRange> {
  const ranges = {} as Record<MetricRangeId, NormalizedMetricRange>;
  for (const definition of METRIC_RANGE_DEFINITIONS) {
    ranges[definition.id] = { min: state?.[definition.minKey] ?? null, max: state?.[definition.maxKey] ?? null };
  }

  return ranges;
}

export function countActiveMetricRanges(
  ranges: Record<MetricRangeId, NormalizedMetricRange | null | undefined>,
): number {
  return METRIC_RANGE_DEFINITIONS.reduce(
    (count, definition) => count + (hasMetricRange(ranges[definition.id]) ? 1 : 0),
    0,
  );
}
