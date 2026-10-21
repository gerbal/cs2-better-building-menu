/**
 * What every view mode draws the same way for one catalog entry. Plain
 * functions, because each runs once per row.
 */

import type { BuildingCatalogEntry } from "./buildingCatalog";
import type { AssetMenuMetric } from "./assetMenuLayout";
import { formatBuildingMetric, formatLotDimensions, hasFootprint, type NumberSeparators } from "./assetMenuMetricFormat";
import { sortedMetricValue } from "./sortedMetric";

/**
 * The figure the result is ordered by, or null. `lot` prints the pair, since a
 * lone "6" reads as the whole lot; a lot of 0 × 0 or a figure the entry never
 * carried draws nothing, because the badge explains an order and a dash explains none.
 */
export function sortedBadgeText(
  entry: BuildingCatalogEntry,
  metric: AssetMenuMetric | null,
  separators: NumberSeparators,
): string | null {
  if (metric === null) {
    return null;
  }

  if (metric === "lot") {
    return hasFootprint(entry.lotWidth, entry.lotDepth) ? formatLotDimensions(entry.lotWidth, entry.lotDepth) : null;
  }

  const value = sortedMetricValue(entry, metric);

  return value === null ? null : formatBuildingMetric(value, metric, separators, entry.costIsPerDistance);
}
