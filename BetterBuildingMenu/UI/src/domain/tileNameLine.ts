/**
 * What the Tiles view's name line says after a tile's name: the numbers a tile does not show, its
 * capacity, its upkeep and its lot, where it has them. Pure. See docs/design-notes.md, "The bodies".
 */
import type { NumberSeparators } from "./assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { capacityText, lotText, upkeepText } from "./rowNumbers";

export function tileFacts(entry: BuildingCatalogEntry, separators: NumberSeparators): string {
  return [capacityText(entry, entry.capacity, separators), upkeepText(entry, separators), lotText(entry)].filter((fact): fact is string => fact !== null).join(" · ");
}
