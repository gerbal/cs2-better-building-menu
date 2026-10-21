/**
 * Service figures beyond a building's headline capacity. They travel from the
 * backend as a keyed list rather than as twenty always-null fields per entry;
 * the indexer decides what is true, this module decides how to say it.
 */

/**
 * The number formatter is INJECTED rather than imported: this folder
 * cross-imports types only, so every module can load on its own under Node's
 * type stripping. The caller already holds the separators.
 */
export type FormatNumber = (value: number) => string;

export interface ServiceFact {
  key: string;
  value: number;
}

/** The same, for a figure that is a word. See ServiceTextFact in C#. */
export interface ServiceTextFact {
  key: string;
  value: string;
}

/** One of vanilla's own unit rules, each following the player's unit system. */
type Measure = "length" | "height" | "volume" | "moneyPerCellPerMonth" | "weight" | "weightPerMonth" | "perMonth" | "power";

/** A string asked for by key, with the English drawn when no locale answers. */
interface Wording {
  localizationKey: string;
  fallback: string;
}

const OUR_KEY_PREFIX = "Tooltip.LABEL[BetterBuildingMenu.";

/** A key of ours, so a translation can ship with the mod. */
const ours = (name: string, fallback: string): Wording => ({ localizationKey: `${OUR_KEY_PREFIX}${name}]`, fallback });

/** The game's own key, which the game translates into every language it ships. */
const game = (localizationKey: string, fallback: string): Wording => ({ localizationKey, fallback });

interface NumericPresentation extends Wording {
  /** Appended after the number; "" for a bare count. */
  unit: string;
  /** Decimals kept, where a whole number would say too little; none by default. */
  decimals?: number;
  /** A multiplier reads as "×1.2", not as a quantity. */
  multiplier?: boolean;
  /** A change, so a positive figure carries its "+" — vanilla's signed binder. */
  signed?: boolean;
  /** Follows the player's unit system instead of carrying a fixed `unit`. */
  measure?: Measure;
}

interface WordedPresentation extends Wording {
  /**
   * Words for the VALUE, where it is one of ours rather than the game's: a
   * traded resource arrives already named, but "narrow" and "corners" are our
   * tokens and need our words.
   */
  values?: Readonly<Record<string, Wording>>;
  /** Tokens that mean "nothing to say" and draw no line — an enum's None. */
  omit?: readonly string[];
}

interface Tier {
  /**
   * A fact under one of the game's keys is the game's line. One under ours is ours
   * unless marked here: the game's tooltip draws it, but under no single key of its own.
   */
  vanilla?: true;
}

interface NumericFact extends NumericPresentation {
  key: string;
  kind: "numeric";
  vanilla: boolean;
}

interface WordedFact extends WordedPresentation {
  key: string;
  kind: "worded";
  vanilla: boolean;
}

const isOurKey = (localizationKey: string): boolean => localizationKey.startsWith(OUR_KEY_PREFIX);

const inGameTier = (label: Wording, tier: Tier): boolean => tier.vanilla === true || !isOurKey(label.localizationKey);

/** A figure drawn as a number. */
function numeric(key: string, label: Wording, format: Partial<Omit<NumericPresentation, keyof Wording>> & Tier = {}): NumericFact {
  return { key, kind: "numeric", ...label, unit: "", ...format, vanilla: inGameTier(label, format) };
}

/** A figure drawn as a word. */
function worded(key: string, label: Wording, words: Omit<WordedPresentation, keyof Wording> & Tier = {}): WordedFact {
  return { key, kind: "worded", ...label, ...words, vanilla: inGameTier(label, words) };
}

const VOLTAGE_WORDS = {
  Low: game("Properties.VOLTAGE:0", "Low"),
  High: game("Properties.VOLTAGE:1", "High"),
  Both: game("Properties.VOLTAGE:2", "Low and high"),
};

