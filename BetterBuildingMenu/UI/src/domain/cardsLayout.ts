/**
 * The Cards body: a card's words and its size, and the row packer that places the cards. A card is as
 * wide as its name or its facts line, whichever is longer, so rows end ragged; Cohtml has no flex-wrap a
 * body can trust, so each card is placed from the widths its words draw at. Pure. See
 * docs/design-notes.md, "The cards".
 */
import { formatBuildingMetric, formatCapacity, formatLotDimensions, hasFootprint, METRIC_NO_DATA, type NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import { SLOT_GAP, wholeLines } from "./bodyGeometry";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import { sortedMetricValue } from "./sortedMetric";
import { fontSizeRatio } from "./textScale";
import { listLabel } from "./tileLabel";
import { textWidth } from "./textWidth";

/** The picture, and the room either side of a card's words, at 100% text: cardsBody.module.scss's card, its border inside its padding. */
export const CARD_PICTURE = 40;
const CARD_PAD_LEFT = 5;
const CARD_PAD_RIGHT = 11;
const CARD_PICTURE_GAP = 7;

/** Between two cards, across and, at most, down. */
export const CARD_GAP = 4;

/**
 * The name's and the facts' type and lines at 100% text: the game's fontSizeS and fontSizeXS. The type
 * grows as the game's sizes do; the lines grow with the text scale, as the stylesheet draws them.
 */
const NAME_FONT = 14;
const NAME_LINE = 18;
const FACTS_FONT = 12;
const FACTS_LINE = 15;

/** The "·" between two facts, padded 5 each side; the lock before a locked card's milestone, and its gap. */
const DOT_PADDING = 5;
const LOCK_SIZE = 10;
const LOCK_GAP = 3;

/** The sorted value's column, this far right of the words. */
const SORTED_GAP = 8;

/** What a run drawn a pixel wider than its estimate costs: none of the card's words is cut by it. */
const TEXT_SLACK = 2;

/** A label plate's caps at 100% text, their tracking per character, its padding each side and the gap to its count. */
const LABEL_FONT = 10;
const LABEL_TRACKING = 0.4;
const LABEL_PADDING = 6;
const LABEL_GAP = 4;

export interface CardGeometry {
  /** A card's height: the knob's, or more where its two lines need it at large text. */
  height: number;
  /** How many rows of cards one screen of the body shows. */
  lines: number;
  rowGap: number;
  /** The first row's top: the rows' block centred in the body, or the top where it holds one row. */
  y0: number;
  pitchY: number;
}

/**
 * Rows of cards the knob's height tall, as many as the body shows a slot's gap apart (a device pixel
 * forgiven, as the list's and the tiles' lines are), then spread at most CARD_GAP apart, the block
 * centred in the body. One row a screen starts at the top, CARD_GAP above the next, so a page is whole rows.
 */
export function cardGeometry(knobHeight: number, bodyHeight: number, textScale: number, pixelRem: number = 0): CardGeometry {
  const pad = (knobHeight - CARD_PICTURE) / 2;
  const words = (NAME_LINE + FACTS_LINE) * (Number.isFinite(textScale) && textScale > 0 ? textScale : 1);
  const height = Math.max(knobHeight, Math.ceil(2 * pad + Math.max(CARD_PICTURE, words)));
  const body = Math.max(0, bodyHeight);
  const lines = wholeLines(body, height + SLOT_GAP, SLOT_GAP, pixelRem);
  const rowGap = lines > 1 ? Math.max(0, Math.min(CARD_GAP, (body - lines * height) / (lines - 1))) : CARD_GAP;
  const y0 = lines > 1 ? Math.max(0, Math.floor(((body - (lines * height + (lines - 1) * rowGap)) / 2) * 100) / 100) : 0;

  return { height, lines, rowGap, y0, pitchY: height + rowGap };
}

/** What a card says: its name, then its lot, cost and capacity; a locked card's milestone; the value sorted by. */
export interface CardText {
  name: string;
  facts: string[];
  /** "MS n", or the locked word once the city is past the milestone; null for a card that is not locked. */
  locked: string | null;
  /** The value the list is sorted by, for the column at the card's right; null under no such sort. */
  sorted: string | null;
}

const known = (text: string): string | null => (text === "" || text === METRIC_NO_DATA ? null : text);

const capacityOf = (entry: BuildingCatalogEntry, value: number | null | undefined, separators: NumberSeparators): string | null =>
  typeof value === "number" && value !== 0 ? known(formatCapacity(value, entry.category, entry.subCategory, entry.buildingType, separators)) : null;

/**
 * A card's words: the whole name (cut only past the list's cap on a name), the lot, the cost and the
 * capacity, each where the building has it; a locked card keeps its cost, its milestone beside the
 * lock; under a sort by a number, the value sorted by.
 */
export function cardText(
  entry: BuildingCatalogEntry,
  sortedMetric: AssetMenuMetric | null,
  separators: NumberSeparators,
  lockedWord: string,
  achievedMilestone: number,
): CardText {
  const facts = [
    hasFootprint(entry.lotWidth, entry.lotDepth) ? formatLotDimensions(entry.lotWidth, entry.lotDepth) : null,
    known(formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)),
    capacityOf(entry, entry.capacity, separators),
  ].filter((fact): fact is string => fact !== null);

  return {
    name: listLabel(entry.name || entry.prefabName),
    facts,
    locked: isEntryLocked(entry) ? lockedFact(entry, lockedWord, achievedMilestone) : null,
    sorted: sortedText(entry, sortedMetric, separators),
  };
}

