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

/**
 * Rendered when a metric does not apply to this KIND of thing.
 *
 * Deliberately not the dash. A dash means "we do not know", and the table shows
 * both states in the same row: a service building's Workers is unknown while
 * its Level does not exist, and printing them alike says the building might
 * have a level we failed to read. The Parking column has drawn this distinction
 * since cm-zxou; this is that mark, named and shared rather than a second
 * literal.
 */
export const METRIC_NOT_APPLICABLE = "·";

/**
 * A building's level, or a mark saying it has none.
 *
 * cm-ch0z. The column rendered entry.buildingLevel raw, so every service
 * building showed a bare "0" — beside a "—" in Workers meaning "not known".
 * Zone buildings run 1 to 5; a level of 0 is the game saying "this kind of
 * thing does not have levels", which is a fact about the asset and not a
 * measurement of it.
 *
 * A null is different again and gets the dash: the wire always sends a number,
 * so its absence means the projection failed, which IS a gap.
 */
export function formatBuildingLevel(level: number | null | undefined): string {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return METRIC_NO_DATA;
  }

  return level >= 1 ? String(level) : METRIC_NOT_APPLICABLE;
}

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

/**
 * The game's own money templates, e.g. "{SIGN}¢{VALUE}".
 *
 * Taken from vanilla rather than written here, because the symbol is only half
 * of what they carry: the per-month and per-kilometre forms also localize their
 * own suffix — "/mês", "／月", "per km/mese" — and the placement of the symbol
 * itself is a locale decision we have no business making. Substituting into
 * the game's string means a cost reads in the lens exactly as it reads in the
 * game's own panels, in every language, including the ones we ship no
 * translation for.
 */
export interface MoneyTemplates {
  plain: string;
  perMonth: string;
  perKilometre: string;
  perKilometrePerMonth: string;
}

export const FALLBACK_MONEY: MoneyTemplates = {
  plain: "¢{VALUE}",
  perMonth: "¢{VALUE}/mo",
  perKilometre: "¢{VALUE}/km",
  perKilometrePerMonth: "¢{VALUE}/km/mo",
};

export interface NumberSeparators {
  group: string;
  decimal: string;
  /** Absent when the caller had no access to the game's dictionary. */
  money?: MoneyTemplates;
}

export const FALLBACK_SEPARATORS: NumberSeparators = {
  group: FALLBACK_GROUP_SEPARATOR,
  decimal: FALLBACK_DECIMAL_SEPARATOR,
  money: FALLBACK_MONEY,
};

/** Fills the game's template. {SIGN} is for negatives, which costs never are. */
export function applyMoneyTemplate(template: string, digits: string): string {
  return template.replace("{SIGN}", "").replace("{VALUE}", digits);
}

function resolveMoney(translate: Translate | undefined, key: string, fallback: string): string {
  if (!translate) return fallback;

  const value = translate(key, fallback);
  // translate() echoes the id back for a missing key, and an id is not a
  // template — the same guard the separators need, for the same reason.
  if (typeof value !== "string" || value === "" || value === key) return fallback;
  // A template that lost its placeholder would render the symbol and drop the
  // number, which is worse than our own fallback.
  return value.includes("{VALUE}") ? value : fallback;
}

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
    money: {
      plain: resolveMoney(translate, "Common.VALUE_MONEY", FALLBACK_MONEY.plain),
      perMonth: resolveMoney(translate, "Common.VALUE_MONEY_PER_MONTH", FALLBACK_MONEY.perMonth),
      perKilometre: resolveMoney(translate, "Common.VALUE_MONEY_PER_KILOMETER", FALLBACK_MONEY.perKilometre),
      perKilometrePerMonth: resolveMoney(
        translate,
        "Common.VALUE_MONEY_PER_KILOMETER_PER_MONTH",
        FALLBACK_MONEY.perKilometrePerMonth,
      ),
    },
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
/**
 * Cost and upkeep for a network are rates, not totals.
 *
 * A road prices by length, so its figure is per kilometre. Printing it beside a
 * building's total unqualified invites a comparison it does not support —
 * 12,500 for a road is a rate, 12,500 for a hospital is the whole bill — so the
 * unit travels with the number rather than living in a column heading the
 * reader has to remember.
 */
