import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_FACT_KEYS,
  SERVICE_TEXT_FACT_KEYS,
  isVanillaFact,
  orderFacts,
  renderServiceFacts,
  renderServiceTextFacts,
} from "../src/domain/serviceFacts.ts";

const asKey = (key: string) => `<${key}>`;
const untranslated = () => null;
const tagged = (value: number) => `#${value}`;
const MEASURES = ["length", "height", "volume", "moneyPerCellPerMonth", "weight", "weightPerMonth", "perMonth", "power"];
const measured = Object.fromEntries(MEASURES.map((name) => [name, (value: number) => `${name}(${value})`]));
// Every token a worded fact has words for, one it omits, and one that passes through.
const TOKENS = [
  "Ore", "Fish", "Oil", "Forest", "FertileLand", "GroundWater", "SurfaceWater",
  "Manual", "Simple", "Complex", "Hitech", "narrow", "corners",
  "Low", "Medium", "High", "Both", "Fresh", "Sewage", "Combined",
  "trafficLights", "highwayRules", "zonesAlongside", "underground",
  "longTermStorage", "industrialWasteOnly", "signalThroughTerrain", "ignoresLandValue",
  "None", "Food",
];

/**
 * One fact as the card draws it: tier, label key/English, then a number through
 * each formatting path, or each token's word key/English.
 */
function lineOf(key: string): string {
  const tier = isVanillaFact(key) ? "game" : "ours";
  const [numeric] = renderServiceFacts([{ key, value: 1 }], asKey);
  if (numeric) {
    const [english] = renderServiceFacts([{ key, value: 1 }], untranslated);
    const plain = renderServiceFacts([1234.567, -3.456, 1.5].map((value) => ({ key, value })), untranslated, tagged);
    const [measuredValue] = renderServiceFacts([{ key, value: 1234.567 }], untranslated, tagged, measured);
    return `${key} ${tier} ${numeric.label}/${english.label}: ${plain.map((line) => line.value).join("; ")} | ${measuredValue.value}`;
  }
  const [worded] = renderServiceTextFacts([{ key, value: "Food" }], asKey);
  if (worded) {
    const [english] = renderServiceTextFacts([{ key, value: "Food" }], untranslated);
    const words = TOKENS.flatMap((token) => {
      const [byKey] = renderServiceTextFacts([{ key, value: token }], asKey);
      const [byWord] = renderServiceTextFacts([{ key, value: token }], untranslated);
      if (!byKey) return [`${token}=none`];
      return byKey.value === token ? [] : [`${token}=${byKey.value}/${byWord.value}`];
    });
    const head = `${key} ${tier} ${worded.label}/${english.label}`;
    return words.length === 0 ? head : `${head}: ${words.join(", ")}`;
  }
  return `${key} ${tier} undrawn`;
}

const lines = () =>
  orderFacts([...SERVICE_FACT_KEYS, ...SERVICE_TEXT_FACT_KEYS, "upkeep:Coal", "somethingNew"].reverse().map((key) => ({ key })))
    .map((fact) => lineOf(fact.key));

