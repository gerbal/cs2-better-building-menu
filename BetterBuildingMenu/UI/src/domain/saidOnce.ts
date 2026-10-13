/**
 * The said-once rule: which of a view's shared values the readout says, what it says of them, and which
 * cells a row leaves blank because the readout said them. A blank number cell only ever means the
 * readout's value. Pure. See docs/design-notes.md, "Numbers said once".
 */
import { formatBuildingMetric, formatLotDimensions, formatSpeedLimit, groupDigits, speedNumber, type NumberSeparators } from "./assetMenuMetricFormat";
import type { AssetMenuMetric } from "./assetMenuLayout";
import type { ListForm } from "./bodyGeometry";
import type { DrawnBody } from "./bodyChoice";
import type { BuildingCatalogEntry, SharedValue, ViewFacts } from "./buildingCatalog";
import { capacityText, costText, keyFigure, sortsByValue, type KeyKind, type UnitGlyph } from "./rowNumbers";

/** Nothing said: every row prints every value it shows. */
export const NOTHING_SAID: readonly SharedValue[] = [];

/** A kind a body shows a value of: the cost, or a key kind. */
export type ShownKind = SharedValue["kind"];

/** The readout's legend, longest first: the values in full, "others" and the value, the digits alone, or none. */
export type LegendForm = "full" | "short" | "bare" | "none";

/** The legend's forms, longest first, each tried before the next. */
export const LEGEND_FORMS: readonly LegendForm[] = ["full", "short", "bare", "none"];

/** One part of the legend: a value said once, or the key kind named, with the glyph for its unit. */
export interface LegendPart {
  glyph: UnitGlyph | null;
  text: string;
}

/** The legend's words, in the game's language where the game has them. */
export interface LegendWords {
  /** "{0} unless shown". */
  unlessShown: string;
  /** "others {0}", the short form. */
  others: string;
  /** "jobs", after a number of workers. */
  workersUnit: string;
  /** Each key kind's name, said where no value is said once. */
  kinds: Readonly<Record<Exclude<KeyKind, "">, string>>;
}

/**
 * The kinds of value the body shows a row's number of, which the readout may say once: none in the
 * cards, whose card says each of its own; one number on a one-line plate or a tile's tag, the cost
 * (none under a sort by a value, which takes its place); else the cost and the key number, or the cost
 * alone where a sort by a value takes the key number's place.
 */
export function shownKinds(body: DrawnBody, form: ListForm, sortedMetric: AssetMenuMetric | null, keyKind: KeyKind): readonly ShownKind[] {
  if (body === "cards") return [];
  if (body === "tiles" || form === "plate1") return sortsByValue(sortedMetric) ? [] : ["cost"];
  return keyKind === "" || sortsByValue(sortedMetric) ? ["cost"] : ["cost", keyKind];
}

/** The view's shared values the body shows, in the order C# sends them: the ones the readout may say. */
export function statedValues(facts: ViewFacts, shown: readonly ShownKind[]): readonly SharedValue[] {
  return facts.sharedValues.filter((value) => shown.includes(value.kind));
}

/** Whether a row holds a value of this kind that the readout said, so its cell is left blank. */
export function holdsBack(entry: BuildingCatalogEntry, said: readonly SharedValue[], kind: ShownKind | KeyKind): boolean {
  const value = said.find((candidate) => candidate.kind === kind);
  if (value === undefined) return false;

  switch (value.kind) {
    case "speed":
      return typeof entry.speedLimit === "number" && Math.round(entry.speedLimit) === value.value;
    case "capacity":
      return entry.capacity === value.value;
    case "workers":
      return entry.workers === value.value;
    case "lot":
      return entry.lotWidth === value.value && entry.lotDepth === value.depth;
    default:
      return entry.constructionCost === value.value;
  }
}

/** A row of the window that holds the value, whose own unit and glyph say it; null where none does. */
const holder = (value: SharedValue, entries: readonly BuildingCatalogEntry[]): BuildingCatalogEntry | null =>
  entries.find((entry) => holdsBack(entry, [value], value.kind)) ?? null;

/** A value as the readout says it: with its unit, or its digits alone, which the glyph and the rows' own say. */
function valueText(value: SharedValue, entries: readonly BuildingCatalogEntry[], separators: NumberSeparators, words: LegendWords, bare: boolean): string {
  const row = holder(value, entries);

  switch (value.kind) {
    case "speed":
      return bare ? speedNumber(value.value, separators) : formatSpeedLimit(value.value, separators);
    case "capacity": {
      const key = row === null ? null : keyFigure(row, "capacity", separators);
      // A measure keeps its unit even bare: only a count's unit is the glyph's to say.
      return bare && key !== null ? key.text : (row === null ? null : capacityText(row, value.value, separators)) ?? groupDigits(value.value, separators);
    }
    case "workers":
      return bare ? groupDigits(value.value, separators) : `${groupDigits(value.value, separators)} ${words.workersUnit}`;
    case "lot":
      return formatLotDimensions(value.value, value.depth);
    default:
      return (row === null ? null : costText(row, separators)) ?? formatBuildingMetric(value.value, "cost", separators);
  }
}

/** The glyph a value's kind draws by: a capacity's only where it counts, read off a row that holds it. */
function glyphOf(kind: ShownKind, value: SharedValue | null, entries: readonly BuildingCatalogEntry[], separators: NumberSeparators): UnitGlyph | null {
  switch (kind) {
    case "speed":
      return "gauge";
    case "workers":
      return "case";
    case "lot":
      return "grid";
    case "capacity": {
      const row = value === null ? entries.find((entry) => typeof entry.capacity === "number" && entry.capacity > 0) ?? null : holder(value, entries);
      return row === null ? "person" : keyFigure(row, "capacity", separators)?.glyph ?? null;
    }
    default:
      return null;
  }
}

/**
 * The legend in a form: each value said once, by its glyph ("100 km/h unless shown", "others 100 km/h",
 * "others 100"); with none said, the key kind's glyph and name, where the body shows it. Empty in the
 * form "none", and where there is nothing to say.
 */
export function legendParts(
  stated: readonly SharedValue[],
  keyKind: KeyKind,
  shown: readonly ShownKind[],
  entries: readonly BuildingCatalogEntry[],
  separators: NumberSeparators,
  words: LegendWords,
  form: LegendForm,
): LegendPart[] {
  if (form === "none") return [];

  if (stated.length === 0) {
    return keyKind !== "" && shown.includes(keyKind) ? [{ glyph: glyphOf(keyKind, null, entries, separators), text: words.kinds[keyKind] }] : [];
  }

  return stated.map((value) => {
    const text = valueText(value, entries, separators, words, form === "bare");
    return {
      glyph: glyphOf(value.kind, value, entries, separators),
      text: (form === "full" ? words.unlessShown : words.others).replace("{0}", text),
    };
  });
}
