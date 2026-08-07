import type { BuildingLensMetric } from "./buildingLensLayout";

/**
 * Formatting for the Building Lens metric cells.
 *
 * Two problems this solves.
 *
 * First, grouping. The table formatted numbers with `toLocaleString()`, but the
 * archived Gameface captures show five-figure construction costs rendered with
 * no thousands separator at all — Cohtml's `Intl` is not the browser's. Digits
 * are grouped explicitly here so a cost reads as 80 000 rather than 80000, and
 * so the result does not depend on a runtime capability we cannot rely on.
 *
 * Which separator is a second question, and not one this module should answer
 * on its own: a hardcoded space made our numbers disagree with the game's on
 * the same screen. The game groups with the same regex used below and takes the
 * separator from its loc dictionary, so we ask the same dictionary — see
 * `getNumberSeparators`. No locale tag is exposed to mods, so this is not only
 * the tidier route, it is the only one that can agree with the screen.
 *
 * Second, units. A bare "5000" in an Upkeep column does not say per what, and
 * an empty cell did not distinguish "this building has no parking" from "we
 * have no data". Both are now stated.
 */

/** Rendered when a metric was not projected for this building. */
export const METRIC_NO_DATA = "—";

/** Rendered when a building genuinely has none of a countable thing. */
export const METRIC_NONE = "0";

/**
 * A construction cost of exactly zero — real, and different from unknown.
 *
 * English here rather than a locale key because this module is pure and cannot
 * call `translate`; it is registered in `localizableStrings` as debt alongside
 * the rest of the strings the domain returns as text.
 */
export const METRIC_FREE = "Free";

// Fallbacks only. The separator a player expects is the one the game is already
// using two panels away, and the game reads it from its own loc dictionary
// rather than hardcoding it — index.js groups digits with a regex identical to
// the one below and substitutes Common.THOUSANDS_SEPARATOR. Asking the same
// dictionary is what makes our "1,416,788" agree with the game's.
//
// The earlier note here was right to reject a hardcoded comma (a decimal
// separator in much of Europe) and wrong to conclude a hardcoded space. A
// no-break space is the fallback because Cohtml treats a plain U+0020 between
// digits as a line-break opportunity and will split a number across two lines —
// the same trap formatLotDimensions was written to dodge, and the game itself
// normalizes a plain space to U+00A0 for exactly this reason.
const FALLBACK_GROUP_SEPARATOR = " ";
const FALLBACK_DECIMAL_SEPARATOR = ".";
const THOUSANDS_SEPARATOR_KEY = "Common.THOUSANDS_SEPARATOR";
const DECIMAL_SEPARATOR_KEY = "Common.DECIMAL_SEPARATOR";

/** The `translate` from `useLocalization`, kept structural so this stays pure. */
export type Translate = (id: string, fallback?: string | null) => string | null;

export interface NumberSeparators {
  group: string;
  decimal: string;
}

export const FALLBACK_SEPARATORS: NumberSeparators = {
  group: FALLBACK_GROUP_SEPARATOR,
  decimal: FALLBACK_DECIMAL_SEPARATOR,
};

function resolveSeparator(translate: Translate | undefined, key: string, fallback: string): string {
  if (!translate) return fallback;

  const value = translate(key, fallback);
  // translate() echoes the id back when a key is missing, and an id is not a
  // separator — without this check a missing key renders "1Common.THOUSANDS_SEPARATOR416".
  if (typeof value !== "string" || value === "" || value === key) return fallback;

  return value === " " ? FALLBACK_GROUP_SEPARATOR : value;
}

/** The player's own separators, read from the game's dictionary. */
export function getNumberSeparators(translate?: Translate): NumberSeparators {
  return {
    group: resolveSeparator(translate, THOUSANDS_SEPARATOR_KEY, FALLBACK_GROUP_SEPARATOR),
    decimal: resolveSeparator(translate, DECIMAL_SEPARATOR_KEY, FALLBACK_DECIMAL_SEPARATOR),
  };
}

export function groupDigits(value: number, separators: NumberSeparators = FALLBACK_SEPARATORS): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  const negative = rounded < 0;
  const [whole, fraction] = Math.abs(rounded).toString().split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separators.group);
  const rendered = fraction ? `${grouped}${separators.decimal}${fraction}` : grouped;

  return negative ? `-${rendered}` : rendered;
}

/**
 * Formats one metric cell. `null` means the metric was never projected for this
 * building, which is different from a real zero.
 */
export function formatBuildingMetric(
  value: number | null | undefined,
  metric: BuildingLensMetric,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return METRIC_NO_DATA;
  }

  const digits = groupDigits(value, separators);

  switch (metric) {
    case "upkeep":
      // The game bills upkeep monthly; without this the column is a bare
      // number the player cannot compare against anything.
      return `${digits}/mo`;
    case "cost":
      // A zero here is real, not missing: the indexer leaves the cost null when
      // no PlaceableObjectData is present, and vanilla likewise renders an
      // authored zero as a zero. But a lone "0" beside the "—" that Workers and
      // Capacity show for absence reads as a third kind of nothing. Naming it
      // says which kind it is, and leaves the dash meaning only "not known".
      return value === 0 ? METRIC_FREE : digits;
    default:
      return digits;
  }
}

/**
 * What a building's Capacity column actually counts.
 *
 * One shared "Capacity" column carried students, hospital beds, and megawatts,
 * so the figures were mutually incomparable while looking like one series.
 * The unit is derived from the vanilla taxonomy the row already carries.
 */
/**
 * Units by the component-derived role.
 *
 * Find It's own method: classify by what the prefab carries, not by what its
 * category is called. Substring-matching the category worked but was wrong at
 * the edges — "police" matched a prison and called its prisoners "vehicles",
 * and deathcare storage was reported as "patients".
 */
