/**
 * What a tile's tag says: the plate's first number (the cost, or why a locked building waits), or under
 * a sort by a value the value sorted by, as 0.2.x's Grid drew it, so a re-sort says why the tiles moved.
 * A money figure too wide for the tag is said in thousands or millions, shortened a step at a time,
 * rather than cut; a tag drops only a unit every tile beside it shares. Pure. See docs/design-notes.md,
 * "The bodies".
 */
import { compactCostPerCellForms, compactMoneyForms, compactUnitForms, type NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { BuildingCatalogEntry, SharedValue } from "./buildingCatalog";
import { oneNumber, plateNumbers } from "./listPlate";
import { isPerCell, keepsUnit, sortsByValue } from "./rowNumbers";
import { NOTHING_SAID } from "./saidOnce";
import { sortedMetricValue } from "./sortedMetric";
import { textWidth } from "./textWidth";

/** The tag's font at 100% text, and its padding both sides together: tilesBody.module.scss's `.tag`. */
const TAG_FONT = 10;
const TAG_PADDING = 6;

/** The tag's left edge, inset from the tile's as the picture is. */
const TAG_LEFT = 2;

/** The widest a tag may be on a tile this wide: from its left edge to the tile's, which clips it. */
export function tagRoom(tileWidth: number): number {
  return tileWidth - TAG_LEFT;
}

/** Whether a tag saying this fits a tile this wide, at this text scale, padding and all. */
export function tagFits(text: string, tileWidth: number, textScale: number): boolean {
  // The wider of the game's two fonts: erring wide only says a figure short that would have fitted.
  return TAG_PADDING + textWidth(text, TAG_FONT * textScale, "wider") <= tagRoom(tileWidth);
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

  // Money has short forms: a network's per cell, a building's whole.
  const money = bySort ? (sortedMetric === "upkeep" ? sortedMetricValue(entry, "upkeep") : null) : locked ? null : entry.constructionCost;

  // The most exact form that fits; where none does, the narrowest, which the stylesheet cuts least.
  if (typeof money === "number" && Number.isFinite(money) && money !== 0) {
    const forms = isPerCell(entry) ? compactCostPerCellForms(money, separators) : compactMoneyForms(money, separators);
    const fits = forms.find((form) => tagFits(form, tileWidth, textScale));
    const narrowest = forms.reduce((least, form) => (textWidth(form, 1, "wider") < textWidth(least, 1, "wider") ? form : least));

    return { text: fits ?? narrowest, locked };
  }

  // A unit that scales with its size stays, its number shortened: two such figures bare side by side
  // read as one scale. Any other sorted value keeps its whole number and drops its unit, which the Sort
  // control names: a cut word reads as noise. Anything else is cut by the stylesheet, with an ellipsis.
  if (bySort && keepsUnit(entry, sortedMetric)) {
    const forms = compactUnitForms(text, separators);
    return { text: forms.find((form) => tagFits(form, tileWidth, textScale)) ?? forms[forms.length - 1], locked };
  }

  return { text: bySort ? leadingNumber(text) ?? text : text, locked };
}

/** The number a value starts with, digit to digit with its group and decimal marks; null when it starts with none. */
function leadingNumber(text: string): string | null {
  return /^-?\d(?:[\d\s.,'’]*\d)?/u.exec(text)?.[0] ?? null;
}
