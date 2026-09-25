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

interface ServiceFactPresentation {
  /** Our own key, so a translation can be shipped for it. */
  localizationKey: string;
  fallback: string;
  /** Appended after the number; "" for a bare count. */
  unit: string;
  /** A multiplier reads as "×1.2", not as a quantity. */
  multiplier?: boolean;
  /** A change, so a positive figure carries its "+" — vanilla's signed binder. */
  signed?: boolean;
  /**
   * Follows the player's unit system instead of carrying a fixed `unit`. Each
   * name is one of vanilla's own rules, and a per-distance cost converts its
   * figure as well as its suffix.
   */
  measure?: "length" | "height" | "volume" | "moneyPerDistance" | "moneyPerCellPerMonth" | "weight" | "weightPerMonth" | "perMonth" | "power";
}

const PRESENTATION: Readonly<Record<string, ServiceFactPresentation>> = {
  helicopters: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Helicopters]",
    fallback: "Helicopters",
    unit: "",
  },
  disasterResponse: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.DisasterResponse]",
    fallback: "Disaster response",
    unit: "",
  },
  processingRate: {
    // DeathcareFacilityData.m_ProcessingRate — bodies a month, an integer per
    // month in vanilla's table. Garbage has its own key below because its
    // figure is a weight, and a crematorium's bodies are not tonnes.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ProcessingRate]",
    fallback: "Processing",
    unit: "/mo.",
    measure: "perMonth",
  },
  garbageProcessing: {
    // GarbageFacilityData.m_ProcessingSpeed — kilograms a month, so it goes
    // through the game's WeightPerMonth rule rather than wearing "t/mo" raw.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.GarbageProcessing]",
    fallback: "Processing",
    unit: "t/mo.",
    measure: "weightPerMonth",
  },
  collectionTrucks: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.CollectionTrucks]",
    fallback: "Collection trucks",
    unit: "",
  },
  sortingRate: {
    // PostFacilityData.m_SortingRate — mail items a month, an integer per
    // month in vanilla's table, not a weight.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.SortingRate]",
    fallback: "Sorting",
    unit: "/mo.",
    measure: "perMonth",
  },
  postVans: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PostVans]",
    fallback: "Post vans",
    unit: "",
  },
  graduation: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Graduation]",
    fallback: "Graduation",
    unit: "",
    multiplier: true,
  },
  attractiveness: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Attractiveness]",
    fallback: "Attractiveness",
    unit: "",
  },

  // Zones. Per cell rather than per building, which is what a zone is: a rate
  // the player paints rather than a thing they place.
  // Properties.MAIL_BOX_CAPACITY: MailBoxData.m_MailCapacity, an integer.
  mailboxCapacity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.MailboxCapacity]",
    fallback: "Mailbox capacity",
    unit: "",
  },
  // ZoneProperties: without ScaleResidentials the figure is the building's
  // fixed count (low density); with it, apartments per cell, multiplied by
  // lot size and level. The same "1" means different things, so two keys.
  zoneHouseholds: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]",
    fallback: "Homes",
    unit: "",
  },
  zoneHouseholdsPerCell: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]",
    fallback: "Homes",
    unit: "/cell",
  },
  zoneMaxHeight: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHeight]",
    fallback: "Height",
    unit: "m",
    measure: "height",
  },
  // The one consumption coefficient the game reads: PropertyRenterSystem's
  // GetUpkeep is level^exp × this × lotSize, so at level 1 it is money per cell
  // per month. Its unread neighbours are not facts and get no presentation.
  zoneUpkeep: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Upkeep]",
    fallback: "Upkeep",
    unit: "",
    measure: "moneyPerCellPerMonth",
  },
  minCrew: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.MinCrew]",
    fallback: "Min crew",
    unit: "",
  },
  eveningShift: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.EveningShift]",
    fallback: "Evening shift",
    unit: "%",
  },
  nightShift: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.NightShift]",
    fallback: "Night shift",
    unit: "%",
  },
  workConditions: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.WorkConditions]",
    fallback: "Conditions",
    unit: "",
  },
  xpReward: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.XpReward]",
    fallback: "XP",
    unit: "",
  },
  studentWellbeing: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.StudentWellbeing]",
    fallback: "Student wellbeing",
    unit: "",
  },
  studentHealth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.StudentHealth]",
    fallback: "Student health",
    unit: "",
  },
  prisonerWellbeing: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PrisonerWellbeing]",
    fallback: "Inmate wellbeing",
    unit: "",
  },
  prisonerHealth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PrisonerHealth]",
    fallback: "Inmate health",
    unit: "",
  },
  purification: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Purification]",
    fallback: "Purification",
    unit: "%",
  },
  batteryOutput: {
    // BatteryData.m_PowerOutput, bound with the power unit: hundreds of watts,
    // so it goes through the game's kW/MW rule rather than wearing "MW" raw.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.BatteryOutput]",
    fallback: "Output",
    unit: "MW",
    measure: "power",
  },
  maintenancePool: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.MaintenancePool]",
    fallback: "Maintenance",
    unit: "",
  },
  shelterVehicles: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ShelterVehicles]",
    fallback: "Shelter vans",
    unit: "",
  },
  // Properties.COMFORT: the game shows round(100 × m_ComfortFactor) as a whole
  // number and the index scales it the same way, so this is a count and not
  // the raw multiplier.
  comfort: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Comfort]",
    fallback: "Comfort",
    unit: "",
  },
  electricityCapacity: {
    // ElectricityConnectionData.m_Capacity. Vanilla binds TRANSFORMER_CAPACITY
    // and POWER_LINE_CAPACITY with the power unit — hundreds of watts — so the
    // raw figure is not megawatts.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElectricityCapacity]",
    fallback: "Grid capacity",
    unit: "MW",
    measure: "power",
  },
  stormCapacity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.StormCapacity]",
    fallback: "Stormwater",
    unit: "m³",
    measure: "volume",
  },
  cargoCapacity: {
    // Vanilla's Properties.CARGO_CAPACITY wording under our own key, because
    // every entry in this table ships its own string. StorageLimitData.m_Limit
    // is kilograms bound with the weight unit, so it follows the unit system.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.CargoCapacity]",
    fallback: "Cargo capacity",
    unit: "t",
    measure: "weight",
  },
  // The rest of what vanilla's tooltip carries. Most are what an upgrade IS —
  // an ambulance depot, a hearse garage, jail cells, a modifier on the parent's
  // upkeep — so they are the whole content of an upgrade's card.
  ambulances: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Ambulances]", fallback: "Ambulances", unit: "" },
  hearses: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Hearses]", fallback: "Hearses", unit: "" },
  prisonVans: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PrisonVans]", fallback: "Prison vans", unit: "" },
  postTrucks: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PostTrucks]", fallback: "Post trucks", unit: "" },
  // TransportDepotData.m_VehicleCapacity — the game says "Vehicles" too.
  depotVehicles: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.DepotVehicles]", fallback: "Vehicles", unit: "" },
  maintenanceVehicles: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.MaintenanceVehicles]", fallback: "Maintenance vehicles", unit: "" },
  jailCapacity: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JailCapacity]", fallback: "Jail capacity", unit: "" },
  // PollutionModifierData factors, already ×100 by the indexer: a change, where
  // 0 is none, so vanilla shows them signed, as a percentage under the pollution
  // level's own name. It authors the component only on service upgrades.
  groundPollutionModifier: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.GroundPollutionModifier]", fallback: "Ground pollution", unit: "%", signed: true },
  airPollutionModifier: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.AirPollutionModifier]", fallback: "Air pollution", unit: "%", signed: true },
  noisePollutionModifier: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.NoisePollutionModifier]", fallback: "Noise pollution", unit: "%", signed: true },
  // UpkeepModifierData: the largest multiplier minus one, in percent, signed as
  // vanilla binds it, and authored only on BuildingExtensionPrefab. Not the money
  // upkeep, whatever the component's name: the game applies it to the resources
  // a building consumes, and labels it RESOURCE_CONSUMPTION.
  resourceConsumption: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ResourceConsumption]",
    fallback: "Resource consumption",
    unit: "%",
    signed: true,
  },
  elevatedWidth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElevatedWidth]",
    fallback: "Elevated width",
    unit: "m",
    // A LENGTH, so it follows the player's unit system rather than carrying a
    // hard "m" beside a width already stated in feet.
    measure: "length",
  },
  elevationCost: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElevationCost]",
    fallback: "Elevation",
    unit: "¢/km",
    // Money, so it goes through the game's own per-distance template rather
    // than bolting "¢/km" onto a number and putting the symbol on the wrong
    // side of every other cost on the card.
    measure: "moneyPerDistance",
  },
  zoneSpace: {
    // The authoring tooltip: "an abstraction of amount of floors in a
    // building"; a high value means bigger apartments.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneSpace]",
    fallback: "Floor space",
    unit: "",
    multiplier: true,
  },
  zoneFireHazard: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneFireHazard]",
    fallback: "Fire hazard",
    unit: "",
    multiplier: true,
  },
};

