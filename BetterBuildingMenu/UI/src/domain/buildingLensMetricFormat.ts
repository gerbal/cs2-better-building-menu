import type { BuildingLensMetric } from "./buildingLensLayout";

/**
 * Formatting for the Building Lens metric cells. Digits are grouped by hand
 * because Cohtml's `Intl` is not the browser's; separators and unit templates
 * come from the game's dictionary so our numbers agree with the screen.
 */

/** Rendered when a metric was not projected for this building. */
export const METRIC_NO_DATA = "—";

/**
 * Rendered when a metric does not apply to this KIND of thing. Deliberately not
 * the dash: both states show in one row, and printing them alike says the
 * building might have a level we failed to read.
 */
export const METRIC_NOT_APPLICABLE = "·";

/**
 * A building's level, or a mark saying it has none. Zone buildings run 1 to 5,
 * so a 0 is the game saying this kind of thing has no levels; a null is the
 * wire failing to send one at all, which is a real gap and gets the dash.
 */
export function formatBuildingLevel(level: number | null | undefined): string {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return METRIC_NO_DATA;
  }

  return level >= 1 ? String(level) : METRIC_NOT_APPLICABLE;
}

/**
 * A construction cost of exactly zero — real, and different from unknown.
 * English rather than a locale key because this module is pure and cannot call
 * `translate`; `localizableStrings` registers it as debt.
 */
export const METRIC_FREE = "Free";

// Fallbacks only; the real separators come from the game's loc dictionary.
// A NO-BREAK space, because Cohtml treats a plain U+0020 between digits as a
// break opportunity and will split a number across two lines.
const FALLBACK_GROUP_SEPARATOR = " ";
const FALLBACK_DECIMAL_SEPARATOR = ".";
const THOUSANDS_SEPARATOR_KEY = "Common.THOUSANDS_SEPARATOR";
const DECIMAL_SEPARATOR_KEY = "Common.DECIMAL_SEPARATOR";

/** The `translate` from `useLocalization`, kept structural so this stays pure. */
export type Translate = (id: string, fallback?: string | null) => string | null;

/**
 * The game's own money templates, e.g. "{SIGN}¢{VALUE}". Taken from vanilla
 * because they localize the suffix and the symbol's placement too, so a cost
 * reads here exactly as it does in the game's panels, in every language.
 */
export interface MoneyTemplates {
  plain: string;
  perMonth: string;
  perKilometre: string;
  perKilometrePerMonth: string;
  perMile: string;
  perMilePerMonth: string;
}

/**
 * The game's own length templates, "{SIGN}{VALUE} m". Vanilla owns the spacing
 * and the word. Both unit systems are here because the player's choice is
 * readable off ("options", "unitSettings") and the game ships both sets.
 */
export interface LengthTemplates {
  cubicMetre: string;
  gallon: string;
  cubicMetrePerMonth: string;
  gallonPerMonth: string;
  metre: string;
  kilometre: string;
  yard: string;
  mile: string;
  foot: string;
}

/**
 * The game's weight templates. Vanilla's Weight formatter takes kilograms and
 * picks the unit by size — see formatWeight for the thresholds.
 */
export interface WeightTemplates {
  kilogram: string;
  ton: string;
  kiloton: string;
  pound: string;
  shortTon: string;
  shortKiloton: string;
  kilogramPerMonth: string;
  tonPerMonth: string;
  poundPerMonth: string;
  shortTonPerMonth: string;
}

/** The game's power and energy templates; the raw figures are in hundreds of watts. */
export interface PowerTemplates {
  kilowatt: string;
  megawatt: string;
  megawattHours: string;
  /** Common.VALUE_GIGABIT_PER_SECOND — vanilla's dataRate unit. */
  gigabitPerSecond: string;
}

export const FALLBACK_POWER: PowerTemplates = {
  kilowatt: "{VALUE} kW",
  megawatt: "{VALUE} MW",
  megawattHours: "{VALUE} MWh",
  gigabitPerSecond: "{VALUE} Gbit/s",
};

