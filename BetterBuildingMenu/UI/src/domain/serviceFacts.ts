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
  /** The game's own key where vanilla's tooltip draws the same line, which it
   *  translates into every language it ships; otherwise ours, so a translation
   *  can ship with the mod. Ours too where one fact stands for several of the
   *  game's lines, since no one key names it. */
  localizationKey: string;
  fallback: string;
  /** Appended after the number; "" for a bare count. */
  unit: string;
  /** Decimals kept, where a whole number would say too little; none by default. */
  decimals?: number;
  /** A multiplier reads as "×1.2", not as a quantity. */
  multiplier?: boolean;
  /** A change, so a positive figure carries its "+" — vanilla's signed binder. */
  signed?: boolean;
  /**
   * Follows the player's unit system instead of carrying a fixed `unit`. Each
   * name is one of vanilla's own rules.
   */
  measure?: "length" | "height" | "volume" | "moneyPerCellPerMonth" | "weight" | "weightPerMonth" | "perMonth" | "power";
}

const PRESENTATION: Readonly<Record<string, ServiceFactPresentation>> = {
  // Ours: the medical, fire and police helicopter counts, three keys in vanilla.
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
    localizationKey: "Properties.DECEASED_PROCESSING_CAPACITY",
    fallback: "Processing",
    unit: "/mo.",
    measure: "perMonth",
  },
  garbageProcessing: {
    // GarbageFacilityData.m_ProcessingSpeed — kilograms a month, so it goes
    // through the game's WeightPerMonth rule rather than wearing "t/mo" raw.
    localizationKey: "Properties.GARBAGE_PROCESSING_CAPACITY",
    fallback: "Processing",
    unit: "t/mo.",
    measure: "weightPerMonth",
  },
  collectionTrucks: {
    localizationKey: "Properties.GARBAGE_TRUCK_COUNT",
    fallback: "Collection trucks",
    unit: "",
  },
  sortingRate: {
    // PostFacilityData.m_SortingRate — mail items a month, an integer per
    // month in vanilla's table, not a weight.
    localizationKey: "Properties.MAIL_SORTING_RATE",
    fallback: "Sorting",
    unit: "/mo.",
    measure: "perMonth",
  },
  postVans: {
    localizationKey: "Properties.POST_VAN_COUNT",
    fallback: "Post vans",
    unit: "",
  },
  // SchoolData.m_GraduationModifier, already ×100 by the indexer: points added
  // to the graduation probability (GraduationSystem ends on "+ modifier"), not
  // a factor on it.
  graduation: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Graduation]",
    fallback: "Graduation",
    unit: "%",
    signed: true,
  },
  attractiveness: {
    localizationKey: "Properties.ATTRACTIVENESS",
    fallback: "Attractiveness",
    unit: "",
  },

  // Zones. Per cell rather than per building, which is what a zone is: a rate
  // the player paints rather than a thing they place.
  // Properties.MAIL_BOX_CAPACITY: MailBoxData.m_MailCapacity, an integer.
  mailboxCapacity: {
    localizationKey: "Properties.MAIL_BOX_CAPACITY",
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
  // A rate, and a fractional one: 1.4 homes a cell is not 1.
  zoneHouseholdsPerCell: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]",
    fallback: "Homes",
    unit: "/cell",
    decimals: 1,
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
    localizationKey: "Properties.UPKEEP",
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
  // Offsets to happiness, so each carries its sign: a penalty is as much a
  // figure as a bonus.
  workConditions: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.WorkConditions]",
    fallback: "Conditions",
    unit: "",
    signed: true,
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
    signed: true,
  },
  studentHealth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.StudentHealth]",
    fallback: "Student health",
    unit: "",
    signed: true,
  },
  prisonerWellbeing: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PrisonerWellbeing]",
    fallback: "Inmate wellbeing",
    unit: "",
    signed: true,
  },
  prisonerHealth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PrisonerHealth]",
    fallback: "Inmate health",
    unit: "",
    signed: true,
  },
  // Ours: WATER_PURIFICATION_RATE for a pumping station, SEWAGE_ for an outlet.
  purification: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Purification]",
    fallback: "Purification",
    unit: "%",
  },
  batteryOutput: {
    // BatteryData.m_PowerOutput, bound with the power unit: hundreds of watts,
    // so it goes through the game's kW/MW rule rather than wearing "MW" raw.
    localizationKey: "Properties.BATTERY_POWER_OUTPUT",
    fallback: "Output",
    unit: "MW",
    measure: "power",
  },
  maintenancePool: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.MaintenancePool]",
    fallback: "Maintenance",
    unit: "",
  },
  // Properties.EVACUATION_BUS_COUNT.
  shelterVehicles: {
    localizationKey: "Properties.EVACUATION_BUS_COUNT",
    fallback: "Evacuation buses",
    unit: "",
  },
  // Properties.COMFORT: the game shows round(100 × m_ComfortFactor) as a whole
  // number and the index scales it the same way, so this is a count and not
  // the raw multiplier.
  comfort: {
    localizationKey: "Properties.COMFORT",
    fallback: "Comfort",
    unit: "",
  },
  electricityCapacity: {
    // ElectricityConnectionData.m_Capacity. Vanilla binds TRANSFORMER_CAPACITY
    // and POWER_LINE_CAPACITY with the power unit — hundreds of watts — so the
    // raw figure is not megawatts.
    localizationKey: "Properties.POWER_LINE_CAPACITY",
    fallback: "Grid capacity",
    unit: "MW",
    measure: "power",
  },
  // Ours: no binder shows it, and nothing in the simulation reads the amount.
  stormCapacity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.StormCapacity]",
    fallback: "Stormwater",
    unit: "m³",
    measure: "volume",
  },
  // Properties.TRANSFORMER_CAPACITY: the smaller of what its two sides carry,
  // in the power unit, as a power line's capacity is.
  transformerCapacity: {
    localizationKey: "Properties.TRANSFORMER_CAPACITY",
    fallback: "Transformer capacity",
    unit: "MW",
    measure: "power",
  },
  // TransportStopBinder's counts: a building's passenger stops, one line per kind,
  // under the game's own Properties.TRANSPORT_STOP_COUNT words.
  airplaneStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Airplane]", fallback: "Gates", unit: "" },
  helicopterStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Helicopter]", fallback: "Landing pads", unit: "" },
  shipStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Ship]", fallback: "Piers", unit: "" },
  subwayStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Subway]", fallback: "Subway platforms", unit: "" },
  tramStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Tram]", fallback: "Tram platforms", unit: "" },
  trainStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Train]", fallback: "Train platforms", unit: "" },
  busStops: { localizationKey: "Properties.TRANSPORT_STOP_COUNT[Bus]", fallback: "Bus platforms", unit: "" },
  // Properties.GARBAGE_STORAGE, for a building whose Capacity line is another
  // role's figure.
  garbageStorage: {
    localizationKey: "Properties.GARBAGE_STORAGE",
    fallback: "Garbage storage",
    unit: "t",
    measure: "weight",
  },
  // Properties.POWER_PLANT_OUTPUT, for a building whose Capacity line is
  // another role's figure: an incinerator's is its garbage store.
  powerOutput: {
    localizationKey: "Properties.POWER_PLANT_OUTPUT",
    fallback: "Power output",
    unit: "MW",
    measure: "power",
  },
  cargoCapacity: {
    // StorageLimitBinder's line. StorageLimitData.m_Limit is kilograms bound
    // with the weight unit, so it follows the unit system.
    localizationKey: "Properties.CARGO_CAPACITY",
    fallback: "Cargo capacity",
    unit: "t",
    measure: "weight",
  },
  // The rest of what vanilla's tooltip carries. Most are what an upgrade IS —
  // an ambulance depot, a hearse garage, jail cells, a change to what the
  // parent burns — so they are the whole content of an upgrade's card.
  ambulances: { localizationKey: "Properties.AMBULANCE_COUNT", fallback: "Ambulances", unit: "" },
  hearses: { localizationKey: "Properties.HEARSE_COUNT", fallback: "Hearses", unit: "" },
  prisonVans: { localizationKey: "Properties.PRISON_VAN_COUNT", fallback: "Prison vans", unit: "" },
  postTrucks: { localizationKey: "Properties.POST_TRUCK_COUNT", fallback: "Post trucks", unit: "" },
  // TransportDepotData.m_VehicleCapacity — the game says "Vehicles" too.
  depotVehicles: { localizationKey: "Properties.TRANSPORT_VEHICLE_COUNT", fallback: "Vehicles", unit: "" },
  maintenanceVehicles: { localizationKey: "Properties.MAINTENANCE_VEHICLES", fallback: "Maintenance vehicles", unit: "" },
  jailCapacity: { localizationKey: "Properties.JAIL_CAPACITY", fallback: "Jail capacity", unit: "" },
  // PollutionModifierData factors, already ×100 by the indexer: a change, where
  // 0 is none, so vanilla shows them signed, as a percentage under the pollution
  // level's own name. It authors the component only on service upgrades.
  groundPollutionModifier: { localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS_GROUND", fallback: "Ground pollution", unit: "%", signed: true },
  airPollutionModifier: { localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS_AIR", fallback: "Air pollution", unit: "%", signed: true },
  noisePollutionModifier: { localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS_NOISE", fallback: "Noise pollution", unit: "%", signed: true },
  // UpkeepModifierData: the largest multiplier minus one, in percent, signed as
  // vanilla binds it, and authored only on BuildingExtensionPrefab. Not the money
  // upkeep, whatever the component's name: the game applies it to the resources
  // a building consumes, and labels it RESOURCE_CONSUMPTION.
  resourceConsumption: {
    localizationKey: "Properties.RESOURCE_CONSUMPTION",
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

const VOLTAGE_WORDS = {
  Low: { localizationKey: "Properties.VOLTAGE:0", fallback: "Low" },
  High: { localizationKey: "Properties.VOLTAGE:1", fallback: "High" },
  Both: { localizationKey: "Properties.VOLTAGE:2", fallback: "Low and high" },
};

const POLLUTION_WORDS = {
  Low: { localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS:1", fallback: "Low" },
  Medium: { localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS:2", fallback: "Medium" },
  High: { localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS:3", fallback: "High" },
};

const TEXT_PRESENTATION: Readonly<Record<string, ServiceTextPresentation>> = {
  // RequiredResourceBinder: the map feature an extractor's product needs,
  // worded with the game's own Properties.MAP_RESOURCE[<feature>] strings.
  requiredResource: {
    localizationKey: "Properties.REQUIRED_RESOURCE",
    fallback: "Requires",
    values: {
      Ore: { localizationKey: "Properties.MAP_RESOURCE[Ore]", fallback: "Ore" },
      Fish: { localizationKey: "Properties.MAP_RESOURCE[Fish]", fallback: "Fish" },
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
  // ElectricityUIUtils.GetVoltage's three answers, in the game's own
  // Properties.VOLTAGE words.
  voltage: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Voltage]",
    fallback: "Voltage",
    values: VOLTAGE_WORDS,
  },
  transformerInput: {
    localizationKey: "Properties.TRANSFORMER_INPUT",
    fallback: "Electricity input",
    values: VOLTAGE_WORDS,
  },
  transformerOutput: {
    localizationKey: "Properties.TRANSFORMER_OUTPUT",
    fallback: "Electricity output",
    values: VOLTAGE_WORDS,
  },
  // WaterConnectionBinder's Properties.WATER_PIPE_TYPE words, for the pipes a road
  // carries built in. Its own label: a road's features already read "Carries".
  pipeType: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PipeType]",
    fallback: "Water pipes",
    values: {
      Fresh: { localizationKey: "Properties.WATER_PIPE_TYPE[Fresh]", fallback: "Fresh water" },
      Sewage: { localizationKey: "Properties.WATER_PIPE_TYPE[Sewage]", fallback: "Sewage" },
      Combined: { localizationKey: "Properties.WATER_PIPE_TYPE[Combined]", fallback: "Water and sewage" },
    },
  },
  // PollutionBinder's levels. It sends a level of none too, and a line saying so
  // is noise beside the ones that are not.
  groundPollutionLevel: {
    localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS_GROUND",
    fallback: "Ground pollution",
    values: POLLUTION_WORDS,
    omit: ["None"],
  },
  airPollutionLevel: {
    localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS_AIR",
    fallback: "Air pollution",
    values: POLLUTION_WORDS,
    omit: ["None"],
  },
  noisePollutionLevel: {
    localizationKey: "SelectedInfoPanel.POLLUTION_LEVELS_NOISE",
    fallback: "Noise pollution",
    values: POLLUTION_WORDS,
    omit: ["None"],
  },
  // RequiredResourceBinder's wording — Properties.MAP_RESOURCE[GroundWater] /
  // [SurfaceWater] — and its silence: a water tower allows no type at all.
  waterSource: {
    localizationKey: "Properties.REQUIRED_RESOURCE",
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
  "processingRate", "garbageProcessing", "sortingRate", "purification", "cargoCapacity", "jailCapacity",
  "garbageStorage",
  // vehicle counts
  "collectionTrucks", "postVans", "postTrucks", "ambulances", "hearses", "prisonVans",
  "depotVehicles", "maintenanceVehicles", "helicopters", "shelterVehicles",
  // electricity and water
  "batteryOutput", "electricityCapacity", "voltage", "powerOutput",
  "transformerCapacity", "transformerInput", "transformerOutput", "pipeType",
  // stops
  "airplaneStops", "helicopterStops", "shipStops", "subwayStops", "tramStops", "trainStops", "busStops",
  // pollution
  "groundPollutionLevel", "airPollutionLevel", "noisePollutionLevel",
  // quality and modifiers
  "comfort", "attractiveness", "groundPollutionModifier", "airPollutionModifier", "noisePollutionModifier", "resourceConsumption",
  // mail
  "mailboxCapacity",
  // worded
  "waterSource", "requiredResource",
]);

/**
 * A resource the building burns, from the ServiceUpkeepData buffer: one key
 * per resource, "upkeep:Coal", labelled with the game's own Resources.TITLE.
 * Part of vanilla's upkeep, so part of its tier: vanilla prices these into the
 * top of its upkeep range, and the card names them instead.
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
  "powerOutput", "electricityCapacity", "voltage", "garbageStorage", "batteryOutput",
  "transformerCapacity", "transformerInput", "transformerOutput",
  "pipeType", "stormCapacity", "cargoCapacity", "mailboxCapacity",
  "purification", "waterSource", "maintenancePool",
  "airplaneStops", "helicopterStops", "shipStops", "subwayStops", "tramStops", "trainStops", "busStops",
  "comfort",
  "transportType", "trackType",
  // 2. How well.
  "graduation", "studentWellbeing", "studentHealth",
  "prisonerWellbeing", "prisonerHealth", "attractiveness",
  "groundPollutionLevel", "airPollutionLevel", "noisePollutionLevel",
  "groundPollutionModifier", "airPollutionModifier", "noisePollutionModifier", "resourceConsumption",
  // 3. Who runs it.
  "jobComplexity", "minCrew", "workConditions", "eveningShift", "nightShift",
  // 4. Placement, network and zone.
  "elevatedWidth", "roadFeature",
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
