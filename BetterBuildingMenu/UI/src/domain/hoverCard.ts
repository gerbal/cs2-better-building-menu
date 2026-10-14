/**
 * What the hover card beside the pointer says of a building: its cost, its upkeep, the view's key number
 * with its unit in words, its glyph where the look draws them, and the lot where the name does not say
 * it, each under the hover card's own word, and for a locked building the milestone it waits for. A
 * network's money reads per kilometre, as the game's own panels state it. Pure. See
 * docs/design-notes.md, "The hover card".
 */
import { formatBuildingMetric, formatLotDimensions, groupDigits, hasFootprint, type NumberSeparators } from "./assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import type { HoverCardLabels } from "./hoverCardLines";
import { planName } from "./namePlan";
import { keyFigure, nameHoldsLot, type KeyKind, type UnitGlyph, type UnitMode } from "./rowNumbers";
import { textWidth } from "./textWidth";

/** The hover card's three forms, as the Hover card row stores them. */
export type HoverCardForm = "pointer" | "slot" | "status";

/** The Hover card row's value: one of the three, anything else reads as beside the pointer. */
export function hoverCardForm(value: string | null | undefined): HoverCardForm {
  return value === "slot" || value === "status" ? value : "pointer";
}

/** One line of the card's table: the word, the figure, and the key number's glyph beside the word. */
export interface CardRow {
  key: "cost" | "upkeep" | "key" | "lot";
  label: string;
  value: string;
  glyph: UnitGlyph | null;
}

export interface PointerCardText {
  rows: CardRow[];
  /** "Unlocks at milestone n" for a building a milestone holds back, the locked word for another; null for one that is not locked. */
  unlock: string | null;
}

/** The words the card says beyond the hover card's labels. */
export interface PointerCardWords {
  labels: HoverCardLabels;
  /** "Unlocks at milestone {0}". */
  unlocksAt: string;
  lockedWord: string;
}

const present = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value !== 0;

/**
 * The key number's line: the kind the view's rows show second, under the hover card's word, said with its
 * unit by the rows' own word rule (`keyFigure`), a count the game gives no unit bare under its label; its
 * glyph only in a look that draws them.
 */
function keyRow(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators, labels: HoverCardLabels, units: UnitMode): CardRow | null {
  const glyph = units === "word" ? null : keyFigure(entry, kind, separators)?.glyph ?? null;
  const said = (label: string): CardRow | null => {
    const figure = keyFigure(entry, kind, separators, { mode: "word", workersUnit: labels.workersUnit, labelled: true });
    return figure === null ? null : { key: "key", label, value: figure.text, glyph };
  };

  switch (kind) {
    case "capacity":
      return said(labels.capacity);
    case "speed":
      return said(labels.speed);
    case "workers":
      return said(labels.workers);
    default:
      // A view with no key kind of its own, or the lot's, which the lot line says: a home says its households.
      return present(entry.households) ? { key: "key", label: labels.households, value: `${groupDigits(entry.households, separators)} ${labels.householdsUnit}`, glyph: null } : null;
  }
}

/** The card's lines for a building, in the view whose key kind is `kind`, its key number's glyph as the look marks units. */
export function pointerCardText(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators, words: PointerCardWords, achievedMilestone: number, units: UnitMode = "glyph"): PointerCardText {
  const { labels } = words;
  const rows: (CardRow | null)[] = [
    typeof entry.constructionCost === "number"
      ? { key: "cost", label: labels.cost, value: formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance), glyph: null }
      : null,
    present(entry.upkeep) ? { key: "upkeep", label: labels.upkeep, value: formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance), glyph: null } : null,
    keyRow(entry, kind, separators, labels, units),
    // Read off the name the card draws, the prefab's where the building has none.
    hasFootprint(entry.lotWidth, entry.lotDepth) && !nameHoldsLot(entry.name || entry.prefabName || "", entry.lotWidth, entry.lotDepth)
      ? { key: "lot", label: labels.lot, value: formatLotDimensions(entry.lotWidth, entry.lotDepth), glyph: null }
      : null,
  ];
  const milestone = entry.unlockMilestone ?? 0;
  const unlock = !isEntryLocked(entry) ? null : milestone > achievedMilestone ? words.unlocksAt.replace("{0}", String(milestone)) : words.lockedWord;

  return { rows: rows.filter((row): row is CardRow => row !== null), unlock };
}

/** What Status line only says in the readout: the name, then its figures in words. */
export interface StatusLine {
  name: string;
  /** In order: a locked building's milestone, the cost, the upkeep, the key number, the lot; those that fit. */
  parts: string[];
  /** Every figure it could say, in the same order, fitting or not: what the readout measures as drawn. */
  figures: string[];
  /** The name and the figures share one line, as the readout does above 100% text, where two lines do not fit the row. */
  oneLine: boolean;
}

