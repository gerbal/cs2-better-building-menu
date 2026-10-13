/**
 * What the hover card beside the pointer says of a building: its cost, its upkeep, the view's key number
 * by its glyph and the lot where the name does not say it, each under the hover card's own word, and for
 * a locked building the milestone it waits for. A network's money reads per kilometre, as the game's own
 * panels state it. Pure. See docs/design-notes.md, "The hover card".
 */
import { formatBuildingMetric, formatCapacity, formatLotDimensions, formatSpeedLimit, groupDigits, hasFootprint, type NumberSeparators } from "./assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "./buildingCatalog";
import { isEntryLocked, lockedFact } from "./buildingLockState";
import type { HoverCardLabels } from "./hoverCardLines";
import { planName } from "./namePlan";
import { keyFigure, nameHoldsLot, type KeyKind, type UnitGlyph } from "./rowNumbers";
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

/** The key number's line: the kind the view's rows show second, under the hover card's word, with its unit. */
function keyRow(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators, labels: HoverCardLabels): CardRow | null {
  const glyph = keyFigure(entry, kind, separators)?.glyph ?? null;

  switch (kind) {
    case "capacity":
      return present(entry.capacity) ? { key: "key", label: labels.capacity, value: formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators), glyph } : null;
    case "speed": {
      const speed = formatSpeedLimit(entry.speedLimit, separators);
      return speed === "" ? null : { key: "key", label: labels.speed, value: speed, glyph };
    }
    case "workers":
      return present(entry.workers) ? { key: "key", label: labels.workers, value: `${groupDigits(entry.workers, separators)} ${labels.workersUnit}`, glyph } : null;
    default:
      // A view with no key kind of its own, or the lot's, which the lot line says: a home says its households.
      return present(entry.households) ? { key: "key", label: labels.households, value: `${groupDigits(entry.households, separators)} ${labels.householdsUnit}`, glyph: null } : null;
  }
}

/** The card's lines for a building, in the view whose key kind is `kind`. */
export function pointerCardText(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators, words: PointerCardWords, achievedMilestone: number): PointerCardText {
  const { labels } = words;
  const rows: (CardRow | null)[] = [
    typeof entry.constructionCost === "number"
      ? { key: "cost", label: labels.cost, value: formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance), glyph: null }
      : null,
    present(entry.upkeep) ? { key: "upkeep", label: labels.upkeep, value: formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance), glyph: null } : null,
    keyRow(entry, kind, separators, labels),
    // Read off the name the card draws, the prefab's where the building has none.
    hasFootprint(entry.lotWidth, entry.lotDepth) && !nameHoldsLot(entry.name || entry.prefabName || "", entry.lotWidth, entry.lotDepth)
      ? { key: "lot", label: labels.lot, value: formatLotDimensions(entry.lotWidth, entry.lotDepth), glyph: null }
      : null,
  ];
  const milestone = entry.unlockMilestone ?? 0;
  const unlock = !isEntryLocked(entry) ? null : milestone > achievedMilestone ? words.unlocksAt.replace("{0}", String(milestone)) : words.lockedWord;

  return { rows: rows.filter((row): row is CardRow => row !== null), unlock };
}

/** What Status line only says in the readout: the name on its first line, then its figures in words. */
export interface StatusLine {
  name: string;
  /** In order: a locked building's milestone, the cost, the upkeep, the key number, the lot; those that fit. */
  parts: string[];
}

/** The readout's two lines' fonts at the text scale, and the room each "·" between two figures takes: tabRow.module.scss. */
export interface StatusFonts {
  name: number;
  line: number;
  sep: number;
}

/**
 * Status line only: the pointed building's name, planned to the readout's room and cut once where it runs
 * over; then its figures with their units in words ("100 km/h"), a network's money per kilometre. Short of
 * room the lot goes first, then the upkeep, then the key number, then the cost; a locked building's
 * milestone stays.
 */
export function statusLine(entry: BuildingCatalogEntry, kind: KeyKind, separators: NumberSeparators, words: PointerCardWords, achievedMilestone: number, room: number, fonts: StatusFonts): StatusLine {
  const card = pointerCardText(entry, kind, separators, words, achievedMilestone);
  const figure = (key: string): string | null => card.rows.find((row) => row.key === key)?.value ?? null;
  const lot = figure("lot");
  // Each figure by its drop order: the highest goes first, the milestone never.
  const all: { text: string | null; drop: number }[] = [
    { text: isEntryLocked(entry) ? lockedFact(entry, words.lockedWord, achievedMilestone) : null, drop: 0 },
    { text: figure("cost"), drop: 1 },
    { text: figure("upkeep"), drop: 3 },
    { text: figure("key"), drop: 2 },
    { text: lot === null ? null : `${words.labels.lot} ${lot}`, drop: 4 },
  ];
  let kept = all.filter((part): part is { text: string; drop: number } => part.text !== null);
  const width = (parts: readonly { text: string }[]) =>
    parts.reduce((sum, part) => sum + textWidth(part.text, fonts.line), 0) + Math.max(0, parts.length - 1) * fonts.sep;
  while (width(kept) > room && kept.some((part) => part.drop > 0)) {
    const top = Math.max(...kept.map((part) => part.drop));
    kept = kept.filter((part) => part.drop !== top);
  }
  const name = planName(entry.name || entry.prefabName, { width: room, lines: 1, font: fonts.name }, { keep: [entry.distinctWord ?? ""] });

  return { name: name.lines[0] ?? "", parts: kept.map((part) => part.text) };
}
