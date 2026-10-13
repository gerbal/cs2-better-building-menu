/**
 * What a list plate's number column says: the cost over a second number, or, for a locked building,
 * the milestone it waits on (or the locked word) in the cost's place; where there is room for one
 * number, which of them. Pure, so the rules are tests. See docs/design-notes.md, "The bodies".
 */
import { formatBuildingMetric, formatCapacity, METRIC_NO_DATA, type NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import { sortedMetricValue } from "./sortedMetric";

export interface PlateNumbers {
  /** The cost, or for a locked building "MS n" or the locked word; "" when it has neither. */
  first: string;
  /** The sorted value under a numeric sort, else the capacity; null when there is none. */
  second: string | null;
  /** Whether the first says why the building is locked, in the locked ink. */
  locked: boolean;
}

const known = (text: string): string | null => (text === "" || text === METRIC_NO_DATA ? null : text);

/** Whether a sort orders by a value of its own to say: a number, but not the cost, said already, nor the lot. */
export function sortsByValue(sortedMetric: AssetMenuMetric | null): sortedMetric is AssetMenuMetric {
  return sortedMetric !== null && sortedMetric !== "cost" && sortedMetric !== "lot";
}

/**
 * The plate's numbers. Under a sort by a number the second is the value sorted by, so the order
 * reads down the column; otherwise the capacity, where the building has one that is not zero.
 */
export function plateNumbers(
  entry: BuildingCatalogEntry,
  sortedMetric: AssetMenuMetric | null,
  separators: NumberSeparators,
  lockedWord: string,
  achievedMilestone: number,
): PlateNumbers {
  const locked = isEntryLocked(entry);
  const cost = known(formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)) ?? "";
  const first = locked ? lockedFact(entry, lockedWord, achievedMilestone) : cost;

  if (sortsByValue(sortedMetric)) {
    const value = sortedMetricValue(entry, sortedMetric);
    const second = value === null
      ? null
      : sortedMetric === "capacity"
        ? known(formatCapacity(value, entry.category, entry.subCategory, entry.buildingType, separators))
        : known(formatBuildingMetric(value, sortedMetric, separators, entry.costIsPerDistance));

    return { first, second, locked };
  }

  const capacity = typeof entry.capacity === "number" && entry.capacity !== 0
    ? known(formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators))
    : null;

  return { first, second: capacity, locked };
}

/**
 * The one number where there is room for one, a one-line plate or a tile's tag: under a sort by a
 * value the value sorted by, so a re-sort says why the order moved; otherwise the first.
 */
export function oneNumber(numbers: PlateNumbers, sortedMetric: AssetMenuMetric | null): PlateNumbers {
  return sortsByValue(sortedMetric)
    ? { first: numbers.second ?? "", second: null, locked: false }
    : { first: numbers.first, second: null, locked: numbers.locked };
}