/** Vanilla's Common.VALUE_PER_MONTH, minus {SIGN}. */
export const FALLBACK_PER_MONTH = "{VALUE} /mo.";

// The English strings in the shipped Locale.cok, minus {SIGN}. The short
// kiloton one is absent from that file, so its fallback is a guess used only
// when the game's own template is missing.
export const FALLBACK_WEIGHT: WeightTemplates = {
  kilogram: "{VALUE} kg",
  ton: "{VALUE} t",
  kiloton: "{VALUE} kt",
  pound: "{VALUE} lb",
  shortTon: "{VALUE} tn",
  shortKiloton: "{VALUE} ktn",
  kilogramPerMonth: "{VALUE} kg/mo.",
  tonPerMonth: "{VALUE} t/mo.",
  poundPerMonth: "{VALUE} lb/mo.",
  shortTonPerMonth: "{VALUE} tn/mo.",
};

export const FALLBACK_LENGTH: LengthTemplates = {
  cubicMetre: "{VALUE} m³",
  gallon: "{VALUE} gal",
  cubicMetrePerMonth: "{VALUE} m³/mo.",
  gallonPerMonth: "{VALUE} gal/mo.",
  metre: "{VALUE} m",
  kilometre: "{VALUE} km",
  yard: "{VALUE} yd",
  mile: "{VALUE} mi",
  foot: "{VALUE} ft",
};

/**
 * Which units the player reads the rest of the game in. The names and numbers
 * are vanilla's InterfaceSettings.UnitSystem, arriving as an integer on the
 * ("options", "unitSettings") binding.
 */
export const UnitSystem = {
  Metric: 0,
  Freedom: 1,
} as const;

// A const object rather than an enum: the unit suites run under Node's
// strip-only type stripping, which rejects `enum` outright.
export type UnitSystem = (typeof UnitSystem)[keyof typeof UnitSystem];

/**
 * Vanilla's own conversion literals, lifted from its UI bundle rather than
 * looked up, so our numbers agree with the ones beside them in the last digit.
 */
const METRES_PER_YARD = 0.9144;
const KILOMETRES_PER_MILE = 1.609344;
export const FEET_PER_METRE = 3.28084;
/** US gallons in a cubic metre — vanilla's own literal. */
const GALLONS_PER_CUBIC_METRE = 264.172;

/**
 * The threshold vanilla switches a Length at: a kilometre in metric, a MILE in
 * Freedom units. Switching at 1000 m under imperial would read "1,094 yd" for
 * something the game itself calls 0.6 miles.
 */
const METRIC_LONG = 1000;
const FREEDOM_LONG = 1609;

export const FALLBACK_MONEY: MoneyTemplates = {
  plain: "¢{VALUE}",
  perMonth: "¢{VALUE}/mo",
  perKilometre: "¢{VALUE}/km",
  perKilometrePerMonth: "¢{VALUE}/km/mo",
  perMile: "¢{VALUE}/mi",
  perMilePerMonth: "¢{VALUE}/mi/mo",
};

export interface NumberSeparators {
  group: string;
  decimal: string;
  /** Absent when the caller had no access to the game's dictionary. */
  money?: MoneyTemplates;
  length?: LengthTemplates;
  weight?: WeightTemplates;
  power?: PowerTemplates;
  perMonth?: string;
  /** Absent until the options binding has answered; Metric until it does. */
  unitSystem?: UnitSystem;
}