export const PER_DISTANCE_SUFFIX = "/km";

export function formatBuildingMetric(
  value: number | null | undefined,
  metric: BuildingLensMetric,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
  perDistance: boolean = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return METRIC_NO_DATA;
  }

  const digits = groupDigits(value, separators);
  const money = separators.money ?? FALLBACK_MONEY;
  const isMoney = metric === "cost" || metric === "upkeep";

  if (perDistance) {
    // Free is a statement about a total, so it has no meaning for a rate — a
    // road that costs nothing per kilometre costs nothing at all, and "0/km"
    // says that without implying the asset is a gift.
    if (isMoney) {
      // The game has its own per-kilometre money forms, suffix and all, so the
      // rate is stated the way vanilla states it rather than by bolting our
      // "/km" onto a number.
      return applyMoneyTemplate(
        metric === "upkeep" ? money.perKilometrePerMonth : money.perKilometre,
        digits,
      );
    }

    return `${digits}${PER_DISTANCE_SUFFIX}`;
  }

  switch (metric) {
    case "upkeep":
      // The game bills upkeep monthly; without this the column is a bare
      // number the player cannot compare against anything. Its own template
      // carries both the symbol and the localized "per month".
      return applyMoneyTemplate(money.perMonth, digits);
    case "cost":
      // A zero here is real, not missing: the indexer leaves the cost null when
      // no PlaceableObjectData is present, and vanilla likewise renders an
      // authored zero as a zero. But a lone "0" beside the "—" that Workers and
      // Capacity show for absence reads as a third kind of nothing. Naming it
      // says which kind it is, and leaves the dash meaning only "not known".
      return value === 0 ? METRIC_FREE : applyMoneyTemplate(money.plain, digits);
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
  // Communications. Mail is a weight in this simulation, like garbage; network
  // capacity is a count of connections and has no unit the game names, so it
  // gets none rather than an invented one.
  PostFacility: "t",
  TelecomFacility: "",
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

/**
 * A service radius, e.g. "480 m".
 *
 * Metres because that is what the simulation measures in and what the game's
 * own coverage readouts say; rounded because a tower's reach is not a figure
 * anyone reads to the centimetre.
 */
export function formatServiceRange(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  return `${formatBuildingMetric(Math.round(value), "capacity", separators)} m`;
}

/**
 * A network's speed limit, e.g. "100 km/h".
 *
 * The game keeps this per network type — RoadData, TrackData, PathwayData,
 * WaterwayData, TaxiwayData — and states it in km/h, which is what its own
 * road tooltips say, so it is passed through rather than converted.
 */
export function formatSpeedLimit(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  return `${formatBuildingMetric(Math.round(value), "capacity", separators)} km/h`;
}

/**
 * How wide a network draws, e.g. "24 m".
 *
 * One decimal, because road widths are authored at half metres and rounding a
 * 17.5m road to 18 would make two different roads read as the same width.
 */
export function formatNetworkWidth(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const rounded = Math.round(value * 10) / 10;

  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} m`;
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
/**
 * Everything the indexer projected about one asset, ready to draw.
 *
 * cm-qnfs. This offered eight hand-written candidates — the utilities and the
 * three pollutions — so anything that was neither a power plant nor a polluter
 * expanded to an EMPTY detail area while the row above it showed cost, workers
 * and a lot size. The detail view is where an asset is compared properly; it
 * cannot know less than the row it expands from.
 *
 * Two rules survive from the old list and are what stop this becoming noise:
 *
 *   • ABSENT STAYS ABSENT. The indexer leaves a missing component null rather
 *     than serialising a misleading zero, and a null draws nothing here. A
 *     REAL zero is a fact and stays — a free asset is priced, an unpolluting
 *     one is measured.
 *   • A zero that means "not applicable" is not a real zero. A service
 *     building has no LEVEL, and no parking is not a bay count; both drop out
 *     rather than printing a 0 beside dashes that mean "unknown" (cm-ch0z).
 *
 * Formatting is delegated, never re-derived: formatBuildingMetric knows a
 * network prices by the kilometre, formatCapacity knows what a capacity counts
 * for the kind of thing it is, and hasFootprint knows a road has no lot.
 */
export function getBuildingDetailMetrics(entry: {
  constructionCost?: number | null;
  upkeep?: number | null;
  costIsPerDistance?: boolean;
  capacity?: number | null;
  category?: string;
  subCategory?: string;
  buildingType?: string;
  workers?: number | null;
  households?: number | null;
  parkingSlots?: number | null;
  lotWidth?: number | null;
  lotDepth?: number | null;
  buildingLevel?: number | null;
  electricityConsumption?: number | null;
  waterConsumption?: number | null;
  garbageAccumulation?: number | null;
  waterCapacity?: number | null;
  sewageCapacity?: number | null;
  groundPollution?: number | null;
  airPollution?: number | null;
  noisePollution?: number | null;
}, separators: NumberSeparators = FALLBACK_SEPARATORS): BuildingDetailMetric[] {
  const details: BuildingDetailMetric[] = [];

  /** A metric this entry carries a number for. */
  const add = (key: string, label: string, value: number | null | undefined, text: string) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    details.push({ key, label, value: text });
  };

  // Money first, because it changes what everything under it means.
  add("cost", "Cost", entry.constructionCost,
    formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance ?? false));
  add("upkeep", "Upkeep", entry.upkeep,
    formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance ?? false));

  // Then what it buys.
  add("capacity", "Capacity", entry.capacity,
    formatCapacity(entry.capacity, entry.category ?? "", entry.subCategory ?? "", entry.buildingType, separators));
  add("workers", "Workers", entry.workers, `${groupDigits(entry.workers as number, separators)} jobs`);
  add("households", "Households", entry.households,
    `${groupDigits(entry.households as number, separators)} households`);

  // No bays is not a bay count.
  if (typeof entry.parkingSlots === "number" && Number.isFinite(entry.parkingSlots) && entry.parkingSlots > 0) {
    details.push({
      key: "parking",
      label: "Parking",
      value: `${groupDigits(entry.parkingSlots, separators)} bays`,
    });
  }

  // Then what it occupies. A road measures 0 x 0, which is not a footprint.
  if (hasFootprint(entry.lotWidth, entry.lotDepth)) {
    details.push({
      key: "lot",
      label: "Lot",
      value: formatLotDimensions(entry.lotWidth, entry.lotDepth),
    });
  }

  // A level of 0 means the asset has no level, not that it is level zero.
  if (typeof entry.buildingLevel === "number" && Number.isFinite(entry.buildingLevel) && entry.buildingLevel > 0) {
    details.push({ key: "level", label: "Level", value: String(entry.buildingLevel) });
  }

  // Then what it draws and what it emits — the original eight, unchanged.
  const measured: Array<{ key: string; label: string; value: number | null | undefined; unit?: string }> = [
    { key: "electricity", label: "Electricity", value: entry.electricityConsumption, unit: "MW" },
    { key: "water", label: "Water", value: entry.waterConsumption, unit: "m³" },
    { key: "garbage", label: "Garbage", value: entry.garbageAccumulation, unit: "t" },
    { key: "waterCapacity", label: "Water capacity", value: entry.waterCapacity, unit: "m³" },
    { key: "sewageCapacity", label: "Sewage capacity", value: entry.sewageCapacity, unit: "m³" },
    { key: "groundPollution", label: "Ground pollution", value: entry.groundPollution },
    { key: "airPollution", label: "Air pollution", value: entry.airPollution },
    { key: "noisePollution", label: "Noise pollution", value: entry.noisePollution },
  ];

  for (const candidate of measured) {
    add(candidate.key, candidate.label, candidate.value,
      candidate.unit
        ? `${groupDigits(candidate.value as number, separators)} ${candidate.unit}`
        : groupDigits(candidate.value as number, separators));
  }

  return details;
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