const POLLUTION_WORDS = {
  Low: game("SelectedInfoPanel.POLLUTION_LEVELS:1", "Low"),
  Medium: game("SelectedInfoPanel.POLLUTION_LEVELS:2", "Medium"),
  High: game("SelectedInfoPanel.POLLUTION_LEVELS:3", "High"),
};

/**
 * Every fact this build can draw, in the one order every card uses whatever
 * order the indexer emitted in, so a reader learns where to look instead of
 * re-reading. Worded and numeric figures share it.
 */
export const SERVICE_FACTS: readonly (NumericFact | WordedFact)[] = [
  // 1. What it does. The required resource first, as vanilla binds it:
  // RequiredResourceBinder's map feature, in the game's MAP_RESOURCE words.
  worded("requiredResource", game("Properties.REQUIRED_RESOURCE", "Requires"), {
    values: {
      Ore: game("Properties.MAP_RESOURCE[Ore]", "Ore"),
      Fish: game("Properties.MAP_RESOURCE[Fish]", "Fish"),
      Oil: game("Properties.MAP_RESOURCE[Oil]", "Oil"),
      Forest: game("Properties.MAP_RESOURCE[Forest]", "Forest"),
      FertileLand: game("Properties.MAP_RESOURCE[FertileLand]", "Fertile land"),
    },
  }),
  // DeathcareFacilityData.m_ProcessingRate — bodies a month, an integer per
  // month in vanilla's table. Garbage has its own key: its figure is a weight.
  numeric("processingRate", game("Properties.DECEASED_PROCESSING_CAPACITY", "Processing"), { unit: "/mo.", measure: "perMonth" }),
  // GarbageFacilityData.m_ProcessingSpeed — kilograms a month, so it goes
  // through the game's WeightPerMonth rule rather than wearing "t/mo" raw.
  numeric("garbageProcessing", game("Properties.GARBAGE_PROCESSING_CAPACITY", "Processing"), {
    unit: "t/mo.",
    measure: "weightPerMonth",
  }),
  // PostFacilityData.m_SortingRate — mail items a month, an integer per
  // month in vanilla's table, not a weight.
  numeric("sortingRate", game("Properties.MAIL_SORTING_RATE", "Sorting"), { unit: "/mo.", measure: "perMonth" }),
  // Most of vanilla's counts are what an upgrade IS — an ambulance depot, a
  // hearse garage, jail cells — so they are the whole content of its card.
  numeric("jailCapacity", game("Properties.JAIL_CAPACITY", "Jail capacity")),
  numeric("collectionTrucks", game("Properties.GARBAGE_TRUCK_COUNT", "Collection trucks")),
  numeric("postVans", game("Properties.POST_VAN_COUNT", "Post vans")),
  numeric("postTrucks", game("Properties.POST_TRUCK_COUNT", "Post trucks")),
  numeric("ambulances", game("Properties.AMBULANCE_COUNT", "Ambulances")),
  numeric("hearses", game("Properties.HEARSE_COUNT", "Hearses")),
  numeric("prisonVans", game("Properties.PRISON_VAN_COUNT", "Prison vans")),
  // TransportDepotData.m_VehicleCapacity — the game says "Vehicles" too.
  numeric("depotVehicles", game("Properties.TRANSPORT_VEHICLE_COUNT", "Vehicles")),
  numeric("maintenanceVehicles", game("Properties.MAINTENANCE_VEHICLES", "Maintenance vehicles")),
  // Ours: the medical, fire and police helicopter counts, three keys in vanilla.
  numeric("helicopters", ours("Helicopters", "Helicopters"), { vanilla: true }),
  numeric("disasterResponse", ours("DisasterResponse", "Disaster response")),
  numeric("shelterVehicles", game("Properties.EVACUATION_BUS_COUNT", "Evacuation buses")),
  // For a building whose Capacity line is another role's figure: an
  // incinerator's is its garbage store.
  numeric("powerOutput", game("Properties.POWER_PLANT_OUTPUT", "Power output"), { unit: "MW", measure: "power" }),
  // ElectricityConnectionData.m_Capacity. Vanilla binds TRANSFORMER_CAPACITY
  // and POWER_LINE_CAPACITY with the power unit — hundreds of watts — so the
  // raw figure is not megawatts.
  numeric("electricityCapacity", game("Properties.POWER_LINE_CAPACITY", "Grid capacity"), { unit: "MW", measure: "power" }),
  // ElectricityUIUtils.GetVoltage's three answers, in the game's own
  // Properties.VOLTAGE words.
  worded("voltage", ours("Voltage", "Voltage"), { values: VOLTAGE_WORDS, vanilla: true }),
  // For a building whose Capacity line is another role's figure.
  numeric("garbageStorage", game("Properties.GARBAGE_STORAGE", "Garbage storage"), { unit: "t", measure: "weight" }),
  // BatteryData.m_PowerOutput, bound with the power unit: hundreds of watts,
  // so it goes through the game's kW/MW rule rather than wearing "MW" raw.
  numeric("batteryOutput", game("Properties.BATTERY_POWER_OUTPUT", "Output"), { unit: "MW", measure: "power" }),
  // The smaller of what its two sides carry, in the power unit, as a power
  // line's capacity is.
  numeric("transformerCapacity", game("Properties.TRANSFORMER_CAPACITY", "Transformer capacity"), { unit: "MW", measure: "power" }),
  worded("transformerInput", game("Properties.TRANSFORMER_INPUT", "Electricity input"), { values: VOLTAGE_WORDS }),
  worded("transformerOutput", game("Properties.TRANSFORMER_OUTPUT", "Electricity output"), { values: VOLTAGE_WORDS }),
  // WaterConnectionBinder's Properties.WATER_PIPE_TYPE words, for the pipes a road
  // carries built in. Its own label: a road's features already read "Carries".
  worded("pipeType", ours("PipeType", "Water pipes"), {
    values: {
      Fresh: game("Properties.WATER_PIPE_TYPE[Fresh]", "Fresh water"),
      Sewage: game("Properties.WATER_PIPE_TYPE[Sewage]", "Sewage"),
      Combined: game("Properties.WATER_PIPE_TYPE[Combined]", "Water and sewage"),
    },
    vanilla: true,
  }),
  // Ours: no binder shows it, and nothing in the simulation reads the amount.
  numeric("stormCapacity", ours("StormCapacity", "Stormwater"), { unit: "m³", measure: "volume" }),
  // StorageLimitBinder's line. StorageLimitData.m_Limit is kilograms bound
  // with the weight unit, so it follows the unit system.
  numeric("cargoCapacity", game("Properties.CARGO_CAPACITY", "Cargo capacity"), { unit: "t", measure: "weight" }),
  // MailBoxData.m_MailCapacity, an integer.
  numeric("mailboxCapacity", game("Properties.MAIL_BOX_CAPACITY", "Mailbox capacity")),
  // Ours: WATER_PURIFICATION_RATE for a pumping station, SEWAGE_ for an outlet.
  numeric("purification", ours("Purification", "Purification"), { unit: "%", vanilla: true }),
  // RequiredResourceBinder's wording — Properties.MAP_RESOURCE[GroundWater] /
  // [SurfaceWater] — and its silence: a water tower allows no type at all.
  worded("waterSource", game("Properties.REQUIRED_RESOURCE", "Draws from"), {
    values: {
      GroundWater: game("Properties.MAP_RESOURCE[GroundWater]", "Ground water"),
      SurfaceWater: game("Properties.MAP_RESOURCE[SurfaceWater]", "Surface water"),
    },
    omit: ["None"],
  }),
  numeric("maintenancePool", ours("MaintenancePool", "Maintenance")),
  // TransportStopBinder's counts: a building's passenger stops, one line per kind,
  // under the game's own Properties.TRANSPORT_STOP_COUNT words.
  numeric("airplaneStops", game("Properties.TRANSPORT_STOP_COUNT[Airplane]", "Gates")),
  numeric("helicopterStops", game("Properties.TRANSPORT_STOP_COUNT[Helicopter]", "Landing pads")),
  numeric("shipStops", game("Properties.TRANSPORT_STOP_COUNT[Ship]", "Piers")),
  numeric("subwayStops", game("Properties.TRANSPORT_STOP_COUNT[Subway]", "Subway platforms")),
  numeric("tramStops", game("Properties.TRANSPORT_STOP_COUNT[Tram]", "Tram platforms")),
  numeric("trainStops", game("Properties.TRANSPORT_STOP_COUNT[Train]", "Train platforms")),
  numeric("busStops", game("Properties.TRANSPORT_STOP_COUNT[Bus]", "Bus platforms")),
  // The game shows round(100 × m_ComfortFactor) as a whole number and the index
  // scales it the same way, so this is a count and not the raw multiplier.
  numeric("comfort", game("Properties.COMFORT", "Comfort")),
  worded("transportType", ours("TransportType", "Transport")),
  worded("trackType", ours("TrackType", "Track")),

  // 2. How well.
  // SchoolData.m_GraduationModifier, already ×100 by the indexer: points added
  // to the graduation probability (GraduationSystem ends on "+ modifier"), not
  // a factor on it.
  numeric("graduation", ours("Graduation", "Graduation"), { unit: "%", signed: true }),
  // Offsets to happiness, so each carries its sign: a penalty is as much a
  // figure as a bonus.
  numeric("studentWellbeing", ours("StudentWellbeing", "Student wellbeing"), { signed: true }),
  numeric("studentHealth", ours("StudentHealth", "Student health"), { signed: true }),
  numeric("prisonerWellbeing", ours("PrisonerWellbeing", "Inmate wellbeing"), { signed: true }),
  numeric("prisonerHealth", ours("PrisonerHealth", "Inmate health"), { signed: true }),
  numeric("attractiveness", game("Properties.ATTRACTIVENESS", "Attractiveness")),
  // PollutionBinder's levels. It sends a level of none too, and a line saying so
  // is noise beside the ones that are not.
  worded("groundPollutionLevel", game("SelectedInfoPanel.POLLUTION_LEVELS_GROUND", "Ground pollution"), {
    values: POLLUTION_WORDS,
    omit: ["None"],
  }),
  worded("airPollutionLevel", game("SelectedInfoPanel.POLLUTION_LEVELS_AIR", "Air pollution"), {
    values: POLLUTION_WORDS,
    omit: ["None"],
  }),
  worded("noisePollutionLevel", game("SelectedInfoPanel.POLLUTION_LEVELS_NOISE", "Noise pollution"), {
    values: POLLUTION_WORDS,
    omit: ["None"],
  }),
  // PollutionModifierData factors, already ×100 by the indexer: a change, where
  // 0 is none, so vanilla shows them signed, as a percentage under the pollution
  // level's own name. It authors the component only on service upgrades.
  numeric("groundPollutionModifier", game("SelectedInfoPanel.POLLUTION_LEVELS_GROUND", "Ground pollution"), { unit: "%", signed: true }),
  numeric("airPollutionModifier", game("SelectedInfoPanel.POLLUTION_LEVELS_AIR", "Air pollution"), { unit: "%", signed: true }),
  numeric("noisePollutionModifier", game("SelectedInfoPanel.POLLUTION_LEVELS_NOISE", "Noise pollution"), { unit: "%", signed: true }),
  // UpkeepModifierData, only on BuildingExtensionPrefab: the largest multiplier minus
  // one, in percent, signed as vanilla binds it. Not the money upkeep, whatever its
  // name: the game applies it to what a building consumes, as RESOURCE_CONSUMPTION.
  numeric("resourceConsumption", game("Properties.RESOURCE_CONSUMPTION", "Resource consumption"), { unit: "%", signed: true }),

  // 3. Who runs it.
  worded("jobComplexity", ours("JobComplexity", "Jobs"), {
    // OUR words. The game ships none for WorkplaceComplexity — its
    // CITIZEN_JOB_LEVEL vocabulary is Basic/Manager/Senior/Specialist and
    // describes a citizen's rank, not a workplace's kind.
    values: {
      Manual: ours("JobsManual", "Manual"),
      Simple: ours("JobsSimple", "Simple"),
      Complex: ours("JobsComplex", "Complex"),
      Hitech: ours("JobsHitech", "Hi-tech"),
    },
  }),
  numeric("minCrew", ours("MinCrew", "Min crew")),
  numeric("workConditions", ours("WorkConditions", "Conditions"), { signed: true }),
  numeric("eveningShift", ours("EveningShift", "Evening shift"), { unit: "%" }),
  numeric("nightShift", ours("NightShift", "Night shift"), { unit: "%" }),

  // 4. Placement, network and zone.
  // A LENGTH, so it follows the player's unit system rather than carrying a
  // hard "m" beside a width already stated in feet.
  numeric("elevatedWidth", ours("ElevatedWidth", "Elevated width"), { unit: "m", measure: "length" }),
  worded("roadFeature", ours("RoadFeature", "Carries"), {
    values: {
      trafficLights: ours("RoadFeatureTrafficLights", "traffic lights"),
      highwayRules: ours("RoadFeatureHighwayRules", "highway rules"),
      zonesAlongside: ours("RoadFeatureZonesAlongside", "zoning"),
      underground: ours("RoadFeatureUnderground", "an underground form"),
    },
  }),
  // Zones. Per cell rather than per building, which is what a zone is: a rate
  // the player paints rather than a thing they place.
  numeric("zoneMaxHeight", ours("ZoneHeight", "Height"), { unit: "m", measure: "height" }),
  // ZoneProperties: without ScaleResidentials the figure is the building's
  // fixed count (low density); with it, apartments per cell, multiplied by
  // lot size and level. The same "1" means different things, so two keys.
  numeric("zoneHouseholds", ours("ZoneHouseholds", "Homes")),
  // A rate, and a fractional one: 1.4 homes a cell is not 1.
  numeric("zoneHouseholdsPerCell", ours("ZoneHouseholds", "Homes"), { unit: "/cell", decimals: 1 }),
  // The authoring tooltip: "an abstraction of amount of floors in a
  // building"; a high value means bigger apartments.
  numeric("zoneSpace", ours("ZoneSpace", "Floor space"), { multiplier: true }),
  // The one consumption coefficient the game reads, money per cell per month at
  // level 1 (PropertyRenterSystem.GetUpkeep: level^exp × this × lotSize). Ours:
  // the renters pay it, where the game's UPKEEP is what the city pays.
  numeric("zoneUpkeep", ours("Upkeep", "Upkeep"), { measure: "moneyPerCellPerMonth" }),
  numeric("zoneFireHazard", ours("ZoneFireHazard", "Fire hazard"), { multiplier: true }),
  worded("zoneLotShapes", ours("ZoneLotShapes", "Lot shapes"), {
    // Our own keys, not the ZoneNarrowLots / ZoneCorners the registry owns:
    // those are sentence fragments, and reusing them here would read wrong
    // in a label/value pair or force a casing change on other renderers.
    values: {
      narrow: ours("ZoneShapeNarrow", "Narrow"),
      corners: ours("ZoneShapeCorners", "Corners"),
    },
  }),
  worded("zoneSold", ours("ZoneSold", "Sells")),
  worded("zoneManufactured", ours("ZoneManufactured", "Makes")),
  worded("zoneStored", ours("ZoneStored", "Stores")),
  worded("facilityFeature", ours("FacilityFeature", "Also"), {
    values: {
      longTermStorage: ours("FacilityFeatureLongTermStorage", "stores long term"),
      industrialWasteOnly: ours("FacilityFeatureIndustrialWaste", "industrial waste only"),
      signalThroughTerrain: ours("FacilityFeatureThroughTerrain", "reaches through terrain"),
    },
  }),
  worded("zoneFeature", ours("ZoneFeature", "Also"), {
    values: { ignoresLandValue: ours("ZoneFeatureIgnoresLandValue", "ignores land value") },
  }),
  numeric("xpReward", ours("XpReward", "XP")),
];

