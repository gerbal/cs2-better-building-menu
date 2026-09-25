/**
 * What a building's hover card says: its lines, in order, and which of them
 * are the game's own. The card component only draws the result.
 */

import type { BuildingCatalogEntry } from "./buildingCatalog";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  groupDigits,
  hasFootprint,
  type NumberSeparators,
  formatServiceRange,
  formatSpeedLimit,
  formatHeight,
  formatNetworkWidth,
  formatVolume,
  formatWeight,
  formatWeightPerMonth,
  formatPerMonth,
  formatPower,
} from "./buildingLensMetricFormat";
import { buildTileTooltipLines, isMetricPresent, TILE_TOOLTIP_MAX_LINES, type TileTooltipLine } from "./buildingTileTooltip";
import { RESOURCE_UPKEEP_PREFIX, isVanillaFact, orderFacts, renderServiceFacts, renderServiceTextFacts } from "./serviceFacts";
import { getBuildingExtensionLabels } from "./buildingLensRowDetails";
import { isEntryAlreadyBuilt, isEntryLocked, listLockConditions } from "./buildingLockState";

type Translate = (key: string, fallback: string | null) => string | null;

export interface HoverCardLabels {
  cost: string;
  upkeep: string;
  capacity: string;
  range: string;
  speed: string;
  width: string;
  lot: string;
  locked: string;
  alreadyBuilt: string;
  lockedValue: string;
  bonuses: string;
  parking: string;
  parkingBays: string;
  households: string;
  householdsUnit: string;
  workers: string;
  workersUnit: string;
  upgrades: string;
}

/** What the lines need from the city and the language, resolved once per list. */
export interface HoverCardLineContext {
  milestoneNames: string[];
  separators: NumberSeparators;
  /** The game's word for a LeisureType, resolved where translate lives. */
  leisureName: (leisureType: string | null | undefined) => string;
  /** Bound translate, for the service-fact table's own keys. */
  translateFact: Translate;
  labels: HoverCardLabels;
}

/** The card's two blocks. */
export interface HoverCardTiers {
  /** The game's own figures, every one of them. */
  vanilla: TileTooltipLine[];
  /** Ours, capped at TILE_TOOLTIP_MAX_LINES. */
  extra: TileTooltipLine[];
}

// The fixed lines the game's own tooltip also carries: its states, cost and
// upkeep, the headline capacity, and its effects. Range, lot, parking,
// households, workers and the upgrade list are ours.
const VANILLA_LINE_KEYS: ReadonlySet<string> = new Set(["locked", "alreadyBuilt", "cost", "upkeep", "capacity", "leisure", "bonuses"]);

// What the top tier holds beyond vanilla's figures, by kind of tile. "The game
// shows it" stands in for "it matters" on a service building and nowhere else:
// a road is picked by its speed and width, a zone by what it is made of.
const PROMOTED_BY_CATEGORY: Readonly<Record<string, ReadonlySet<string>>> = {
  Networks: new Set(["speedLimit", "networkWidth"]),
  Zones: new Set(["zoneMaxHeight", "zoneHouseholds", "zoneHouseholdsPerCell", "zoneSpace"]),
};

export function hoverCardLabels(translate: Translate): HoverCardLabels {
  return {
    cost: translate("Tooltip.LABEL[BetterBuildingMenu.Cost]", "Cost") ?? "Cost",
    upkeep: translate("Tooltip.LABEL[BetterBuildingMenu.Upkeep]", "Upkeep") ?? "Upkeep",
    capacity: translate("Tooltip.LABEL[BetterBuildingMenu.Capacity]", "Capacity") ?? "Capacity",
    range: translate("Tooltip.LABEL[BetterBuildingMenu.Range]", "Range") ?? "Range",
    speed: translate("Tooltip.LABEL[BetterBuildingMenu.SpeedLimit]", "Speed limit") ?? "Speed limit",
    width: translate("Tooltip.LABEL[BetterBuildingMenu.NetworkWidth]", "Width") ?? "Width",
    lot: translate("Tooltip.LABEL[BetterBuildingMenu.Lot]", "Lot") ?? "Lot",
    // "Requires", not "Availability": the line lists what the player has to
    // go and do, so it is named after that rather than after the state.
    locked: translate("Tooltip.LABEL[BetterBuildingMenu.Requires]", "Requires") ?? "Requires",
    // The GAME's own string by its own key, so this reads as vanilla's
    // already-built row does in whatever language is set. Ours is the
    // fallback for a missing key, not the first choice.
    alreadyBuilt:
      translate("Toolbar.ASSET_ALREADY_BUILT", "")
      || translate("Tooltip.LABEL[BetterBuildingMenu.AlreadyBuilt]", "Already built")
      || "Already built",
    lockedValue: translate("Tooltip.LABEL[BetterBuildingMenu.Locked]", "Locked") ?? "Locked",
    bonuses: translate("Tooltip.LABEL[BetterBuildingMenu.Provides]", "Provides") ?? "Provides",
    parking: translate("Tooltip.LABEL[BetterBuildingMenu.Parking]", "Parking") ?? "Parking",
    households: translate("Tooltip.LABEL[BetterBuildingMenu.Households]", "Households") ?? "Households",
    householdsUnit: translate("Tooltip.LABEL[BetterBuildingMenu.HouseholdsUnit]", "households") ?? "households",
    workers: translate("Tooltip.LABEL[BetterBuildingMenu.Workers]", "Workers") ?? "Workers",
    workersUnit: translate("Tooltip.LABEL[BetterBuildingMenu.WorkersUnit]", "jobs") ?? "jobs",
    upgrades: translate("Tooltip.LABEL[BetterBuildingMenu.Upgrades]", "Upgrades") ?? "Upgrades",
    // "bays" rather than a bare number: the count is approximate for marked
    // lanes, and naming the unit keeps it from reading as an exact capacity.
    parkingBays: translate("Tooltip.LABEL[BetterBuildingMenu.ParkingBays]", "bays") ?? "bays",
  };
}