function sortedText(entry: BuildingCatalogEntry, sortedMetric: AssetMenuMetric | null, separators: NumberSeparators): string | null {
  if (sortedMetric === null) {
    return null;
  }

  if (sortedMetric === "lot") {
    return hasFootprint(entry.lotWidth, entry.lotDepth) ? formatLotDimensions(entry.lotWidth, entry.lotDepth) : null;
  }

  const value = sortedMetricValue(entry, sortedMetric);

  if (value === null) {
    return null;
  }

  return sortedMetric === "capacity" ? capacityOf(entry, value, separators) : known(formatBuildingMetric(value, sortedMetric, separators, entry.costIsPerDistance));
}

/** A card's width: its picture and padding, its name or its facts line, whichever is longer, and the sorted value's column. */
export function cardWidth(text: CardText, textScale: number): number {
  const nameFont = NAME_FONT * fontSizeRatio("s", textScale);
  const factsFont = FACTS_FONT * fontSizeRatio("xs", textScale);
  const dot = textWidth("·", factsFont) + 2 * DOT_PADDING;
  const runs = text.facts.map((fact) => textWidth(fact, factsFont));
  const lock = text.locked === null ? 0 : LOCK_SIZE * textScale + LOCK_GAP + textWidth(text.locked, factsFont) + (runs.length > 0 ? dot : 0);
  const facts = lock + runs.reduce((sum, run) => sum + run, 0) + Math.max(0, runs.length - 1) * dot;
  const sorted = text.sorted === null ? 0 : SORTED_GAP + textWidth(text.sorted, nameFont);

  return CARD_PAD_LEFT + CARD_PICTURE + CARD_PICTURE_GAP + Math.max(textWidth(text.name, nameFont), facts) + TEXT_SLACK + sorted + CARD_PAD_RIGHT;
}

/** A label plate's width among the cards: the words it draws in caps, then its count, on a plate of their own. */
export function labelWidth(label: string, count: string, textScale: number): number {
  const font = LABEL_FONT * textScale;
  const caps = label.toUpperCase();

  // The plate tracks every character it draws, the count's too.
  return 2 * LABEL_PADDING + textWidth(caps, font) + LABEL_GAP + textWidth(count, font) + (caps.length + count.length) * LABEL_TRACKING + TEXT_SLACK;
}

/** A cell the packer places: its width, and whether it starts a row of its own and takes the whole of it. */
export interface PackInput {
  width: number;
  ownLine?: boolean;
}

export interface PackedCell {
  left: number;
  row: number;
  width: number;
}

/** Each cell after the last, CARD_GAP apart, a cell that would pass the row's end starting the next row. */
export function packCards(cells: readonly PackInput[], rowWidth: number): PackedCell[] {
  const packed: PackedCell[] = [];
  let x = 0;
  let row = 0;

  for (const cell of cells) {
    if (cell.ownLine) {
      if (x > 0) row += 1;
      packed.push({ left: 0, row, width: rowWidth });
      row += 1;
      x = 0;
      continue;
    }

    const width = Math.min(cell.width, rowWidth);

    if (x > 0 && x + width > rowWidth + 0.01) {
      row += 1;
      x = 0;
    }

    packed.push({ left: x, row, width });
    x += width + CARD_GAP;
  }

  return packed;
}