const NUMERIC_FACTS: Readonly<Record<string, NumericFact>> = Object.fromEntries(
  SERVICE_FACTS.filter((fact): fact is NumericFact => fact.kind === "numeric").map((fact) => [fact.key, fact]),
);

const WORDED_FACTS: Readonly<Record<string, WordedFact>> = Object.fromEntries(
  SERVICE_FACTS.filter((fact): fact is WordedFact => fact.kind === "worded").map((fact) => [fact.key, fact]),
);

/** The keys this build knows how to draw, for the localization audit. */
export const SERVICE_FACT_KEYS: readonly string[] = Object.keys(NUMERIC_FACTS);

/**
 * Every label a service fact can ask for, and every word of ours for a value.
 * The locale audits read it, since the table builds our keys rather than spelling them.
 */
export const SERVICE_FACT_LOCALIZATION_KEYS: readonly string[] = [...new Set(SERVICE_FACTS.flatMap((fact) => [
  fact.localizationKey,
  ...Object.values(fact.kind === "worded" ? fact.values ?? {} : {})
    .map((word) => word.localizationKey)
    .filter(isOurKey),
]))];

export interface RenderedServiceFact {
  key: string;
  label: string;
  value: string;
}

/**
 * The facts this build can draw, in the order the indexer recorded them. A key
 * with no entry here is DROPPED rather than shown raw: a player can run a
 * mismatched pair of halves, and a bare token on a card is worse than no line.
 */
