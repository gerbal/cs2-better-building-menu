/**
 * Service figures beyond a building's headline capacity.
 *
 * The backend sends `{ key, value }` and never a label: a hospital's
 * helicopters, a garbage plant's processing rate and a post office's sorting
 * rate are each meaningful to one service and absent from the other twenty, so
 * they travel as a keyed list rather than twenty always-null fields on every
 * entry in the catalog. See BetterBuildingMenu.Domain.ServiceFact.
 *
 * This module owns the wording and the units, which is where wording belongs —
 * the indexer decides what is true, the UI decides how to say it.
 */
/**
 * The number formatter is INJECTED rather than imported.
 *
 * Every other module in this folder cross-imports types only, which is what
 * lets each be loaded on its own under Node's type stripping — a value import
 * here would be the first, and would make this module require a runtime
 * resolution its siblings do not. The caller already holds the separators.
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
   * Follows the player's unit system instead of carrying a fixed `unit`.
   *
   * Each name is one of vanilla's own rules — Length is metres/yards, Height
   * is metres/feet, Volume is cubic metres/gallons, and a per-distance cost
   * converts its figure as well as its suffix.
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
    // month in vanilla's table. Garbage has its own key below; the two used to
    // share this one and its "t/mo", so a crematorium's bodies read as tonnes.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ProcessingRate]",
    fallback: "Processing",
    unit: "/mo.",
    measure: "perMonth",
  },
  garbageProcessing: {
    // GarbageFacilityData.m_ProcessingSpeed — kilograms a month, shown as the
    // game's WeightPerMonth. Printed raw under "t/mo" it read 100,000 t/mo
    // where the game says 100 t/mo.
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
    // PostFacilityData.m_SortingRate — mail items a month, an integer per month
    // in vanilla's table; it carried "t/mo" here.
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
  // The one consumption coefficient the game reads: PropertyRenterSystem.
  // GetUpkeep is level^exp × this × lotSize, so at level 1 it is money per
  // cell per month. The electricity, water, garbage and telecom coefficients
  // beside it on ZoneServiceConsumptionData have no reader anywhere in the
  // game, and neither does ZonePollutionData; a figure the simulation never
  // uses is not a fact about the zone, so those keys have no presentation.
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
  // Properties.COMFORT: the game shows round(100 × m_ComfortFactor) as a
  // whole number (PrefabUISystem.cs:1643–1645); the index scales it the same
  // way. A "×1.2" here was the factor the game never shows.
  comfort: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Comfort]",
    fallback: "Comfort",
    unit: "",
  },
  electricityCapacity: {
    // ElectricityConnectionData.m_Capacity. Vanilla binds TRANSFORMER_CAPACITY
    // and POWER_LINE_CAPACITY with the power unit — hundreds of watts — which
    // is why the raw figure looked like an internal throughput number and a
    // road's 400,000 was really 40 MW.
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
    // The same words as vanilla's Properties.CARGO_CAPACITY, under our own
    // key because every entry in this table ships its own string (see the
    // locale test). PrefabUISystem binds StorageLimitData.m_Limit with the
    // weight unit, on cargo stations and on the warehouse upgrades that add to
    // them (StorageLimitData.Combine is additive). Kilograms; follows the
    // unit system.
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.CargoCapacity]",
    fallback: "Cargo capacity",
    unit: "t",
    measure: "weight",
  },
  // Audited against PrefabUISystem's property binders (2026-09-07): the
  // figures vanilla's tooltip carries that ours did not. Most are what an
  // upgrade IS — an ambulance depot, a hearse garage, jail cells, a filter,
  // a modifier on the parent's upkeep — which is why the picker surfaced them.
  ambulances: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Ambulances]", fallback: "Ambulances", unit: "" },
  hearses: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Hearses]", fallback: "Hearses", unit: "" },
  prisonVans: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PrisonVans]", fallback: "Prison vans", unit: "" },
  postTrucks: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.PostTrucks]", fallback: "Post trucks", unit: "" },
  // TransportDepotData.m_VehicleCapacity — the game says "Vehicles" too.
  depotVehicles: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.DepotVehicles]", fallback: "Vehicles", unit: "" },
  maintenanceVehicles: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.MaintenanceVehicles]", fallback: "Maintenance vehicles", unit: "" },
  jailCapacity: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.JailCapacity]", fallback: "Jail capacity", unit: "" },
  // PollutionModifierData multipliers, already ×100 by the indexer: vanilla
  // shows them as a percentage under the pollution level's own name, and it
  // authors the component only on service upgrades.
  groundPollutionModifier: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.GroundPollutionModifier]", fallback: "Ground pollution", unit: "%" },
  airPollutionModifier: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.AirPollutionModifier]", fallback: "Air pollution", unit: "%" },
  noisePollutionModifier: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.NoisePollutionModifier]", fallback: "Noise pollution", unit: "%" },
  // UpkeepModifierData: the largest multiplier minus one, in percent, signed —
  // the one signed property in vanilla's table, and authored only on
  // BuildingExtensionPrefab.
  upkeepChange: { localizationKey: "Tooltip.LABEL[BetterBuildingMenu.UpkeepChange]", fallback: "Upkeep", unit: "%", signed: true },
  elevatedWidth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElevatedWidth]",
    fallback: "Elevated width",
    unit: "m",
    // A LENGTH, so it follows the player's unit system rather than carrying a
    // hard "m" — it read "14 m" beside a "52 ft" width until this said so.
    measure: "length",
  },
  elevationCost: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElevationCost]",
    fallback: "Elevation",
    unit: "¢/km",
    // Money, so it goes through the game's own per-distance template rather
    // than bolting "¢/km" onto a number — it rendered "5,000 ¢/km" where every
    // other cost on the card reads "¢5,000 /km", symbol first.
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
 * The facts this build can draw, in the order the indexer recorded them.
 *
 * A key with no entry here is DROPPED rather than shown raw. The backend can
 * add a figure before the UI has wording for it — the two ship together but a
 * player may run a mismatched pair — and "sortingRate 240" on a card is worse
 * than the line not being there.
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
   * Words for the VALUE, where it is one of ours rather than the game's.
   *
   * A traded resource arrives already named by the game; a lot shape arrives as
   * "narrow" or "corners", which are our tokens and need our words.
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
      // Our own keys, not the ZoneNarrowLots / ZoneCorners the registry
      // already owns: those are sentence fragments — "narrow lots",
      // "corners" — written for the old joined-with-dots zone line, and
      // reusing them here would either read wrong in a label/value pair or
      // force a casing change on a string other code still renders.
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

/** Every localization key a worded fact can ask for, for the audit. */
export const SERVICE_TEXT_FACT_LOCALIZATION_KEYS: readonly string[] = [
  ...Object.values(TEXT_PRESENTATION).map((entry) => entry.localizationKey),
  ...Object.values(TEXT_PRESENTATION)
    .flatMap((entry) => Object.values(entry.values ?? {}))
    .map((entry) => entry.localizationKey),
];

