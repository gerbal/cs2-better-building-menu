/**
 * The one reading of each figure a body draws of a row: its cost, its capacity, its lot, the value it
 * is sorted by, and its key number, the kind of number the view's rows show second, with the glyph
 * that stands for the unit the readout names. Pure. See docs/design-notes.md, "Numbers said once".
 */
import {
  applyMoneyTemplate,
  FALLBACK_MONEY,
  formatBuildingMetric,
  formatCapacity,
  formatCostPerCell,
  formatLotDimensions,
  formatMonthlyUpkeepPerCell,
  formatUpkeepPerCell,
  getCapacityUnitLabel,
  groupDigits,
  hasFootprint,
  METRIC_NO_DATA,
  speedNumber,
  type NumberSeparators,
} from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { sortedMetricValue } from "./sortedMetric";

/** The kind of number a view's rows show second, as C# names it: none where the view's rows carry none. */
export type KeyKind = "speed" | "capacity" | "workers" | "lot" | "";

/** The glyph a key number draws beside it, for the unit the readout names once. */
export type UnitGlyph = "gauge" | "person" | "case" | "grid";

/** A key number: its digits, and its glyph; null for a figure that says its own unit, a measured one. */
export interface KeyFigure {
  text: string;
  glyph: UnitGlyph | null;
}

const known = (text: string): string | null => (text === "" || text === METRIC_NO_DATA ? null : text);

/** Whether a row's money is a network's, which a body says per cell; a building's is whole. */
export function isPerCell(entry: BuildingCatalogEntry): boolean {
  return entry.costIsPerDistance;
}

/** A cost in the game's own template, "Free" for none, a network's per cell; null where it is not known. */
export function costText(entry: BuildingCatalogEntry, separators: NumberSeparators): string | null {
  if (isPerCell(entry) && typeof entry.constructionCost === "number" && Number.isFinite(entry.constructionCost)) {
    return formatCostPerCell(entry.constructionCost, separators);
  }
  return known(formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance));
}

/** A capacity with its unit, where the building has one above 0. */
export function capacityText(entry: BuildingCatalogEntry, value: number | null | undefined, separators: NumberSeparators): string | null {
  return typeof value === "number" && value > 0 ? known(formatCapacity(value, entry.category, entry.subCategory, entry.buildingType, separators)) : null;
}

/**
 * An upkeep with its month, where nothing beside it names the month: a building's in the game's monthly
 * template, a network's per cell; null where the building has none that is not 0.
 */
export function upkeepText(entry: BuildingCatalogEntry, separators: NumberSeparators): string | null {
  if (typeof entry.upkeep !== "number" || !Number.isFinite(entry.upkeep) || entry.upkeep === 0) return null;
  return isPerCell(entry) ? formatMonthlyUpkeepPerCell(entry.upkeep, separators) : known(formatBuildingMetric(entry.upkeep, "upkeep", separators));
}

/** A lot as its two sides, where the building has both. */
export function lotText(entry: BuildingCatalogEntry): string | null {
  return hasFootprint(entry.lotWidth, entry.lotDepth) ? formatLotDimensions(entry.lotWidth, entry.lotDepth) : null;
}

/**
 * The value a sort orders by, with its unit, which Sort names; an upkeep without the month every row
 * shares, a network's per cell. Null under no sort by a number, or where the row has none.
 */
export function sortedText(entry: BuildingCatalogEntry, sortedMetric: AssetMenuMetric | null, separators: NumberSeparators): string | null {
  if (sortedMetric === null) return null;
  if (sortedMetric === "lot") return lotText(entry);

  const value = sortedMetricValue(entry, sortedMetric);
  if (value === null) return null;
  if (sortedMetric === "upkeep" && Number.isFinite(value)) {
    return isPerCell(entry) ? formatUpkeepPerCell(value, separators) : applyMoneyTemplate((separators.money ?? FALLBACK_MONEY).plain, groupDigits(value, separators));
  }

  return sortedMetric === "capacity" ? capacityText(entry, value, separators) : known(formatBuildingMetric(value, sortedMetric, separators, entry.costIsPerDistance));
}

/**
 * Roles whose capacity is a measure whose unit scales with its size (kW or MW, kg, t or kt): its figure
 * keeps its unit wherever it shows, since two of them bare side by side read as one scale.
 */
const SCALED_ROLES: ReadonlySet<string> = new Set(["PowerPlant", "GarbageFacility"]);

/** Roles whose capacity is a measure rather than a count of people or things: the figure says its own unit. */
const MEASURED_ROLES: ReadonlySet<string> = new Set([
  ...SCALED_ROLES, "Battery", "TelecomFacility", "WaterPumpingStation", "SewageOutlet", "WastewaterTreatmentPlant",
]);

/** Whether a figure of this kind keeps its unit where room is short, shortening its number instead. */
export function keepsUnit(entry: BuildingCatalogEntry, metric: AssetMenuMetric | null): boolean {
  return metric === "capacity" && SCALED_ROLES.has(entry.buildingType);
}

/** Whether a capacity counts people or things, which the person glyph stands for, rather than a measure. */
function countsCapacity(entry: BuildingCatalogEntry): boolean {
  if (MEASURED_ROLES.has(entry.buildingType)) return false;
  const unit = getCapacityUnitLabel(entry.category, entry.subCategory, entry.buildingType);
  return unit !== "MW" && unit !== "m³" && unit !== "t";
}

/** Whether a name already says its lot ("Small Underground Parking Lot 1x3"), so the row need not. */
export function nameHoldsLot(name: string, width: number, depth: number): boolean {
  return new RegExp(`(^|[^\\d])${width}\\s*[x×]\\s*${depth}($|[^\\d])`, "iu").test(name);
}

/**
 * A row's key number: its speed by a gauge, its workers by a case, its lot by a grid, a capacity that
 * counts by a person, each its digits alone, as the readout names the unit; a measured capacity says
 * its own unit and draws no glyph. Null where the row has none, or its name already says its lot.
 */
export function keyFigure(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators): KeyFigure | null {
  switch (kind) {
    case "speed": {
      const speed = typeof entry.speedLimit === "number" && entry.speedLimit > 0 ? speedNumber(entry.speedLimit, separators) : "";
      return speed === "" ? null : { text: speed, glyph: "gauge" };
    }
    case "capacity": {
      if (!countsCapacity(entry)) {
        const measured = capacityText(entry, entry.capacity, separators);
        return measured === null ? null : { text: measured, glyph: null };
      }
      return typeof entry.capacity === "number" && entry.capacity > 0 ? { text: groupDigits(entry.capacity, separators), glyph: "person" } : null;
    }
    case "workers":
      return typeof entry.workers === "number" && entry.workers > 0 ? { text: groupDigits(entry.workers, separators), glyph: "case" } : null;
    case "lot": {
      const lot = lotText(entry);
      return lot === null || nameHoldsLot(entry.name ?? "", entry.lotWidth, entry.lotDepth) ? null : { text: lot, glyph: "grid" };
    }
    default:
      return null;
  }
}
