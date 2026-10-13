/**
 * What a list plate's number column says: the cost over the key number, or, for a locked building,
 * the milestone it waits on (or the locked word) in the cost's place; where there is room for one
 * number, which of them. Pure, so the rules are tests. See docs/design-notes.md, "The bodies".
 */
import type { NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import { LARGE_PICTURE, type BodyGrid } from "./bodyGeometry";
import type { BuildingCatalogEntry, SharedValue } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import { costText, keyFigure, sortedText, sortsByValue, type KeyKind, type UnitGlyph } from "./rowNumbers";
import { holdsBack, missingCost, missingFigure, NOTHING_SAID } from "./saidOnce";
import { textWidth } from "./textWidth";

export interface PlateNumbers {
  /** The cost, or for a locked building "MS n" or the locked word; "" when it has neither. */
  first: string;
  /** The sorted value under a numeric sort, else the key number; null when there is none. */
  second: string | null;
  /** The glyph beside the key number, for the unit the readout names; null for a figure that says its own. */
  glyph: UnitGlyph | null;
  /** Whether the first says why the building is locked, in the locked ink. */
  locked: boolean;
  /** Whether the first is the key number, moved to a one-line plate's cost's place: in the key number's ink. */
  firstIsKey?: boolean;
}

/**
 * The plate's numbers. Under a sort by a number the second is the value sorted by, with its unit, so
 * the order reads down the column; otherwise the view's key number, by its glyph. A value the readout
 * said once is left blank, and a row with no value of a stated kind says "–": a blank cell only ever
 * means the readout's value.
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
  const first = locked ? lockedFact(entry, lockedWord, achievedMilestone) : holdsBack(entry, said, "cost") ? "" : costText(entry, separators) ?? missingCost(said);

  if (sortsByValue(sortedMetric)) {
    return { first, second: sortedText(entry, sortedMetric, separators), glyph: null, locked };
  }

  const key = holdsBack(entry, said, keyKind, separators) ? null : keyFigure(entry, keyKind, separators) ?? missingFigure(entry, said, keyKind);
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

  return { first: numbers.second ?? "", second: null, glyph: numbers.second === null ? null : numbers.glyph, locked: false, firstIsKey: true };
}

/** A plate's padding either side together and the gap between its picture, name and numbers, at 100% text: listBody.module.scss. */
const PLATE_PADDING = 1 + 4;
const PLATE_GAP = 3;
const BIG_PADDING = 2 + 6;
const BIG_GAP = 6;

/** The picture's side: 25 at 100% text, LARGE_PICTURE above it; a big plate's is the grid's. */
const PICTURE = 25;

/**
 * The number column's type, and a glyph's and ↵'s side, at 100% text, all growing with the text; the
 * gap between a mark and its number, which does not.
 */
const NUMBER_FONT = 10;
const MARK = 10;
const GLYPH = 9;
const MARK_GAP = 2;

/** A list name's type at 100% text. */
export const NAME_FONT = 11;

/**
 * The room a plate's name is planned in, in rem: the plate less its padding, its picture and its gaps,
 * and beside the name the number column, as wide as its wider line; a big plate's name sits over its
 * numbers and takes the room beside the picture.
 */
export function plateNameRoom(grid: BodyGrid, numbers: PlateNumbers, enter: boolean, textScale: number): number {
  if (grid.form === "big") return Math.max(0, grid.cellWidth - BIG_PADDING - grid.picture - BIG_GAP);

  const font = NUMBER_FONT * textScale;
  const mark = (side: number) => side * textScale + MARK_GAP;
  // A one-line plate's key number keeps its glyph on the first line.
  const firstGlyph = numbers.second === null && numbers.glyph !== null ? mark(GLYPH) : 0;
  const first = (enter ? mark(MARK) : 0) + firstGlyph + textWidth(numbers.first, font);
  const second = numbers.second === null ? 0 : (numbers.glyph === null ? 0 : mark(GLYPH)) + textWidth(numbers.second, font);
  const picture = grid.form === "plate2" ? PICTURE : LARGE_PICTURE;

  return Math.max(0, grid.cellWidth - PLATE_PADDING - picture - 2 * PLATE_GAP - Math.max(first, second));
}
