/**
 * What a list plate's number column says: the cost over the key number, or, for a locked building,
 * the milestone it waits on (or the locked word) in the cost's place; where there is room for one
 * number, which of them. Pure, so the rules are tests. See docs/design-notes.md, "The bodies".
 */
import type { NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import { costText, keyFigure, sortedText, type KeyKind, type UnitGlyph } from "./rowNumbers";

export interface PlateNumbers {
  /** The cost, or for a locked building "MS n" or the locked word; "" when it has neither. */
  first: string;
  /** The sorted value under a numeric sort, else the key number; null when there is none. */
  second: string | null;
  /** The glyph beside the second, for the unit the readout names; null for a figure that says its own. */
  glyph: UnitGlyph | null;
  /** Whether the first says why the building is locked, in the locked ink. */
  locked: boolean;
}

/** Whether a sort orders by a value of its own to say: a number, but not the cost, said already, nor the lot. */
export function sortsByValue(sortedMetric: AssetMenuMetric | null): sortedMetric is AssetMenuMetric {
  return sortedMetric !== null && sortedMetric !== "cost" && sortedMetric !== "lot";
}

/**
 * The plate's numbers. Under a sort by a number the second is the value sorted by, with its unit, so
 * the order reads down the column; otherwise the view's key number, by its glyph.
 */
export function plateNumbers(
  entry: BuildingCatalogEntry,
  sortedMetric: AssetMenuMetric | null,
  separators: NumberSeparators,
  lockedWord: string,
  achievedMilestone: number,
  keyKind: KeyKind = "capacity",
): PlateNumbers {
  const locked = isEntryLocked(entry);
  const first = locked ? lockedFact(entry, lockedWord, achievedMilestone) : costText(entry, separators) ?? "";

  if (sortsByValue(sortedMetric)) {
    return { first, second: sortedText(entry, sortedMetric, separators), glyph: null, locked };
  }

  const key = keyFigure(entry, keyKind, separators);
  return { first, second: key?.text ?? null, glyph: key?.glyph ?? null, locked };
}

/**
 * The one number where there is room for one, a one-line plate or a tile's tag: under a sort by a
 * value the value sorted by, so a re-sort says why the order moved; otherwise the first.
 */
export function oneNumber(numbers: PlateNumbers, sortedMetric: AssetMenuMetric | null): PlateNumbers {
  return sortsByValue(sortedMetric)
    ? { first: numbers.second ?? "", second: null, glyph: null, locked: false }
    : { first: numbers.first, second: null, glyph: null, locked: numbers.locked };
}
