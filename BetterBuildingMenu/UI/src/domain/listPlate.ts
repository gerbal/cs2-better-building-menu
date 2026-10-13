/**
 * What a list plate's number column says: the cost over the key number, or, for a locked building,
 * the milestone it waits on (or the locked word) in the cost's place; where there is room for one
 * number, which of them. Pure, so the rules are tests. See docs/design-notes.md, "The bodies".
 */
import type { NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry, SharedValue } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import { costText, keyFigure, sortedText, sortsByValue, type KeyKind, type UnitGlyph } from "./rowNumbers";
import { holdsBack, NOTHING_SAID } from "./saidOnce";

export interface PlateNumbers {
  /** The cost, or for a locked building "MS n" or the locked word; "" when it has neither. */
  first: string;
  /** The sorted value under a numeric sort, else the key number; null when there is none. */
  second: string | null;
  /** The glyph beside the key number, for the unit the readout names; null for a figure that says its own. */
  glyph: UnitGlyph | null;
  /** Whether the first says why the building is locked, in the locked ink. */
  locked: boolean;
}

/**
 * The plate's numbers. Under a sort by a number the second is the value sorted by, with its unit, so
 * the order reads down the column; otherwise the view's key number, by its glyph. A value the readout
 * said once is left blank: a blank cell only ever means the readout's value.
 */
export function plateNumbers(
  entry: BuildingCatalogEntry,
  sortedMetric: AssetMenuMetric | null,
  separators: NumberSeparators,
  lockedWord: string,
  achievedMilestone: number,
  keyKind: KeyKind = "capacity",
  said: readonly SharedValue[] = NOTHING_SAID,
): PlateNumbers {
  const locked = isEntryLocked(entry);
  const first = locked ? lockedFact(entry, lockedWord, achievedMilestone) : holdsBack(entry, said, "cost") ? "" : costText(entry, separators) ?? "";

  if (sortsByValue(sortedMetric)) {
    return { first, second: sortedText(entry, sortedMetric, separators), glyph: null, locked };
  }

  const key = holdsBack(entry, said, keyKind) ? null : keyFigure(entry, keyKind, separators);
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

/**
 * A one-line plate's one number: under a sort by a value that value; else the cost, or where the
 * readout said the cost once, the key number by its glyph, so the row still says something of its own.
 * Blank only where the readout said both.
 */
export function oneLineNumber(entry: BuildingCatalogEntry, numbers: PlateNumbers, sortedMetric: AssetMenuMetric | null, said: readonly SharedValue[]): PlateNumbers {
  if (sortsByValue(sortedMetric) || numbers.locked || !holdsBack(entry, said, "cost")) return oneNumber(numbers, sortedMetric);

  return { first: numbers.second ?? "", second: null, glyph: numbers.second === null ? null : numbers.glyph, locked: false };
}