// In display order: the facts the game's tooltip shows sit among ours, and an
// unplaced key falls to the end.
const PINNED = [
  "requiredResource game <Properties.REQUIRED_RESOURCE>/Requires: Ore=<Properties.MAP_RESOURCE[Ore]>/Ore, Fish=<Properties.MAP_RESOURCE[Fish]>/Fish, Oil=<Properties.MAP_RESOURCE[Oil]>/Oil, Forest=<Properties.MAP_RESOURCE[Forest]>/Forest, FertileLand=<Properties.MAP_RESOURCE[FertileLand]>/Fertile land",
  "processingRate game <Properties.DECEASED_PROCESSING_CAPACITY>/Processing: #1235 /mo.; #-3 /mo.; #2 /mo. | perMonth(1234.567)",
  "garbageProcessing game <Properties.GARBAGE_PROCESSING_CAPACITY>/Processing: #1235 t/mo.; #-3 t/mo.; #2 t/mo. | weightPerMonth(1234.567)",
  "sortingRate game <Properties.MAIL_SORTING_RATE>/Sorting: #1235 /mo.; #-3 /mo.; #2 /mo. | perMonth(1234.567)",
  "jailCapacity game <Properties.JAIL_CAPACITY>/Jail capacity: #1235; #-3; #2 | #1235",
  "collectionTrucks game <Properties.GARBAGE_TRUCK_COUNT>/Collection trucks: #1235; #-3; #2 | #1235",
  "postVans game <Properties.POST_VAN_COUNT>/Post vans: #1235; #-3; #2 | #1235",
  "postTrucks game <Properties.POST_TRUCK_COUNT>/Post trucks: #1235; #-3; #2 | #1235",
  "ambulances game <Properties.AMBULANCE_COUNT>/Ambulances: #1235; #-3; #2 | #1235",
  "hearses game <Properties.HEARSE_COUNT>/Hearses: #1235; #-3; #2 | #1235",
  "prisonVans game <Properties.PRISON_VAN_COUNT>/Prison vans: #1235; #-3; #2 | #1235",
  "depotVehicles game <Properties.TRANSPORT_VEHICLE_COUNT>/Vehicles: #1235; #-3; #2 | #1235",
  "maintenanceVehicles game <Properties.MAINTENANCE_VEHICLES>/Maintenance vehicles: #1235; #-3; #2 | #1235",
  "helicopters game <Tooltip.LABEL[BetterBuildingMenu.Helicopters]>/Helicopters: #1235; #-3; #2 | #1235",
  "disasterResponse ours <Tooltip.LABEL[BetterBuildingMenu.DisasterResponse]>/Disaster response: #1235; #-3; #2 | #1235",
  "shelterVehicles game <Properties.EVACUATION_BUS_COUNT>/Evacuation buses: #1235; #-3; #2 | #1235",
  "powerOutput game <Properties.POWER_PLANT_OUTPUT>/Power output: #1235 MW; #-3 MW; #2 MW | power(1234.567)",
  "electricityCapacity game <Properties.POWER_LINE_CAPACITY>/Grid capacity: #1235 MW; #-3 MW; #2 MW | power(1234.567)",
  "voltage game <Tooltip.LABEL[BetterBuildingMenu.Voltage]>/Voltage: Low=<Properties.VOLTAGE:0>/Low, High=<Properties.VOLTAGE:1>/High, Both=<Properties.VOLTAGE:2>/Low and high",
  "garbageStorage game <Properties.GARBAGE_STORAGE>/Garbage storage: #1235 t; #-3 t; #2 t | weight(1234.567)",
  "batteryOutput game <Properties.BATTERY_POWER_OUTPUT>/Output: #1235 MW; #-3 MW; #2 MW | power(1234.567)",
  "transformerCapacity game <Properties.TRANSFORMER_CAPACITY>/Transformer capacity: #1235 MW; #-3 MW; #2 MW | power(1234.567)",
  "transformerInput game <Properties.TRANSFORMER_INPUT>/Electricity input: Low=<Properties.VOLTAGE:0>/Low, High=<Properties.VOLTAGE:1>/High, Both=<Properties.VOLTAGE:2>/Low and high",
  "transformerOutput game <Properties.TRANSFORMER_OUTPUT>/Electricity output: Low=<Properties.VOLTAGE:0>/Low, High=<Properties.VOLTAGE:1>/High, Both=<Properties.VOLTAGE:2>/Low and high",
  "pipeType game <Tooltip.LABEL[BetterBuildingMenu.PipeType]>/Water pipes: Fresh=<Properties.WATER_PIPE_TYPE[Fresh]>/Fresh water, Sewage=<Properties.WATER_PIPE_TYPE[Sewage]>/Sewage, Combined=<Properties.WATER_PIPE_TYPE[Combined]>/Water and sewage",
  "stormCapacity ours <Tooltip.LABEL[BetterBuildingMenu.StormCapacity]>/Stormwater: #1235 m³; #-3 m³; #2 m³ | volume(1234.567)",
  "cargoCapacity game <Properties.CARGO_CAPACITY>/Cargo capacity: #1235 t; #-3 t; #2 t | weight(1234.567)",
  "mailboxCapacity game <Properties.MAIL_BOX_CAPACITY>/Mailbox capacity: #1235; #-3; #2 | #1235",
  "purification game <Tooltip.LABEL[BetterBuildingMenu.Purification]>/Purification: #1235 %; #-3 %; #2 % | #1235 %",
  "waterSource game <Properties.REQUIRED_RESOURCE>/Draws from: GroundWater=<Properties.MAP_RESOURCE[GroundWater]>/Ground water, SurfaceWater=<Properties.MAP_RESOURCE[SurfaceWater]>/Surface water, None=none",
  "maintenancePool ours <Tooltip.LABEL[BetterBuildingMenu.MaintenancePool]>/Maintenance: #1235; #-3; #2 | #1235",
  "airplaneStops game <Properties.TRANSPORT_STOP_COUNT[Airplane]>/Gates: #1235; #-3; #2 | #1235",
  "helicopterStops game <Properties.TRANSPORT_STOP_COUNT[Helicopter]>/Landing pads: #1235; #-3; #2 | #1235",
  "shipStops game <Properties.TRANSPORT_STOP_COUNT[Ship]>/Piers: #1235; #-3; #2 | #1235",
  "subwayStops game <Properties.TRANSPORT_STOP_COUNT[Subway]>/Subway platforms: #1235; #-3; #2 | #1235",
  "tramStops game <Properties.TRANSPORT_STOP_COUNT[Tram]>/Tram platforms: #1235; #-3; #2 | #1235",
  "trainStops game <Properties.TRANSPORT_STOP_COUNT[Train]>/Train platforms: #1235; #-3; #2 | #1235",
  "busStops game <Properties.TRANSPORT_STOP_COUNT[Bus]>/Bus platforms: #1235; #-3; #2 | #1235",
  "comfort game <Properties.COMFORT>/Comfort: #1235; #-3; #2 | #1235",
  "transportType ours <Tooltip.LABEL[BetterBuildingMenu.TransportType]>/Transport",
  "trackType ours <Tooltip.LABEL[BetterBuildingMenu.TrackType]>/Track",
  "graduation ours <Tooltip.LABEL[BetterBuildingMenu.Graduation]>/Graduation: +#1235 %; -#3 %; +#2 % | +#1235 %",
  "studentWellbeing ours <Tooltip.LABEL[BetterBuildingMenu.StudentWellbeing]>/Student wellbeing: +#1235; -#3; +#2 | +#1235",
  "studentHealth ours <Tooltip.LABEL[BetterBuildingMenu.StudentHealth]>/Student health: +#1235; -#3; +#2 | +#1235",
  "prisonerWellbeing ours <Tooltip.LABEL[BetterBuildingMenu.PrisonerWellbeing]>/Inmate wellbeing: +#1235; -#3; +#2 | +#1235",
  "prisonerHealth ours <Tooltip.LABEL[BetterBuildingMenu.PrisonerHealth]>/Inmate health: +#1235; -#3; +#2 | +#1235",
  "attractiveness game <Properties.ATTRACTIVENESS>/Attractiveness: #1235; #-3; #2 | #1235",
  "groundPollutionLevel game <SelectedInfoPanel.POLLUTION_LEVELS_GROUND>/Ground pollution: Low=<SelectedInfoPanel.POLLUTION_LEVELS:1>/Low, Medium=<SelectedInfoPanel.POLLUTION_LEVELS:2>/Medium, High=<SelectedInfoPanel.POLLUTION_LEVELS:3>/High, None=none",
  "airPollutionLevel game <SelectedInfoPanel.POLLUTION_LEVELS_AIR>/Air pollution: Low=<SelectedInfoPanel.POLLUTION_LEVELS:1>/Low, Medium=<SelectedInfoPanel.POLLUTION_LEVELS:2>/Medium, High=<SelectedInfoPanel.POLLUTION_LEVELS:3>/High, None=none",
  "noisePollutionLevel game <SelectedInfoPanel.POLLUTION_LEVELS_NOISE>/Noise pollution: Low=<SelectedInfoPanel.POLLUTION_LEVELS:1>/Low, Medium=<SelectedInfoPanel.POLLUTION_LEVELS:2>/Medium, High=<SelectedInfoPanel.POLLUTION_LEVELS:3>/High, None=none",
  "groundPollutionModifier game <SelectedInfoPanel.POLLUTION_LEVELS_GROUND>/Ground pollution: +#1235 %; -#3 %; +#2 % | +#1235 %",
  "airPollutionModifier game <SelectedInfoPanel.POLLUTION_LEVELS_AIR>/Air pollution: +#1235 %; -#3 %; +#2 % | +#1235 %",
  "noisePollutionModifier game <SelectedInfoPanel.POLLUTION_LEVELS_NOISE>/Noise pollution: +#1235 %; -#3 %; +#2 % | +#1235 %",
  "resourceConsumption game <Properties.RESOURCE_CONSUMPTION>/Resource consumption: +#1235 %; -#3 %; +#2 % | +#1235 %",
  "jobComplexity ours <Tooltip.LABEL[BetterBuildingMenu.JobComplexity]>/Jobs: Manual=<Tooltip.LABEL[BetterBuildingMenu.JobsManual]>/Manual, Simple=<Tooltip.LABEL[BetterBuildingMenu.JobsSimple]>/Simple, Complex=<Tooltip.LABEL[BetterBuildingMenu.JobsComplex]>/Complex, Hitech=<Tooltip.LABEL[BetterBuildingMenu.JobsHitech]>/Hi-tech",
  "minCrew ours <Tooltip.LABEL[BetterBuildingMenu.MinCrew]>/Min crew: #1235; #-3; #2 | #1235",
  "workConditions ours <Tooltip.LABEL[BetterBuildingMenu.WorkConditions]>/Conditions: +#1235; -#3; +#2 | +#1235",
  "eveningShift ours <Tooltip.LABEL[BetterBuildingMenu.EveningShift]>/Evening shift: #1235 %; #-3 %; #2 % | #1235 %",
  "nightShift ours <Tooltip.LABEL[BetterBuildingMenu.NightShift]>/Night shift: #1235 %; #-3 %; #2 % | #1235 %",
  "elevatedWidth ours <Tooltip.LABEL[BetterBuildingMenu.ElevatedWidth]>/Elevated width: #1235 m; #-3 m; #2 m | length(1234.567)",
  "roadFeature ours <Tooltip.LABEL[BetterBuildingMenu.RoadFeature]>/Carries: trafficLights=<Tooltip.LABEL[BetterBuildingMenu.RoadFeatureTrafficLights]>/traffic lights, highwayRules=<Tooltip.LABEL[BetterBuildingMenu.RoadFeatureHighwayRules]>/highway rules, zonesAlongside=<Tooltip.LABEL[BetterBuildingMenu.RoadFeatureZonesAlongside]>/zoning, underground=<Tooltip.LABEL[BetterBuildingMenu.RoadFeatureUnderground]>/an underground form",
  "zoneMaxHeight ours <Tooltip.LABEL[BetterBuildingMenu.ZoneHeight]>/Height: #1235 m; #-3 m; #2 m | height(1234.567)",
  "zoneHouseholds ours <Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]>/Homes: #1235; #-3; #2 | #1235",
  "zoneHouseholdsPerCell ours <Tooltip.LABEL[BetterBuildingMenu.ZoneHouseholds]>/Homes: #1234.6 /cell; #-3.5 /cell; #1.5 /cell | #1234.6 /cell",
  "zoneSpace ours <Tooltip.LABEL[BetterBuildingMenu.ZoneSpace]>/Floor space: ×1234.57; ×-3.46; ×1.5 | ×1234.57",
  "zoneUpkeep ours <Tooltip.LABEL[BetterBuildingMenu.Upkeep]>/Upkeep: #1235; #-3; #2 | moneyPerCellPerMonth(1234.567)",
  "zoneFireHazard ours <Tooltip.LABEL[BetterBuildingMenu.ZoneFireHazard]>/Fire hazard: ×1234.57; ×-3.46; ×1.5 | ×1234.57",
  "zoneLotShapes ours <Tooltip.LABEL[BetterBuildingMenu.ZoneLotShapes]>/Lot shapes: narrow=<Tooltip.LABEL[BetterBuildingMenu.ZoneShapeNarrow]>/Narrow, corners=<Tooltip.LABEL[BetterBuildingMenu.ZoneShapeCorners]>/Corners",
  "zoneSold ours <Tooltip.LABEL[BetterBuildingMenu.ZoneSold]>/Sells",
  "zoneManufactured ours <Tooltip.LABEL[BetterBuildingMenu.ZoneManufactured]>/Makes",
  "zoneStored ours <Tooltip.LABEL[BetterBuildingMenu.ZoneStored]>/Stores",
  "facilityFeature ours <Tooltip.LABEL[BetterBuildingMenu.FacilityFeature]>/Also: longTermStorage=<Tooltip.LABEL[BetterBuildingMenu.FacilityFeatureLongTermStorage]>/stores long term, industrialWasteOnly=<Tooltip.LABEL[BetterBuildingMenu.FacilityFeatureIndustrialWaste]>/industrial waste only, signalThroughTerrain=<Tooltip.LABEL[BetterBuildingMenu.FacilityFeatureThroughTerrain]>/reaches through terrain",
  "zoneFeature ours <Tooltip.LABEL[BetterBuildingMenu.ZoneFeature]>/Also: ignoresLandValue=<Tooltip.LABEL[BetterBuildingMenu.ZoneFeatureIgnoresLandValue]>/ignores land value",
  "xpReward ours <Tooltip.LABEL[BetterBuildingMenu.XpReward]>/XP: #1235; #-3; #2 | #1235",
  "somethingNew ours undrawn",
  "upkeep:Coal game <Resources.TITLE[Coal]>/Coal: #1235 t/mo.; #-3 t/mo.; #2 t/mo. | weightPerMonth(1234.567)",
];

describe("every service fact, as the card draws it", () => {
  it("keeps each fact's tier, label, value and place", () => {
    assert.deepEqual(lines(), PINNED);
  });
});

