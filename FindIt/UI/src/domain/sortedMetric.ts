/**
 * Showing the figure a result set is currently ordered by.
 *
 * Sorting looked broken everywhere except the table, and the report was fair
 * even though the sort was working. Two things compound:
 *
 * 1. Grouping is the primary sort key by design (see buildingGroups.ts), so
 *    the chosen sort orders rows WITHIN each group rather than across the whole
 *    page. Reordering inside a five-tile Elementary group is a small motion.
 * 2. A grid tile carries a thumbnail and a name. Sort by Capacity and nothing
 *    on screen changes that a player can attribute to the sort — the tiles
 *    genuinely did move, and there was no way to tell.
 *
 * The table escaped both because every metric is a column: the numbers are
 * right there, ascending down the page.
 *
 * So the fix is not to change the ordering, which is correct and load-bearing
 * for paging. It is to put the sorted figure on the tile. "Sort by capacity"
 * then shows capacities, and the order is legible for the same reason it
 * always was in the table.
 *
 * Name and Category are deliberately absent: the tile already shows the name,
 * and a badge repeating it would be noise where there is no gap to fill.
 */

import type { SortColumn } from "./buildingCatalogContracts";
import type { BuildingLensMetric } from "./buildingLensLayout";

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
 * show. The inverse of BUILDING_LENS_COLUMN_SORT, plus the two columns that
 * have no column of their own.
 */
export function sortedMetricFor(column: SortColumn | null | undefined): BuildingLensMetric | null {
  switch (column) {
    case "ConstructionCost":
      return "cost";
    case "Upkeep":
      return "upkeep";
    case "Workers":
      return "workers";
    case "Capacity":
      return "capacity";
    // Both lot columns show the same combined cell, as the table does.
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
 * The entry's value for a metric.
 *
 * `lot` has no single number — the table renders width and depth together —
 * so it returns null here and its caller formats the pair. Parking reads the
 * bay count rather than the boolean, matching what the sort actually orders on
 * (Order() sorts HasParking by ParkingSlots, because a flag put every entry in
 * one of two buckets and visibly did nothing).
 */
export function sortedMetricValue(
  entry: SortedMetricEntry | null | undefined,
  metric: BuildingLensMetric | null,
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