export function renderServiceFacts(
  facts: readonly ServiceFact[] | null | undefined,
  translate: (key: string, fallback: string | null) => string | null,
  formatNumber: FormatNumber = (value) => String(value),
  // Injected like formatNumber, and for the same reason: this module is
  // imported by pure siblings and must not reach into the metric formatter.
  measured: Partial<Record<Measure, (value: number) => string>> = {},
): RenderedServiceFact[] {
  if (!facts || facts.length === 0) {
    return [];
  }

  const rendered: RenderedServiceFact[] = [];

  for (const fact of facts) {
    const presentation = NUMERIC_FACTS[fact?.key ?? ""] ?? resourceUpkeepPresentation(fact?.key ?? "");

    if (!presentation) continue;
    if (typeof fact.value !== "number" || !Number.isFinite(fact.value)) continue;

    const label = translate(presentation.localizationKey, null) ?? presentation.fallback;

    let value: string;

    const measured_ = presentation.measure ? measured[presentation.measure] : undefined;

    if (measured_) {
      rendered.push({ key: fact.key, label, value: measured_(fact.value) });
      continue;
    }

    if (presentation.multiplier) {
      // Two decimals: floor space of 1.15 is a different zone from 1.5, and
      // rounding to whole numbers makes both read "×1".
      value = `×${(Math.round(fact.value * 100) / 100).toFixed(2).replace(/0$/, "")}`;
    } else {
      const scale = 10 ** (presentation.decimals ?? 0);
      const rounded = Math.round(fact.value * scale) / scale;
      const number = presentation.signed
        ? `${rounded < 0 ? "-" : "+"}${formatNumber(Math.abs(rounded))}`
        : formatNumber(rounded);
      value = presentation.unit === "" ? number : `${number} ${presentation.unit}`;
    }

    rendered.push({ key: fact.key, label, value });
  }

  return rendered;
}

