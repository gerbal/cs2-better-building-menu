/**
 * What a tile's tag says: the plate's first number (the cost, or why a locked building waits), or under
 * a sort by a value the value sorted by, as 0.2.x's Grid drew it, so a re-sort says why the tiles moved.
 * A money figure too wide for the tag is said in thousands or millions rather than cut. Pure. See
 * docs/design-notes.md, "The bodies".
 */
import { formatCompactMoney, type NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { plateNumbers, sortsByValue } from "./listPlate";
import { sortedMetricValue } from "./sortedMetric";

/** The tag's font at 100% text, and its padding both sides together: tilesBody.module.scss's `.tag`. */
const TAG_FONT = 10;
const TAG_PADDING = 6;

/** The tag's left edge, inset from the tile's as the picture is. */
const TAG_LEFT = 2;

/**
 * Each character's advance in em, the wider of the game's first two fonts (Overpass, then Noto Sans,
 * which some languages draw in): the characters money is written with. Erring wide only compacts a
 * figure that would have fitted.
 */
const ADVANCE: Readonly<Record<string, number>> = {
  "0": 0.639, "1": 0.551, "2": 0.612, "3": 0.602, "4": 0.621, "5": 0.621, "6": 0.597, "7": 0.551, "8": 0.611, "9": 0.597,
  "¢": 0.572, "$": 0.588, "€": 0.619, "£": 0.597,
  ",": 0.25, ".": 0.268, " ": 0.26, " ": 0.26, " ": 0.2, " ": 0.2,
  "/": 0.49, "k": 0.534, "m": 0.935, "i": 0.258, "M": 0.907, "o": 0.605,
};

/** A character the table does not hold: wider than most letters. */
const UNKNOWN_ADVANCE = 0.65;

/** A run of the tag's text, in rem, at this font size. */
function tagTextWidth(text: string, fontRem: number): number {
  let em = 0;
  for (const character of text) em += ADVANCE[character] ?? UNKNOWN_ADVANCE;
  return em * fontRem;
}

/** The widest a tag may be on a tile this wide: from its left edge to the tile's, which clips it. */
export function tagRoom(tileWidth: number): number {
  return tileWidth - TAG_LEFT;
}

/** Whether a tag saying this fits a tile this wide, at this text scale, padding and all. */
export function tagFits(text: string, tileWidth: number, textScale: number): boolean {
  return TAG_PADDING + tagTextWidth(text, TAG_FONT * textScale) <= tagRoom(tileWidth);
}

export interface TileTag {
  /** "" when there is nothing to say. */
  text: string;
  /** Whether it says why the building is locked, in the locked ink. */
  locked: boolean;
}

export function tileTag(
  entry: BuildingCatalogEntry,
  sortedMetric: AssetMenuMetric | null,
  separators: NumberSeparators,
  lockedWord: string,
  achievedMilestone: number,
  tileWidth: number,
  textScale: number,
): TileTag {
  const numbers = plateNumbers(entry, sortedMetric, separators, lockedWord, achievedMilestone);
  const bySort = sortsByValue(sortedMetric);
  const text = bySort ? numbers.second ?? "" : numbers.first;
  const locked = !bySort && numbers.locked;

  if (tagFits(text, tileWidth, textScale)) {
    return { text, locked };
  }

  // Only money has a short form; anything else is cut by the stylesheet, with an ellipsis.
  const money = bySort ? (sortedMetric === "upkeep" ? sortedMetricValue(entry, "upkeep") : null) : locked ? null : entry.constructionCost;

  return typeof money === "number" && Number.isFinite(money) && money !== 0
    ? { text: formatCompactMoney(money, bySort ? "upkeep" : "cost", separators, entry.costIsPerDistance), locked }
    : { text, locked };
}