export const FALLBACK_SEPARATORS: NumberSeparators = {
  group: FALLBACK_GROUP_SEPARATOR,
  decimal: FALLBACK_DECIMAL_SEPARATOR,
  money: FALLBACK_MONEY,
  length: FALLBACK_LENGTH,
  weight: FALLBACK_WEIGHT,
  power: FALLBACK_POWER,
  perMonth: FALLBACK_PER_MONTH,
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
export function getNumberSeparators(
  translate?: Translate,
  unitSystem: UnitSystem = UnitSystem.Metric,
): NumberSeparators {
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
      perMile: resolveMoney(translate, "Common.VALUE_MONEY_PER_MILE", FALLBACK_MONEY.perMile),
      perMilePerMonth: resolveMoney(
        translate,
        "Common.VALUE_MONEY_PER_MILE_PER_MONTH",
        FALLBACK_MONEY.perMilePerMonth,
      ),
    },
    length: {
      metre: resolveMoney(translate, "Common.VALUE_METER", FALLBACK_LENGTH.metre),
      kilometre: resolveMoney(translate, "Common.VALUE_KILOMETER", FALLBACK_LENGTH.kilometre),
      yard: resolveMoney(translate, "Common.VALUE_YARD", FALLBACK_LENGTH.yard),
      mile: resolveMoney(translate, "Common.VALUE_MILE", FALLBACK_LENGTH.mile),
      foot: resolveMoney(translate, "Common.VALUE_FOOT", FALLBACK_LENGTH.foot),
      cubicMetre: resolveMoney(translate, "Common.VALUE_CUBIC_METER", FALLBACK_LENGTH.cubicMetre),
      gallon: resolveMoney(translate, "Common.VALUE_GALLON", FALLBACK_LENGTH.gallon),
      cubicMetrePerMonth: resolveMoney(translate, "Common.VALUE_CUBIC_METER_PER_MONTH", FALLBACK_LENGTH.cubicMetrePerMonth),
      gallonPerMonth: resolveMoney(translate, "Common.VALUE_GALLON_PER_MONTH", FALLBACK_LENGTH.gallonPerMonth),
    },
    weight: {
      kilogram: resolveMoney(translate, "Common.VALUE_KILOGRAM", FALLBACK_WEIGHT.kilogram),
      ton: resolveMoney(translate, "Common.VALUE_TON", FALLBACK_WEIGHT.ton),
      kiloton: resolveMoney(translate, "Common.VALUE_KILOTON", FALLBACK_WEIGHT.kiloton),
      pound: resolveMoney(translate, "Common.VALUE_POUND", FALLBACK_WEIGHT.pound),
      shortTon: resolveMoney(translate, "Common.VALUE_SHORT_TON", FALLBACK_WEIGHT.shortTon),
      shortKiloton: resolveMoney(translate, "Common.VALUE_SHORT_KILOTON", FALLBACK_WEIGHT.shortKiloton),
      kilogramPerMonth: resolveMoney(translate, "Common.VALUE_KG_PER_MONTH", FALLBACK_WEIGHT.kilogramPerMonth),
      tonPerMonth: resolveMoney(translate, "Common.VALUE_TON_PER_MONTH", FALLBACK_WEIGHT.tonPerMonth),
      poundPerMonth: resolveMoney(translate, "Common.VALUE_POUND_PER_MONTH", FALLBACK_WEIGHT.poundPerMonth),
      shortTonPerMonth: resolveMoney(translate, "Common.VALUE_SHORT_TON_PER_MONTH", FALLBACK_WEIGHT.shortTonPerMonth),
    },
    power: {
      kilowatt: resolveMoney(translate, "Common.VALUE_KILOWATT", FALLBACK_POWER.kilowatt),
      megawatt: resolveMoney(translate, "Common.VALUE_MEGAWATT", FALLBACK_POWER.megawatt),
      megawattHours: resolveMoney(translate, "Common.VALUE_MEGAWATT_HOURS", FALLBACK_POWER.megawattHours),
      gigabitPerSecond: resolveMoney(translate, "Common.VALUE_GIGABIT_PER_SECOND", FALLBACK_POWER.gigabitPerSecond),
    },
    perMonth: resolveMoney(translate, "Common.VALUE_PER_MONTH", FALLBACK_PER_MONTH),
    unitSystem,
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
 * Cost and upkeep for a network are rates, not totals, so the unit travels with
 * the number: a road's figure is per kilometre and a building's is the whole
 * bill, and a column heading is not somewhere a reader keeps that straight.
 */
export const PER_DISTANCE_SUFFIX = "/km";
export const PER_MILE_SUFFIX = "/mi";

export function formatBuildingMetric(
  value: number | null | undefined,
  metric: BuildingLensMetric,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
  perDistance: boolean = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return METRIC_NO_DATA;
  }

  const money = separators.money ?? FALLBACK_MONEY;
  const isMoney = metric === "cost" || metric === "upkeep";
  const imperial = separators.unitSystem === UnitSystem.Freedom;
  // A per-kilometre rate becomes a per-MILE rate, so the figure has to move
  // with the unit or a road's cost is understated by more than a third. Money
  // is rounded because it is whole everywhere else on the card.
  const scaled = perDistance && imperial
    ? (isMoney ? Math.round(value * KILOMETRES_PER_MILE) : value * KILOMETRES_PER_MILE)
    : value;
  const digits = groupDigits(scaled, separators);

  if (perDistance) {
    // Free is a statement about a total, so it has no meaning for a rate — a
    // road that costs nothing per kilometre costs nothing at all, and "0/km"
    // says that without implying the asset is a gift.
    if (isMoney) {
      // The game has its own per-kilometre money forms, suffix and all, so the
      // rate is stated the way vanilla states it rather than by bolting our
      // "/km" onto a number.
      const perDistanceTemplate = imperial
        ? (metric === "upkeep" ? money.perMilePerMonth : money.perMile)
        : (metric === "upkeep" ? money.perKilometrePerMonth : money.perKilometre);

      return applyMoneyTemplate(perDistanceTemplate, digits);
    }

    return `${digits}${imperial ? PER_MILE_SUFFIX : PER_DISTANCE_SUFFIX}`;
  }

  switch (metric) {
    case "upkeep":
      // The game bills upkeep monthly; without this the column is a bare
      // number the player cannot compare against anything. Its own template
      // carries both the symbol and the localized "per month".
      return applyMoneyTemplate(money.perMonth, digits);
    case "cost":
      // A zero here is real: the indexer nulls the cost when there is no
      // PlaceableObjectData. Naming it keeps the dash meaning only "not known",
      // instead of a lone "0" reading as a third kind of nothing.
      return value === 0 ? METRIC_FREE : applyMoneyTemplate(money.plain, digits);
    default:
      return digits;
  }
}