/** The keys this build knows how to draw, for the localization audit. */
export const SERVICE_FACT_KEYS: readonly string[] = Object.keys(PRESENTATION);

/** Every localization key a service fact can ask for. */
export const SERVICE_FACT_LOCALIZATION_KEYS: readonly string[] =
  Object.values(PRESENTATION).map((entry) => entry.localizationKey);

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
  measured: Partial<Record<NonNullable<ServiceFactPresentation["measure"]>, (value: number) => string>> = {},
): RenderedServiceFact[] {
  if (!facts || facts.length === 0) {
    return [];
  }

  const rendered: RenderedServiceFact[] = [];

  for (const fact of facts) {
    const presentation = PRESENTATION[fact?.key ?? ""] ?? resourceUpkeepPresentation(fact?.key ?? "");

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
      // One decimal: a graduation modifier of 1.15 is a different building
      // from one of 1.5, and rounding to whole numbers makes both read "×1".
      value = `×${(Math.round(fact.value * 100) / 100).toFixed(2).replace(/0$/, "")}`;
    } else {
      const rounded = Math.round(fact.value);
      const number = presentation.signed
        ? `${rounded < 0 ? "-" : "+"}${formatNumber(Math.abs(rounded))}`
        : formatNumber(rounded);
      value = presentation.unit === "" ? number : `${number} ${presentation.unit}`;
    }

    rendered.push({ key: fact.key, label, value });
  }

  return rendered;
}