/** The worded keys this build knows how to draw, for the coverage audit. */
export const SERVICE_TEXT_FACT_KEYS: readonly string[] = Object.keys(WORDED_FACTS);

/**
 * The worded facts, one line per key. Grouped, because a zone reports its lot
 * shapes as one fact per shape and two lines with the same label are one fact
 * printed twice. A key with no wording is dropped, as the numeric ones are.
 */
export function renderServiceTextFacts(
  facts: readonly ServiceTextFact[] | null | undefined,
  translate: (key: string, fallback: string | null) => string | null,
): RenderedServiceFact[] {
  if (!facts || facts.length === 0) {
    return [];
  }

  const order: string[] = [];
  const grouped = new Map<string, string[]>();

  for (const fact of facts) {
    const presentation = WORDED_FACTS[fact?.key ?? ""];

    if (!presentation) continue;
    if (typeof fact.value !== "string" || fact.value.trim() === "") continue;

    const token = fact.value.trim();
    if (presentation.omit?.includes(token)) continue;
    const worded = presentation.values?.[token];
    const value = worded
      ? translate(worded.localizationKey, null) ?? worded.fallback
      : token;

    if (!grouped.has(fact.key)) {
      grouped.set(fact.key, []);
      order.push(fact.key);
    }

    grouped.get(fact.key)!.push(value);
  }

  return order.map((key) => ({
    key,
    label: translate(WORDED_FACTS[key].localizationKey, null) ?? WORDED_FACTS[key].fallback,
    value: grouped.get(key)!.join(", "),
  }));
}