/**
 * What a Capacity figure counts, keyed by the component-derived role: classify
 * by what the prefab carries, not by what its category is called. Matching the
 * category name calls a prison's prisoners "vehicles".
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
  // Communications. Vanilla binds a post facility's mail capacity with the
  // "integer" unit, the same as its van count — a count, not a weight. Network
  // capacity is a count of connections the game names no unit for.
  PostFacility: "",
  TelecomFacility: "",
};

/**
 * Roles whose capacity is a weight in kilograms — see formatCapacity. Garbage
 * only: vanilla binds a post facility's mail capacity as a plain integer, so
 * mail does not belong here.
 */
const WEIGHT_ROLES: ReadonlySet<string> = new Set(["GarbageFacility"]);

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
 * A service radius, e.g. "480 m". Metres because that is what the simulation
 * works in; rounded because a tower's reach is not read to the centimetre.
 */
export function formatServiceRange(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const length = separators.length ?? FALLBACK_LENGTH;

  // Vanilla's own Length rule, thresholds and divisors included, so a range
  // agrees with the same distance stated anywhere else in the game. Yards, not
  // feet: feet are vanilla's Height unit, and a service radius is a Length.
  const imperial = separators.unitSystem === UnitSystem.Freedom;

  if (imperial) {
    if (value < FREEDOM_LONG) {
      return applyMoneyTemplate(
        length.yard,
        formatBuildingMetric(Math.round(value / METRES_PER_YARD), "capacity", separators),
      );
    }

    const miles = Math.round(value / 1000 / KILOMETRES_PER_MILE * 10) / 10;

    return applyMoneyTemplate(
      length.mile,
      Number.isInteger(miles) ? String(miles) : miles.toFixed(1),
    );
  }

  if (value >= METRIC_LONG) {
    const km = Math.round(value / 100) / 10;

    return applyMoneyTemplate(
      length.kilometre,
      Number.isInteger(km) ? String(km) : km.toFixed(1),
    );
  }

  return applyMoneyTemplate(length.metre, formatBuildingMetric(Math.round(value), "capacity", separators));
}

