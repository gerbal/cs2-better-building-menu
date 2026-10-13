/**
 * What the Tiles view's name line says after a tile's name: the numbers a tile does not show, its
 * capacity, its upkeep and its lot, where it has them. Pure. See docs/design-notes.md, "The bodies".
 */
import { formatBuildingMetric, type NumberSeparators } from "./assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { capacityText, lotText } from "./rowNumbers";

export function tileFacts(entry: BuildingCatalogEntry, separators: NumberSeparators): string {
  const upkeep = typeof entry.upkeep === "number" && entry.upkeep !== 0
    ? formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)
    : null;

  return [capacityText(entry, entry.capacity, separators), upkeep, lotText(entry)].filter((fact): fact is string => fact !== null).join(" · ");
}
