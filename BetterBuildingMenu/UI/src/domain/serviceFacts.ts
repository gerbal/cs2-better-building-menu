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
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ProcessingRate]",
    fallback: "Processing",
    unit: "t/mo",
  },
  collectionTrucks: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.CollectionTrucks]",
    fallback: "Collection trucks",
    unit: "",
  },
  sortingRate: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.SortingRate]",
    fallback: "Sorting",
    unit: "t/mo",
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
  zoneHouseholds: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]",
    fallback: "Homes",
    unit: "",
  },
  zoneMaxHeight: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneHeight]",
    fallback: "Height",
    unit: "m",
  },
  zoneUpkeep: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Upkeep]",
    fallback: "Upkeep",
    unit: "",
  },
  zoneElectricity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Electricity]",
    fallback: "Electricity",
    unit: "",
  },
  zoneWater: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Water]",
    fallback: "Water",
    unit: "",
  },
  zoneGarbage: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Garbage]",
    fallback: "Garbage",
    unit: "",
  },
  zoneGroundPollution: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.GroundPollution]",
    fallback: "Ground pollution",
    unit: "",
  },
  zoneAirPollution: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.AirPollution]",
    fallback: "Air pollution",
    unit: "",
  },
  zoneNoisePollution: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.NoisePollution]",
    fallback: "Noise pollution",
    unit: "",
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
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.BatteryOutput]",
    fallback: "Output",
    unit: "MW",
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
  comfort: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.Comfort]",
    fallback: "Comfort",
    unit: "",
    multiplier: true,
  },
  electricityCapacity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElectricityCapacity]",
    fallback: "Grid capacity",
    // No unit: the raw figure is an internal throughput number, not megawatts,
    // and labelling it MW made a road claim 400,000 MW.
    unit: "",
  },
  stormCapacity: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.StormCapacity]",
    fallback: "Stormwater",
    unit: "m³",
  },
  elevatedWidth: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElevatedWidth]",
    fallback: "Elevated width",
    unit: "m",
  },
  elevationCost: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ElevationCost]",
    fallback: "Elevation",
    unit: "¢/km",
  },
  zoneTelecom: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneTelecom]",
    fallback: "Telecom",
    unit: "",
  },
  zoneSpace: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ZoneSpace]",
    fallback: "Space",
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
): RenderedServiceFact[] {
  if (!facts || facts.length === 0) {
    return [];
  }

  const rendered: RenderedServiceFact[] = [];

  for (const fact of facts) {
    const presentation = PRESENTATION[fact?.key ?? ""];

    if (!presentation) continue;
    if (typeof fact.value !== "number" || !Number.isFinite(fact.value)) continue;

    const label = translate(presentation.localizationKey, null) ?? presentation.fallback;

    let value: string;

    if (presentation.multiplier) {
      // One decimal: a graduation modifier of 1.15 is a different building
      // from one of 1.5, and rounding to whole numbers makes both read "×1".
      value = `×${(Math.round(fact.value * 100) / 100).toFixed(2).replace(/0$/, "")}`;
    } else {
      const number = formatNumber(Math.round(fact.value));
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
}

const TEXT_PRESENTATION: Readonly<Record<string, ServiceTextPresentation>> = {
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
  waterSource: {
    localizationKey: "Tooltip.LABEL[BetterBuildingMenu.WaterSource]",
    fallback: "Draws from",
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