/**
 * A network's speed limit, e.g. "100 km/h". The game keeps this per network
 * type and states it in km/h, so the metric figure passes through unconverted.
 */
export function formatSpeedLimit(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  // The game ships no speed template in either system — no VALUE_KMH and no
  // VALUE_MPH — so both suffixes are ours. The conversion reuses the mile
  // divisor above so the two never disagree.
  if (separators.unitSystem === UnitSystem.Freedom) {
    const mph = Math.round(value / KILOMETRES_PER_MILE);

    return `${formatBuildingMetric(mph, "capacity", separators)} mph`;
  }

  return `${formatBuildingMetric(Math.round(value), "capacity", separators)} km/h`;
}

/**
 * How wide a network draws, e.g. "24 m" — whole metres, or yards under
 * Freedom, because it goes through formatServiceRange like any other length.
 */
export function formatNetworkWidth(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  // A width is a horizontal distance, so it is a Length and takes vanilla's
  // Length units. Same function as range, so there is no second opinion to
  // keep in sync and no two lines of one card disagreeing.
  return formatServiceRange(value, separators);
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

  // A garbage capacity is kilograms, bound by vanilla with the weight unit
  // like cargo, so it goes through the weight rule rather than being printed
  // raw under a "t" heading.
  if (typeof role === "string" && WEIGHT_ROLES.has(role) && typeof value === "number") {
    const weighed = formatWeight(value, separators);
    return weighed === "" ? formatted : weighed;
  }

  // A plant's output is power and a battery's storage is energy, both carried
  // as the game's hundreds-of-watts figure, which is not megawatts.
  if (role === "PowerPlant" && typeof value === "number") {
    const powered = formatPower(value, separators);
    return powered === "" ? formatted : powered;
  }
  // A telecom facility's capacity is a data rate: gigabits a second, as the
  // game binds it, and a bare count says nothing about what it measures.
  if (role === "TelecomFacility" && typeof value === "number") {
    const rate = formatDataRate(value, separators);
    return rate === "" ? formatted : rate;
  }
  if (role === "Battery" && typeof value === "number") {
    const stored = formatEnergy(value, separators);
    return stored === "" ? formatted : stored;
  }

  const unit = getCapacityUnitLabel(category, subCategory, role);
  // Water and sewage capacities are volumes a month, and the unit follows the
  // player's setting, so the figure goes through the game's rule even though
  // the column header above still says m³.
  if (unit === "m³" && typeof value === "number") {
    const volume = formatVolumePerMonth(value, separators);
    return volume === "" ? formatted : volume;
  }
  return unit === "" ? formatted : `${formatted} ${unit}`;
}

export interface BuildingDetailMetric {
  key: string;
  label: string;
  value: string;
}

/**
 * Everything the indexer projected about one asset, ready to draw. A detail
 * view cannot know less than the row it expands from, so every field is a
 * candidate; absent stays absent, and formatting is delegated, never re-derived.
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
  telecomNeed?: number | null;
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

  // Then what it draws and what it emits.
  const measured: Array<{ key: string; label: string; value: number | null | undefined; unit?: string; text?: (value: number) => string }> = [
    // The three consumption figures in the game's own units: power in
    // hundreds of watts, water in m³ a month, garbage in kilograms a month.
    { key: "electricity", label: "Electricity", value: entry.electricityConsumption, text: (v) => formatPower(v, separators) },
    { key: "water", label: "Water", value: entry.waterConsumption, text: (v) => formatVolumePerMonth(v, separators) },
    { key: "garbage", label: "Garbage", value: entry.garbageAccumulation, text: (v) => formatWeightPerMonth(v, separators) },
    { key: "telecom", label: "Telecom", value: entry.telecomNeed },
    { key: "waterCapacity", label: "Water capacity", value: entry.waterCapacity, text: (v) => formatVolumePerMonth(v, separators) },
    { key: "sewageCapacity", label: "Sewage capacity", value: entry.sewageCapacity, text: (v) => formatVolumePerMonth(v, separators) },
    { key: "groundPollution", label: "Ground pollution", value: entry.groundPollution },
    { key: "airPollution", label: "Air pollution", value: entry.airPollution },
    { key: "noisePollution", label: "Noise pollution", value: entry.noisePollution },
  ];

  for (const candidate of measured) {
    add(candidate.key, candidate.label, candidate.value,
      candidate.text && typeof candidate.value === "number"
        ? candidate.text(candidate.value)
        : candidate.unit
          ? `${groupDigits(candidate.value as number, separators)} ${candidate.unit}`
          : groupDigits(candidate.value as number, separators));
  }

  return details;
}

/**
 * Whether this thing occupies a lot at all. A road or a zone has no footprint,
 * and "0 × 0" is a confident measurement of something that does not exist, so
 * absent and zero both answer no.
 */