interface ServiceTextPresentation {
  localizationKey: string;
  fallback: string;
  /**
   * Words for the VALUE, where it is one of ours rather than the game's: a
   * traded resource arrives already named, but "narrow" and "corners" are our
   * tokens and need our words.
   */
  values?: Readonly<Record<string, { localizationKey: string; fallback: string }>>;
  /** Tokens that mean "nothing to say" and draw no line — an enum's None. */
  omit?: readonly string[];
}

const TEXT_PRESENTATION: Readonly<Record<string, ServiceTextPresentation>> = {
  // RequiredResourceBinder: the map feature an extractor's product needs,
  // worded with the game's own Properties.MAP_RESOURCE[<feature>] strings.
  requiredResource: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.RequiredResource]",
    fallback: "Requires",
    values: {
      Ore: { localizationKey: "Properties.MAP_RESOURCE[Ore]", fallback: "Ore" },
      Oil: { localizationKey: "Properties.MAP_RESOURCE[Oil]", fallback: "Oil" },
      Forest: { localizationKey: "Properties.MAP_RESOURCE[Forest]", fallback: "Forest" },
      FertileLand: { localizationKey: "Properties.MAP_RESOURCE[FertileLand]", fallback: "Fertile land" },
    },
  },
  zoneSold: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneSold]",
    fallback: "Sells",
  },
  zoneManufactured: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneManufactured]",
    fallback: "Makes",
  },
  zoneStored: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneStored]",
    fallback: "Stores",
  },
  jobComplexity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JobComplexity]",
    fallback: "Jobs",
    values: {
      // OUR words. The game ships none for WorkplaceComplexity — its
      // CITIZEN_JOB_LEVEL vocabulary is Basic/Manager/Senior/Specialist and
      // describes a citizen's rank, not a workplace's kind.
      Manual: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JobsManual]", fallback: "Manual" },
      Simple: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JobsSimple]", fallback: "Simple" },
      Complex: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JobsComplex]", fallback: "Complex" },
      Hitech: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JobsHitech]", fallback: "Hi-tech" },
    },
  },
  zoneLotShapes: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneLotShapes]",
    fallback: "Lot shapes",
    values: {
      // Our own keys, not the ZoneNarrowLots / ZoneCorners the registry owns:
      // those are sentence fragments, and reusing them here would read wrong
      // in a label/value pair or force a casing change on other renderers.
      narrow: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneShapeNarrow]", fallback: "Narrow" },
      corners: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneShapeCorners]", fallback: "Corners" },
    },
  },
  trackType: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.TrackType]",
    fallback: "Track",
  },
  transportType: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.TransportType]",
    fallback: "Transport",
  },
  voltage: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Voltage]",
    fallback: "Voltage",
  },
  // RequiredResourceBinder's wording — Properties.MAP_RESOURCE[GroundWater] /
  // [SurfaceWater] — and its silence: a water tower allows no type at all.
  waterSource: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.WaterSource]",
    fallback: "Draws from",
    values: {
      GroundWater: { localizationKey: "Properties.MAP_RESOURCE[GroundWater]", fallback: "Ground water" },
      SurfaceWater: { localizationKey: "Properties.MAP_RESOURCE[SurfaceWater]", fallback: "Surface water" },
    },
    omit: ["None"],
  },
  roadFeature: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.RoadFeature]",
    fallback: "Carries",
    values: {
      trafficLights: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.RoadFeatureTrafficLights]", fallback: "traffic lights" },
      highwayRules: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.RoadFeatureHighwayRules]", fallback: "highway rules" },
      zonesAlongside: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.RoadFeatureZonesAlongside]", fallback: "zoning" },
      underground: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.RoadFeatureUnderground]", fallback: "an underground form" },
    },
  },
  facilityFeature: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.FacilityFeature]",
    fallback: "Also",
    values: {
      longTermStorage: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.FacilityFeatureLongTermStorage]", fallback: "stores long term" },
      industrialWasteOnly: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.FacilityFeatureIndustrialWaste]", fallback: "industrial waste only" },
      signalThroughTerrain: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.FacilityFeatureThroughTerrain]", fallback: "reaches through terrain" },
    },
  },
  zoneFeature: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneFeature]",
    fallback: "Also",
    values: {
      ignoresLandValue: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneFeatureIgnoresLandValue]", fallback: "ignores land value" },
    },
  },
};