const ROLE_UNITS: Record<string, string> = {
  School: "students",
  Hospital: "patients",
  DeathcareFacility: "plots",
  PowerPlant: "MW",
  WaterPumpingStation: "m³",
  SewageOutlet: "m³",
  WastewaterTreatmentPlant: "m³",
  GarbageFacility: "t",
  FireStation: "vehicles",
  PoliceStation: "vehicles",
  Prison: "prisoners",
  EmergencyShelter: "people",
};

export function getCapacityUnitLabel(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  role?: string | null,
): string {
  // The role is authoritative where there is one; the category match below is
  // the fallback for anything the indexer found no service component on.
  if (typeof role === "string" && role.trim() !== "") {
    const unit = ROLE_UNITS[role.trim()];
    if (unit !== undefined) {
      return unit;
    }
  }

  const haystack = `${category ?? ""} ${subCategory ?? ""}`.toLowerCase();

  if (haystack.includes("school") || haystack.includes("education")) {
    return "students";
  }

  if (haystack.includes("health") || haystack.includes("hospital") || haystack.includes("medical")) {
    return "patients";
  }

  if (haystack.includes("power") || haystack.includes("electric")) {
    return "MW";
  }

  if (haystack.includes("water") || haystack.includes("sewage")) {
    return "m³";
  }

  if (haystack.includes("garbage") || haystack.includes("waste")) {
    return "t";
  }

  if (haystack.includes("fire") || haystack.includes("police") || haystack.includes("prison")) {
    return "vehicles";
  }

  return "";
}

/** Capacity with its unit, e.g. "1 200 students". */
export function formatCapacity(
  value: number | null | undefined,
  category: string | null | undefined,
  subCategory: string | null | undefined,
  role?: string | null,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  const formatted = formatBuildingMetric(value, "capacity", separators);
  if (formatted === METRIC_NO_DATA) {
    return formatted;
  }

  const unit = getCapacityUnitLabel(category, subCategory, role);

  return unit === "" ? formatted : `${formatted} ${unit}`;
}

export interface BuildingDetailMetric {
  key: string;
  label: string;
  value: string;
}

/**
 * The analytical metrics the adapter already projects but the table never
 * showed.
 *
 * `BuildingCatalogAdapter` populates electricity, water, garbage, water and
 * sewage capacity, and the three pollution figures during the existing index
 * pass — these are the numbers that justified building an analytical catalog
 * at all. None of them were rendered anywhere, while Level (0 for every
 * service building) held a column of its own.
 *
 * Metrics that were not projected for a building are omitted rather than shown
 * as a dash, so an expanded row carries only figures that mean something.
 */
export function getBuildingDetailMetrics(entry: {
  electricityConsumption?: number | null;
  waterConsumption?: number | null;
  garbageAccumulation?: number | null;
  waterCapacity?: number | null;
  sewageCapacity?: number | null;
  groundPollution?: number | null;
  airPollution?: number | null;
  noisePollution?: number | null;
}, separators: NumberSeparators = FALLBACK_SEPARATORS): BuildingDetailMetric[] {
  const candidates: Array<{ key: string; label: string; value: number | null | undefined; unit?: string }> = [
    { key: "electricity", label: "Electricity", value: entry.electricityConsumption, unit: "MW" },
    { key: "water", label: "Water", value: entry.waterConsumption, unit: "m³" },
    { key: "garbage", label: "Garbage", value: entry.garbageAccumulation, unit: "t" },
    { key: "waterCapacity", label: "Water capacity", value: entry.waterCapacity, unit: "m³" },
    { key: "sewageCapacity", label: "Sewage capacity", value: entry.sewageCapacity, unit: "m³" },
    { key: "groundPollution", label: "Ground pollution", value: entry.groundPollution },
    { key: "airPollution", label: "Air pollution", value: entry.airPollution },
    { key: "noisePollution", label: "Noise pollution", value: entry.noisePollution },
  ];

  return candidates
    .filter((candidate) => candidate.value !== null && candidate.value !== undefined && Number.isFinite(candidate.value))
    .map((candidate) => ({
      key: candidate.key,
      label: candidate.label,
      value: candidate.unit
        ? `${groupDigits(candidate.value as number, separators)} ${candidate.unit}`
        : groupDigits(candidate.value as number, separators),
    }));
}

/**
 * Whether this thing occupies a lot at all.
 *
 * Networks joined the catalog and they have no footprint: a road's lot is 0x0,
 * which formats as "0 × 0" — a measurement, stated confidently, of something
 * that does not exist. A zone is the same. Absent and zero are both "no
 * footprint" here, because the question does not apply either way.
 */
export function hasFootprint(
  width: number | null | undefined,
  depth: number | null | undefined
): boolean {
  return typeof width === "number" && Number.isFinite(width) && width > 0
    && typeof depth === "number" && Number.isFinite(depth) && depth > 0;
}

/**
 * A lot's footprint as a single, unbreakable string.
 *
 * Rendering this as JSX (`{width} × {depth}`) emits three separate text nodes,
 * and Cohtml takes each node boundary as a line-break opportunity even when the
 * cell sets `white-space: nowrap` — a 59px column broke "19 × 16" onto three
 * lines with 38px of text in it. Joining with U+00A0 leaves no break
 * opportunity for the engine to take.
 */
export function formatLotDimensions(
  width: number | null | undefined,
  depth: number | null | undefined
): string {
  if (typeof width !== "number" || !Number.isFinite(width)) {
    return METRIC_NO_DATA;
  }

  if (typeof depth !== "number" || !Number.isFinite(depth)) {
    return METRIC_NO_DATA;
  }

  return `${width} × ${depth}`;
}