export function hasFootprint(
  width: number | null | undefined,
  depth: number | null | undefined
): boolean {
  return typeof width === "number" && Number.isFinite(width) && width > 0
    && typeof depth === "number" && Number.isFinite(depth) && depth > 0;
}

/**
 * A lot's footprint as a single, unbreakable string. Rendering it as JSX emits
 * three text nodes, and Cohtml breaks at each node boundary even under
 * `white-space: nowrap`; the U+00A0 joins leave it nowhere to break.
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

/**
 * A height, by vanilla's Height rule: metres, and FEET under Freedom. Feet
 * rather than yards because that is the split the game makes — Length is yards
 * and miles, Height and NetElevation are feet.
 */
export function formatHeight(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const length = separators.length ?? FALLBACK_LENGTH;

  return separators.unitSystem === UnitSystem.Freedom
    ? applyMoneyTemplate(length.foot, groupDigits(Math.round(value * FEET_PER_METRE), separators))
    : applyMoneyTemplate(length.metre, groupDigits(Math.round(value), separators));
}

/**
 * A volume, by vanilla's Volume rule: cubic metres, and US gallons under
 * Freedom at the game's own 264.172.
 */
export function formatVolume(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const length = separators.length ?? FALLBACK_LENGTH;

  return separators.unitSystem === UnitSystem.Freedom
    ? applyMoneyTemplate(
      length.gallon,
      groupDigits(Math.round(value * GALLONS_PER_CUBIC_METRE), separators),
    )
    : applyMoneyTemplate(length.cubicMetre, groupDigits(Math.round(value), separators));
}

/**
 * A volume a month, by vanilla's VolumePerMonth rule — the unit it binds
 * WATER_CAPACITY and SEWAGE_CAPACITY with: cubic metres a month, and US gallons
 * a month under Freedom.
 */
export function formatVolumePerMonth(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const length = separators.length ?? FALLBACK_LENGTH;

  return separators.unitSystem === UnitSystem.Freedom
    ? applyMoneyTemplate(
      length.gallonPerMonth,
      groupDigits(Math.round(value * GALLONS_PER_CUBIC_METRE), separators),
    )
    : applyMoneyTemplate(length.cubicMetrePerMonth, groupDigits(Math.round(value), separators));
}

// Vanilla's own constants and thresholds, read off the shipped bundle, so a
// weight here reads as the same weight anywhere else in the game.
const KILOGRAMS_PER_POUND = 0.45359237;
const KILOGRAMS_PER_SHORT_TON = 907.18474;
const WEIGHT_SMALL_KG = 100;
const METRIC_KILOTON_KG = 1_000_000;
const FREEDOM_SHORT_KILOTON_KG = 9_071_847.4;

/** At most `decimals` places, trailing zeros dropped, digits grouped. */
function roundedDigits(value: number, decimals: number, separators: NumberSeparators): string {
  const fixed = value.toFixed(decimals);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  const [whole, fraction] = trimmed.split(".");
  const grouped = groupDigits(Number(whole), separators);

  return fraction ? `${grouped}${separators.decimal}${fraction}` : grouped;
}