/**
 * The worded facts, one line per key.
 *
 * Grouped by key, because a zone reports its lot shapes as one fact per shape —
 * a zone that supports both would otherwise draw "Lot shapes Narrow" directly
 * above "Lot shapes Corners", which is one fact printed twice.
 *
 * A key with no wording is dropped, for the same reason the numeric ones are:
 * the halves can ship mismatched, and a raw token on a card is worse than a
 * missing line.
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
 * The order every service figure appears in, whatever order it was indexed in.
 *
 * Facts arrive in the order the C# emitted them, which depends on which
 * component blocks a given prefab happened to hit — so a fire station and a
 * hospital, both carrying helicopters and a shift share, showed them in
 * different positions. A card whose fields move is a card the reader has to
 * re-read every time instead of learning where to look, and comparing two
 * buildings means comparing two different layouts.
 *
 * Grouped by what the reader is asking, in that order:
 *   1. what the building DOES — the output it exists to produce
 *   2. how WELL it does it — the quality and effect figures
 *   3. who RUNS it — staffing
 *   4. what it costs to place and what the network/zone adds
 *
 * Worded and numeric figures share one order: which list a value happens to
 * live in is a fact about its type, not about where a reader expects it.
 *
 * A key missing from this list is not dropped — it sorts to the end, in the
 * order it arrived, so a newly indexed figure appears and can then be placed
 * here deliberately.
 */
/**
 * The facts the game's own tooltip shows — exactly PrefabUISystem's property
 * binders, audited 2026-09-07. The card draws these first and bright, and
 * everything else below a divider, dimmer: a player already knows how to read
 * the game's figures, and ours should not blend into them.
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
  "comfort", "attractiveness", "groundPollutionModifier", "airPollutionModifier", "noisePollutionModifier", "upkeepChange",
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
  "groundPollutionModifier", "airPollutionModifier", "noisePollutionModifier", "upkeepChange",
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
 * Sort rendered figures into FACT_ORDER, keeping unplaced keys last.
 *
 * Stable: two keys the order does not name keep the order they arrived in, so
 * the result is still deterministic for a prefab the list has not caught up
 * with.
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
