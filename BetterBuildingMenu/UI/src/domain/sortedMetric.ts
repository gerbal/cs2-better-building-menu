/**
 * Showing the figure a result set is ordered by, so a re-sort is legible:
 * grouping is the primary key, so a sort only moves rows within small groups,
 * and a picture gives the eye nothing to attribute that to.
 */

import type { SortColumn } from "./buildingCatalogContracts";
import type { AssetMenuMetric } from "./assetMenuLayout";

/** Enough of a catalog entry to read a metric off. */
export interface SortedMetricEntry {
  constructionCost?: number | null;
  upkeep?: number | null;
  workers?: number | null;
  capacity?: number | null;
  lotWidth?: number | null;
  lotDepth?: number | null;
  buildingLevel?: number | null;
  parkingSlots?: number | null;
}

/**
 * The metric a sort column is ordering by, or null when there is nothing to
 * show.
 */
export function sortedMetricFor(column: SortColumn | null | undefined): AssetMenuMetric | null {
  switch (column) {
    case "ConstructionCost":
      return "cost";
    case "Upkeep":
      return "upkeep";
    case "Workers":
      return "workers";
    case "Capacity":
      return "capacity";
    // Both lot columns sort by one lot, width by depth.
    case "LotWidth":
    case "LotDepth":
      return "lot";
    case "BuildingLevel":
      return "level";
    case "HasParking":
      return "parking";
    default:
      return null;
  }
}

/**
 * The entry's value for a metric. `lot` has no single number — it is width and
 * depth together — so it returns null and the caller formats the pair. Parking
 * reads the bay count, which is what the sort orders on.
 */
export function sortedMetricValue(
  entry: SortedMetricEntry | null | undefined,
  metric: AssetMenuMetric | null,
): number | null {
  if (!entry || metric === null) {
    return null;
  }

  const value = metric === "cost" ? entry.constructionCost
    : metric === "upkeep" ? entry.upkeep
      : metric === "workers" ? entry.workers
        : metric === "capacity" ? entry.capacity
          : metric === "level" ? entry.buildingLevel
            : metric === "parking" ? entry.parkingSlots
              : null;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