/**
 * A weight in kilograms, in the unit the game itself would show: vanilla's
 * Weight formatter picks kilograms, tonnes or kilotonnes by size, with the
 * imperial ladder alongside. The thresholds below are its own.
 */
export function formatWeight(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const weight = separators.weight ?? FALLBACK_WEIGHT;

  if (separators.unitSystem === UnitSystem.Freedom) {
    if (value < WEIGHT_SMALL_KG) {
      return applyMoneyTemplate(weight.pound, roundedDigits(value / KILOGRAMS_PER_POUND, 1, separators));
    }
    if (value < FREEDOM_SHORT_KILOTON_KG) {
      return applyMoneyTemplate(weight.shortTon, roundedDigits(value / KILOGRAMS_PER_SHORT_TON, 2, separators));
    }
    return applyMoneyTemplate(weight.shortKiloton, roundedDigits(value / KILOGRAMS_PER_SHORT_TON / 1000, 2, separators));
  }

  if (value < WEIGHT_SMALL_KG) {
    return applyMoneyTemplate(weight.kilogram, roundedDigits(value, 1, separators));
  }
  if (value < METRIC_KILOTON_KG) {
    return applyMoneyTemplate(weight.ton, roundedDigits(value / 1000, 2, separators));
  }
  return applyMoneyTemplate(weight.kiloton, roundedDigits(value / METRIC_KILOTON_KG, 2, separators));
}

/**
 * Kilograms per month, as the game shows them: kg/mo. below 100 (one decimal),
 * t/mo. above (two); imperial lb/mo. and tn/mo. with the Weight constants.
 * There is no kiloton tier in vanilla's per-month rule.
 */
export function formatWeightPerMonth(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const weight = separators.weight ?? FALLBACK_WEIGHT;

  if (separators.unitSystem === UnitSystem.Freedom) {
    return value < WEIGHT_SMALL_KG
      ? applyMoneyTemplate(weight.poundPerMonth, roundedDigits(value / KILOGRAMS_PER_POUND, 1, separators))
      : applyMoneyTemplate(weight.shortTonPerMonth, roundedDigits(value / KILOGRAMS_PER_SHORT_TON, 2, separators));
  }

  return value < WEIGHT_SMALL_KG
    ? applyMoneyTemplate(weight.kilogramPerMonth, roundedDigits(value, 1, separators))
    : applyMoneyTemplate(weight.tonPerMonth, roundedDigits(value / 1000, 2, separators));
}

/** A plain count per month, through vanilla's own template ("{VALUE} /mo."). */
export function formatPerMonth(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  return applyMoneyTemplate(separators.perMonth ?? FALLBACK_PER_MONTH, groupDigits(Math.round(value), separators));
}

// Vanilla's Power rule: the raw figure is in hundreds of watts. Below 10,000
// it shows raw / 10 as kilowatts (one decimal); above, raw / 10,000 as
// megawatts (two). Energy is raw / 10,000 megawatt-hours (one decimal).
const POWER_KILOWATT_LIMIT = 10_000;

export function formatPower(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const power = separators.power ?? FALLBACK_POWER;

  return value < POWER_KILOWATT_LIMIT
    ? applyMoneyTemplate(power.kilowatt, roundedDigits(value / 10, 1, separators))
    : applyMoneyTemplate(power.megawatt, roundedDigits(value / 10_000, 2, separators));
}

export function formatEnergy(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const power = separators.power ?? FALLBACK_POWER;

  return applyMoneyTemplate(power.megawattHours, roundedDigits(value / 10_000, 1, separators));
}

/**
 * A data rate, by vanilla's DataRate rule: gigabits a second to one decimal,
 * the same in both unit systems — the unit it binds TelecomFacilityData's
 * NETWORK_CAPACITY with.
 */
export function formatDataRate(
  value: number | null | undefined,
  separators: NumberSeparators = FALLBACK_SEPARATORS,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const power = separators.power ?? FALLBACK_POWER;

  return applyMoneyTemplate(power.gigabitPerSecond, roundedDigits(value, 1, separators));
}
