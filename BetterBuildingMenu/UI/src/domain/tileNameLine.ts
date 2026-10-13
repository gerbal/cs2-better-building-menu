/**
 * What the Tiles view's name line says after a tile's name: the numbers a tile does not show, its
 * capacity, its upkeep and its lot, where it has them. Pure. See docs/design-notes.md, "The bodies".
 */
import { formatBuildingMetric, formatCapacity, formatLotDimensions, hasFootprint, METRIC_NO_DATA, type NumberSeparators } from "./assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "./buildingCatalog";

export function tileFacts(entry: BuildingCatalogEntry, separators: NumberSeparators): string {
  const facts: string[] = [];

  if (typeof entry.capacity === "number" && entry.capacity !== 0) {
    facts.push(formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators));
  }

  if (typeof entry.upkeep === "number" && entry.upkeep !== 0) {
    facts.push(formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance));
  }

  if (hasFootprint(entry.lotWidth, entry.lotDepth)) {
    facts.push(formatLotDimensions(entry.lotWidth, entry.lotDepth));
  }

  return facts.filter((fact) => fact !== "" && fact !== METRIC_NO_DATA).join(" · ");
}