/** The worded keys this build knows how to draw, for the coverage audit. */
export const SERVICE_TEXT_FACT_KEYS: readonly string[] = Object.keys(TEXT_PRESENTATION);

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
    const presentation = TEXT_PRESENTATION[fact?.key ?? ""];

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
    label: translate(TEXT_PRESENTATION[key].localizationKey, null) ?? TEXT_PRESENTATION[key].fallback,
    value: grouped.get(key)!.join(", "),
  }));
}

/**
 * The facts the game's own tooltip shows — PrefabUISystem's property binders.
 * The card draws these first and bright and everything else below a divider,
 * dimmer, so ours do not blend into figures the player already knows.
 */
export const VANILLA_FACT_KEYS: ReadonlySet<string> = new Set([
  // rates and capacities
  "processingRate", "garbageProcessing", "sortingRate", "purification", "cargoCapacity", "jailCapacity", "stormCapacity",
  // vehicle counts
  "collectionTrucks", "postVans", "postTrucks", "ambulances", "hearses", "prisonVans",
  "depotVehicles", "maintenanceVehicles", "helicopters", "shelterVehicles",
  // electricity
  "batteryOutput", "electricityCapacity", "voltage",
  // quality and modifiers
  "comfort", "attractiveness", "groundPollutionModifier", "airPollutionModifier", "noisePollutionModifier", "resourceConsumption",
  // mail
  "mailboxCapacity",
  // worded
  "waterSource", "transportType", "requiredResource",
]);

/**
 * A resource the building burns, from the ServiceUpkeepData buffer: one key
 * per resource, "upkeep:Coal", labelled with the game's own Resources.TITLE.
 * Part of vanilla's upkeep, so part of its tier.
 */
export const RESOURCE_UPKEEP_PREFIX = "upkeep:";

const resourceUpkeepPresentation = (key: string): ServiceFactPresentation | undefined => {
  if (!key.startsWith(RESOURCE_UPKEEP_PREFIX)) return undefined;
  const resource = key.slice(RESOURCE_UPKEEP_PREFIX.length);
  if (!/^[A-Za-z]+$/.test(resource)) return undefined;
  return { localizationKey: `Resources.TITLE[${resource}]`, fallback: resource, unit: "t/mo.", measure: "weightPerMonth" };
};

export const isVanillaFact = (key: string): boolean => VANILLA_FACT_KEYS.has(key) || key.startsWith(RESOURCE_UPKEEP_PREFIX);

/**
 * One order for every card, whatever order the indexer emitted in, so a reader
 * learns where to look instead of re-reading. Worded and numeric figures share
 * it; an unlisted key sorts to the end rather than being dropped.
 */
export const FACT_ORDER: readonly string[] = [
  // 1. What it does. The required resource first, as vanilla binds it.
  "requiredResource", "processingRate", "garbageProcessing", "sortingRate", "jailCapacity",
  "collectionTrucks", "postVans", "postTrucks", "ambulances", "hearses", "prisonVans",
  "depotVehicles", "maintenanceVehicles",
  "helicopters", "disasterResponse", "shelterVehicles",
  "batteryOutput", "electricityCapacity", "stormCapacity", "cargoCapacity", "mailboxCapacity",
  "purification", "waterSource", "maintenancePool", "comfort",
  "transportType", "trackType",
  // 2. How well.
  "graduation", "studentWellbeing", "studentHealth",
  "prisonerWellbeing", "prisonerHealth", "attractiveness",
  "groundPollutionModifier", "airPollutionModifier", "noisePollutionModifier", "resourceConsumption",
  // 3. Who runs it.
  "jobComplexity", "minCrew", "workConditions", "eveningShift", "nightShift",
  // 4. Placement, network and zone.
  "elevatedWidth", "elevationCost", "voltage", "roadFeature",
  "zoneMaxHeight", "zoneHouseholds", "zoneHouseholdsPerCell", "zoneSpace",
  "zoneUpkeep", "zoneFireHazard", "zoneLotShapes",
  "zoneSold", "zoneManufactured", "zoneStored",
  "facilityFeature", "zoneFeature",
  "xpReward",
];

const FACT_RANK = new Map(FACT_ORDER.map((key, index) => [key, index]));

/**
 * Sort rendered figures into FACT_ORDER, keeping unplaced keys last. Stable,
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