/**
 * The facts the game's own tooltip shows — PrefabUISystem's property binders.
 * The card draws these first and bright and everything else below a divider,
 * dimmer, so ours do not blend into figures the player already knows.
 */
export const VANILLA_FACT_KEYS: ReadonlySet<string> = new Set(
  SERVICE_FACTS.filter((fact) => fact.vanilla).map((fact) => fact.key),
);

/**
 * A resource the building burns, from the ServiceUpkeepData buffer: one key
 * per resource, "upkeep:Coal", labelled with the game's own Resources.TITLE.
 * Part of vanilla's upkeep, so part of its tier: vanilla prices these into the
 * top of its upkeep range, and the card names them instead.
 */
export const RESOURCE_UPKEEP_PREFIX = "upkeep:";

const resourceUpkeepPresentation = (key: string): NumericPresentation | undefined => {
  if (!key.startsWith(RESOURCE_UPKEEP_PREFIX)) return undefined;
  const resource = key.slice(RESOURCE_UPKEEP_PREFIX.length);
  if (!/^[A-Za-z]+$/.test(resource)) return undefined;
  return { localizationKey: `Resources.TITLE[${resource}]`, fallback: resource, unit: "t/mo.", measure: "weightPerMonth" };
};

export const isVanillaFact = (key: string): boolean => VANILLA_FACT_KEYS.has(key) || key.startsWith(RESOURCE_UPKEEP_PREFIX);

const FACT_RANK = new Map(SERVICE_FACTS.map((fact, index) => [fact.key, index]));

/**
 * Sort rendered figures into the table's order, keeping unplaced keys last. Stable,
 * so a prefab carrying keys the order does not name still draws deterministically.
 */
export function orderFacts<T extends { key: string }>(facts: readonly T[]): T[] {
  return facts
    .map((fact, index) => ({ fact, index }))
    .sort((left, right) => {
      const leftRank = FACT_RANK.get(left.fact.key) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = FACT_RANK.get(right.fact.key) ?? Number.MAX_SAFE_INTEGER;
      return leftRank === rightRank ? left.index - right.index : leftRank - rightRank;
    })
    .map((entry) => entry.fact);
}
