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
  formatSpeedLimit,
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

/** How a look says a key number's unit: by its glyph, the readout naming the unit once, or in words after it. */
export type UnitMode = "glyph" | "word";

/**
 * A look's unit marks: by glyph; or in words, each after its number, with the word a count of workers
 * takes ("jobs"), and the word a capacity takes where the game has no unit for it ("capacity"), none
 * where a label beside it names the capacity already, as the hover card's does.
 */
export type UnitMarks = { mode: "glyph" } | { mode: "word"; workersUnit: string; capacityUnit: string };

/** Standard's marks, the glyphs. */
export const GLYPH_MARKS: UnitMarks = { mode: "glyph" };

const known = (text: string): string | null => (text === "" || text === METRIC_NO_DATA ? null : text);

/** Whether a row's money is a network's, which a body says per cell; a building's is whole. */
export function isPerCell(entry: BuildingCatalogEntry): boolean {
  return entry.costIsPerDistance;
}

/**
 * A cost in the game's own template, a building's "Free" for none; a network's per cell, "¢0/c" at 0,
 * a figure like its neighbours' rather than a word; null where it is not known.
 */
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

/** Whether a sort orders by a value of its own to say: a number, but not the cost, said already, nor the lot. */
export function sortsByValue(sortedMetric: AssetMenuMetric | null): sortedMetric is AssetMenuMetric {
  return sortedMetric !== null && sortedMetric !== "cost" && sortedMetric !== "lot";
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
 * Roles whose capacity is a measure whose unit scales with its size (kW or MW, MWh, kg, t or kt): its
 * figure keeps its unit wherever it shows, since two of them bare side by side read as one scale.
 */
const SCALED_ROLES: ReadonlySet<string> = new Set(["PowerPlant", "Battery", "GarbageFacility"]);

/** Roles whose capacity is a measure rather than a count of people or things: the figure says its own unit. */
const MEASURED_ROLES: ReadonlySet<string> = new Set([
  ...SCALED_ROLES, "TelecomFacility", "WaterPumpingStation", "SewageOutlet", "WastewaterTreatmentPlant",
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

/** Whether a name already says its lot ("Corner Parking Lot 1x3"), so the row need not. */
export function nameHoldsLot(name: string, width: number, depth: number): boolean {
  return new RegExp(`(^|[^\\d])${width}\\s*[x×]\\s*${depth}($|[^\\d])`, "iu").test(name);
}

/**
 * A row's key number: its speed by a gauge, its workers by a case, its lot by a grid, a capacity that
 * counts by a person, each its digits alone, as the readout names the unit; a measured capacity says
 * its own unit and draws no glyph. In words, each says its unit after it and draws no glyph ("80 km/h",
 * "400 patients", "20 jobs", a count the game gives no unit "1,500 capacity"; a lot its two sides), so
 * no row prints a bare number. Null where the row has none, or its name already says its lot.
 */
export function keyFigure(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators, marks: UnitMarks = GLYPH_MARKS): KeyFigure | null {
  const figure = glyphFigure(entry, kind, separators);
  if (figure === null || figure.glyph === null || marks.mode === "glyph") return figure;

  switch (kind) {
    case "speed":
      return { text: formatSpeedLimit(entry.speedLimit, separators), glyph: null };
    case "capacity": {
      const said = capacityText(entry, entry.capacity, separators) ?? figure.text;
      return { text: said !== figure.text ? said : marks.capacityUnit === "" ? figure.text : `${figure.text} ${marks.capacityUnit}`, glyph: null };
    }
    case "workers":
      return { text: `${figure.text} ${marks.workersUnit}`, glyph: null };
    default:
      return { text: figure.text, glyph: null };
  }
}

/** A row's key number by its glyph. */
function glyphFigure(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators): KeyFigure | null {
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