/** Every line the building earns, in card order, uncapped. */
function hoverCardLines(entry: BuildingCatalogEntry, context: HoverCardLineContext): TileTooltipLine[] {
  const { milestoneNames, separators, labels, leisureName, translateFact } = context;

  const cost = formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance);
  const upkeep = formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance);
  // The kind LABELS the figure, as on every other line. It is the game's own
  // Properties.LEISURE_TYPE word, so it can simply BE the label; stripping
  // "Recreation" off it would be surgery on a localized string.
  const leisureKind = leisureName(entry.leisureType);
  const leisureAmount = entry.leisureEfficiency;
  const leisure = leisureKind === "" || !isMetricPresent(leisureAmount)
    ? ""
    : formatBuildingMetric(leisureAmount, "capacity", separators);
  const range = formatServiceRange(entry.serviceRange, separators);
  const speed = formatSpeedLimit(entry.speedLimit, separators);
  const width = formatNetworkWidth(entry.networkWidth, separators);
  // Whatever this service carries beyond its headline capacity. Spread rather
  // than listed: which figures exist depends on the building, so the card
  // cannot name them in advance.
  const allServiceFacts = renderServiceFacts(
    entry.serviceFacts,
    translateFact,
    (value) => formatBuildingMetric(value, "capacity", separators),
    {
      length: (value) => formatNetworkWidth(value, separators),
      height: (value) => formatHeight(value, separators),
      volume: (value) => formatVolume(value, separators),
      weight: (value) => formatWeight(value, separators),
      weightPerMonth: (value) => formatWeightPerMonth(value, separators),
      perMonth: (value) => formatPerMonth(value, separators),
      power: (value) => formatPower(value, separators),
      moneyPerCellPerMonth: (value) => `${formatBuildingMetric(value, "cost", separators)} /cell/mo.`,
    },
  );
  // What the building burns sits with what it costs, not among the service
  // figures: it is part of vanilla's upkeep, priced into one number there and
  // named here.
  const resourceUpkeep = allServiceFacts.filter((fact) => fact.key.startsWith(RESOURCE_UPKEEP_PREFIX));
  const serviceFacts = allServiceFacts.filter((fact) => !fact.key.startsWith(RESOURCE_UPKEEP_PREFIX));
  const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
  const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);

  // No separate zone block: a zone's figures arrive as service facts and are
  // drawn by the same lines every other specialist figure uses.
  //
  // Uncapped here: the cap is applied per tier, so a long tail of our own
  // figures can never push one of the game's lines off the card.
  return buildTileTooltipLines([
    // First, because it changes what every line under it means: a cost you
    // cannot pay yet is a different fact from a cost you can.
    {
      key: "locked",
      label: labels.locked,
      applicable: isEntryLocked(entry),
      // Every condition, one per line. A signature building can sit behind a
      // milestone, a tech node and a zone target at once.
      value: labels.lockedValue,
      values: listLockConditions(entry, milestoneNames, labels.lockedValue),
      tone: "warn",
    },
    // Beside locked and for the same reason: it changes what the rest of the
    // card means. Vanilla draws it as a band; this card is a label/value list,
    // so it says the same fact as a line rather than bolting a band on.
    {
      key: "alreadyBuilt",
      label: labels.alreadyBuilt,
      applicable: isEntryAlreadyBuilt(entry),
      // The label IS the statement, which is how vanilla's row reads. Marked as
      // such or the empty-value guard drops it — see buildTileTooltipLines.
      value: "",
      statement: true,
      tone: "warn",
    },
    {
      key: "cost",
      label: labels.cost,
      applicable: isMetricPresent(entry.constructionCost),
      // The price, and nothing about the treasury: the balance is on the HUD,
      // and a share of it is a fact about the CITY on a card about a BUILDING.
      value: cost,
    },
    // Straight after the price, as the game's tooltip has it: Upkeep is the
    // first property it binds, and the two money lines read together.
    { key: "upkeep", label: labels.upkeep, applicable: isMetricPresent(entry.upkeep), value: upkeep },
    ...resourceUpkeep.map((fact) => ({ key: fact.key, label: fact.label, applicable: true, value: fact.value })),
    {
      key: "capacity",
      label: labels.capacity,
      // Zero is not a fact. A school's clinic or playground carries a
      // SchoolData with no students; "Capacity 0 students" states as a figure
      // what is really the absence of one.
      applicable: isMetricPresent(entry.capacity) && entry.capacity !== 0,
      // The building's own figure, and nothing about the city: anything that
      // moved with the simulation would not be a fact about this asset.
      value: capacity,
    },
    // What a park actually gives the city: "Parks & Recreation" holds a city
    // park, an indoor arena and a beach, which a cost and a lot size do not
    // tell apart. The game's own word, via Properties.LEISURE_TYPE.
    {
      key: "leisure",
      label: leisureKind,
      // A kind with no amount still says what the building is for, so it shows
      // as a statement rather than being dropped for having no figure.
      applicable: leisureKind !== "",
      statement: leisure === "",
      value: leisure,
    },
    // How far it reaches. For a telecom tower this is most of the point, and
    // the same component covers schools, hospitals and parks, so the line is
    // not a communications special case.
    {
      key: "range",
      label: labels.range,
      applicable: range !== "",
      value: range,
    },
    // The two figures a player picks one road over another by. Both are null
    // on anything that is not a network, so this costs a building nothing.
    {
      key: "speedLimit",
      label: labels.speed,
      applicable: speed !== "",
      value: speed,
    },
    {
      key: "networkWidth",
      label: labels.width,
      applicable: width !== "",
      value: width,
    },
    // Beside capacity, because it is one: how many cars the thing holds. Only
    // when there are bays — a zero is a fact, but not one anyone is asking
    // after on a building with no parking.
    {
      key: "parking",
      label: labels.parking,
      applicable: (entry.parkingSlots ?? 0) > 0,
      value: `${groupDigits(entry.parkingSlots ?? 0, separators)} ${labels.parkingBays}`,
    },
    // What the building HOLDS. Its own field rather than Capacity, which is
    // derived from SERVICE components a residential building does not carry.
    {
      key: "households",
      label: labels.households,
      applicable: isMetricPresent(entry.households),
      value: `${groupDigits(entry.households ?? 0, separators)} ${labels.householdsUnit}`,
    },
    {
      key: "workers",
      label: labels.workers,
      // Zero is not a fact here either: a bus station carries WorkplaceData
      // with no workers, and "0 jobs" states as a figure what is really the
      // absence of one.
      applicable: isMetricPresent(entry.workers) && entry.workers !== 0,
      value: `${groupDigits(entry.workers ?? 0, separators)} ${labels.workersUnit}`,
    },
    // The variable tail. Everything above sits in the same place on every card;
    // what a building carries beyond that is listed in one declared order
    // (FACT_ORDER), worded and numeric merged first so type does not decide it.
    ...orderFacts([
      ...renderServiceTextFacts(entry.serviceTextFacts, translateFact),
      ...serviceFacts,
    ]).map((fact) => ({
      key: fact.key,
      label: fact.label,
      applicable: true,
      value: fact.value,
    })),
    {
      key: "upgrades",
      label: labels.upgrades,
      applicable: (entry.supportedUpgrades?.length ?? 0) > 0,
      value: labels.upgrades,
      values: getBuildingExtensionLabels(entry.supportedUpgrades),
    },
    // Last of the figures: the effects are lists rather than numbers, and
    // for a signature building — which is always free — they are the only
    // thing distinguishing one from the next, so they close the card.
    {
      key: "bonuses",
      label: labels.bonuses,
      applicable: (entry.bonuses?.length ?? 0) > 0,
      value: labels.bonuses,
      values: entry.bonuses ?? [],
      tone: "good",
    },
    { key: "lot", label: labels.lot, applicable: hasFootprint(entry.lotWidth, entry.lotDepth), value: lot },
  ], Number.MAX_SAFE_INTEGER);
}

/**
 * The card's lines in two tiers: the game's own figures in full, then ours,
 * capped. The classification is data (VANILLA_FACT_KEYS plus the fixed keys
 * above), so the ledger and the card cannot disagree.
 */
export function hoverCardTiers(entry: BuildingCatalogEntry, context: HoverCardLineContext): HoverCardTiers {
  const lines = hoverCardLines(entry, context);
  const promoted = PROMOTED_BY_CATEGORY[entry.category];
  const isPrimary = (line: TileTooltipLine): boolean =>
    VANILLA_LINE_KEYS.has(line.key) || isVanillaFact(line.key) || (promoted?.has(line.key) ?? false);

  return {
    vanilla: lines.filter(isPrimary),
    extra: lines.filter((line) => !isPrimary(line)).slice(0, TILE_TOOLTIP_MAX_LINES),
  };
}