/**
 * The readout's texts as the game drew them, in rem: names and figures by their text, and a "·" with its
 * padding; null or missing where not drawn yet, which the estimate stands in for.
 */
export interface StatusDrawn {
  names: ReadonlyMap<string, number>;
  figures: ReadonlyMap<string, number>;
  sep: number | null;
}

/** Nothing drawn yet: every width is the estimate's. */
export const NOTHING_DRAWN: StatusDrawn = { names: new Map(), figures: new Map(), sep: null };

/** The readout's two lines' fonts at the text scale, and the room each "·" between two figures takes: tabRow.module.scss. */
export interface StatusFonts {
  name: number;
  line: number;
  sep: number;
}

/** A key number that is a bare count, with no unit in words and, in the readout, no glyph to say what it counts. */
const BARE_NUMBER = /^[\d\s.,'\u2019\u00A0\u202F]+$/;

/**
 * Status line only: the pointed building's name, planned to the readout's room and cut once where it runs
 * over; then its figures with their units in words ("100 km/h"), a network's money per kilometre. Short of
 * room the lot goes first, then the upkeep, then the key number, then the cost; a locked building's
 * milestone stays. In one line (above 100% text) the name comes first and keeps its room less the
 * milestone's, and the figures that fit follow it by the same order. Each text is as wide as `drawn`
 * says the game drew it, else as the estimate makes it.
 */
export function statusLine(
  entry: BuildingCatalogEntry,
  kind: KeyKind,
  separators: NumberSeparators,
  words: PointerCardWords,
  achievedMilestone: number,
  room: number,
  fonts: StatusFonts,
  oneLine = false,
  drawn: StatusDrawn = NOTHING_DRAWN,
): StatusLine {
  const card = pointerCardText(entry, kind, separators, words, achievedMilestone);
  const figure = (key: string): string | null => card.rows.find((row) => row.key === key)?.value ?? null;
  const lot = figure("lot");
  const key = card.rows.find((row) => row.key === "key");
  // Each figure by its drop order: the highest goes first, the milestone never.
  const all: { text: string | null; drop: number }[] = [
    { text: isEntryLocked(entry) ? lockedFact(entry, words.lockedWord, achievedMilestone) : null, drop: 0 },
    { text: figure("cost"), drop: 1 },
    { text: figure("upkeep"), drop: 3 },
    // The card says a bare count by a glyph; the readout has none, so the word goes with it.
    { text: key === undefined ? null : BARE_NUMBER.test(key.value) ? `${key.label} ${key.value}` : key.value, drop: 2 },
    { text: lot === null ? null : `${words.labels.lot} ${lot}`, drop: 4 },
  ];
  let kept = all.filter((part): part is { text: string; drop: number } => part.text !== null);
  const figures = kept.map((part) => part.text);
  const sep = drawn.sep ?? fonts.sep;
  const texts = (parts: readonly { text: string }[]) => parts.reduce((sum, part) => sum + (drawn.figures.get(part.text) ?? textWidth(part.text, fonts.line)), 0);
  const width = (parts: readonly { text: string }[]) => texts(parts) + Math.max(0, parts.length - 1) * sep;
  const fullName = entry.name || entry.prefabName || "";
  const keep = entry.distinctWord ? [entry.distinctWord] : [];
  const nameIn = (width: number) => planName(fullName, { width, lines: 1, font: fonts.name }, { keep }).lines[0] ?? "";

  if (!oneLine) {
    while (width(kept) > room && kept.some((part) => part.drop > 0)) {
      const top = Math.max(...kept.map((part) => part.drop));
      kept = kept.filter((part) => part.drop !== top);
    }
    return { name: nameIn(room), parts: kept.map((part) => part.text), figures, oneLine };
  }

  // One line: the name, then a "·" before each figure. The name is planned in what the milestone leaves it.
  const milestone = kept.filter((part) => part.drop === 0);
  const name = nameIn(Math.max(0, room - (milestone.length > 0 ? width(milestone) + sep : 0)));
  const named = drawn.names.get(name) ?? textWidth(name, fonts.name);
  const line = () => named + texts(kept) + kept.length * sep;
  while (line() > room && kept.some((part) => part.drop > 0)) {
    const top = Math.max(...kept.map((part) => part.drop));
    kept = kept.filter((part) => part.drop !== top);
  }

  return { name, parts: kept.map((part) => part.text), figures, oneLine };
}
