/**
 * What a tile's tag says: the plate's first number (the cost, or why a locked building waits), or under
 * a sort by a value the value sorted by, as 0.2.x's Grid drew it, so a re-sort says why the tiles moved.
 * A money figure too wide for the tag is said in thousands or millions, shortened a step at a time,
 * rather than cut, and where no form fits, not said; a tag drops only a unit every tile beside it shares,
 * and a word that still runs over is cut by the name planner, with "…". Pure. See docs/design-notes.md, "The bodies".
 */
import { compactCostPerCellForms, compactMoneyForms, compactUnitForms, type NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry, SharedValue } from "./buildingCatalog";
import { oneNumber, plateNumbers } from "./listPlate";
import { CUT_MARK, planName } from "./namePlan";
import { isPerCell, keepsUnit, sortsByValue } from "./rowNumbers";
import { NOTHING_SAID } from "./saidOnce";
import { sortedMetricValue } from "./sortedMetric";
import { textWidth } from "./textWidth";

/** The tag's font at 100% text, and its padding both sides together: tilesBody.module.scss's `.tag`. */
const TAG_FONT = 10;
const TAG_PADDING = 6;

/** The tag's left edge, inset from the tile's as the picture is. */
const TAG_LEFT = 2;

/** What a locked tile's lock glyph takes at its top right, from the tile's edge: tilesBody.module.scss's `.lockGlyph`. */
const LOCK_GLYPH_ROOM = 17;

/**
 * The widest a tag may be on a tile this wide: from its left edge to the tile's, which clips it; at the
 * top of a locked tile, to its lock glyph, which a tag never covers.
 */
export function tagRoom(tileWidth: number, besideLock = false): number {
  return tileWidth - TAG_LEFT - (besideLock ? LOCK_GLYPH_ROOM : 0);
}

/** Whether a tag saying this fits a tile this wide, at this text scale, padding and all. */
export function tagFits(text: string, tileWidth: number, textScale: number, besideLock = false): boolean {
  // The wider of the game's two fonts: erring wide only says a figure short that would have fitted.
  return TAG_PADDING + textWidth(text, TAG_FONT * textScale, "wider") <= tagRoom(tileWidth, besideLock);
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
  said: readonly SharedValue[] = NOTHING_SAID,
): TileTag {
  // A cost the readout said once leaves the tag blank, as a list plate's cell.
  const { first: text, locked } = oneNumber(plateNumbers(entry, sortedMetric, separators, lockedWord, achievedMilestone, "capacity", said), sortedMetric);
  const bySort = sortsByValue(sortedMetric);

  // The plate's text keeps every unit that tells the tiles apart: a network's cell, an upkeep without
  // the month every tile shares.
  if (tagFits(text, tileWidth, textScale)) {
    return { text, locked };
  }

  const money = bySort ? (sortedMetric === "upkeep" ? sortedMetricValue(entry, "upkeep") : null) : locked ? null : entry.constructionCost;

  // Money has short forms, a network's per cell and a building's whole, and so has a unit that scales
  // with its size, its unit kept: two such figures bare side by side read as one scale.
  if (typeof money === "number" && Number.isFinite(money) && money !== 0) {
    return { text: fittingForm(isPerCell(entry) ? compactCostPerCellForms(money, separators) : compactMoneyForms(money, separators), tileWidth, textScale), locked };
  }
  if (bySort && keepsUnit(entry, sortedMetric)) {
    return { text: fittingForm(compactUnitForms(text, separators), tileWidth, textScale), locked };
  }

  // Any other sorted value keeps its whole number and drops its unit, which the Sort control names: a
  // cut word reads as noise, and a number too long for the tag is not said, as a clipped one reads as a
  // smaller one. A word, the locked word, that still runs over is cut by the name planner, with "…".
  const number = bySort ? leadingNumber(text) : null;
  if (number !== null) return { text: tagFits(number, tileWidth, textScale) ? number : "", locked };
  return { text: cutToTag(text, tileWidth, textScale), locked };
}

/**
 * The most exact of a figure's forms that fits the tag; where none does, no tag: a figure is never cut
 * nor clipped, as a cut number reads as another number, and a clipped unit as another unit ("500MW" for
 * 500 MWh).
 */
function fittingForm(forms: readonly string[], tileWidth: number, textScale: number): string {
  return forms.find((form) => tagFits(form, tileWidth, textScale)) ?? "";
}

/** How a tag is cut: beside a lock glyph or not, the words it keeps, and the measure that decides it fits. */
interface TagCut {
  besideLock?: boolean;
  keep?: readonly string[];
  fits?: typeof tagFits;
}

/**
 * A tag's words that fit it, cut once by the name planner where they run over: "…" where they were cut,
 * never a clip, as Cohtml draws no CSS ellipsis, every word `keep` holds and every number whole; the mark
 * alone where no letter fits beside it.
 */
export function cutToTag(text: string, tileWidth: number, textScale: number, { besideLock = false, keep = [], fits = tagFits }: TagCut = {}): string {
  const fitsTag = (line: string) => fits(line, tileWidth, textScale, besideLock);
  if (fitsTag(text)) return text;

  // From the tag's room down, each step narrowed by what the last cut ran over in the tag's measure: the
  // planner measures one font and the tag the wider of two. Where the planner draws no line (a kept word
  // or a number it would have to cut) no narrower room draws one, so the search stops there.
  const font = TAG_FONT * textScale;
  for (let room = Math.floor(tagRoom(tileWidth, besideLock) - TAG_PADDING); room > 0;) {
    const [line = ""] = planName(text, { width: room, lines: 1, font }, { keep, lastResort: false }).lines;
    if (line === "") break;
    if (fitsTag(line)) return line;
    room -= Math.max(1, Math.ceil(TAG_PADDING + textWidth(line, font, "wider") - tagRoom(tileWidth, besideLock)));
  }

  // No letter fits beside the mark: the mark alone still says a word was cut.
  return CUT_MARK;
}

/** The number a value starts with, digit to digit with its group and decimal marks; null when it starts with none. */
function leadingNumber(text: string): string | null {
  return /^-?\d(?:[\d\s.,'’]*\d)?/u.exec(text)?.[0] ?? null;
}
