import { useValue } from "cs2/api";
import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useMemo } from "react";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  getNumberSeparators,
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
} from "domain/buildingLensMetricFormat";
import { buildTileTooltipLines, isMetricPresent, TILE_TOOLTIP_MAX_LINES } from "domain/buildingTileTooltip";
import { leisureLabel } from "domain/buildingLensRowDetails";
import { RESOURCE_UPKEEP_PREFIX, isVanillaFact, orderFacts, renderServiceFacts, renderServiceTextFacts } from "domain/serviceFacts";
import { clampAssetDescription, getBuildingExtensionLabels, resolveAssetDescription } from "domain/buildingLensRowDetails";
import { isEntryAlreadyBuilt, isEntryLocked, listLockConditions } from "domain/buildingLockState";
import { FootprintGlyph } from "mods/BuildingGlyphs/FootprintGlyph";
import { useUnitSystem } from "domain/unitSettings";
import styles from "./buildingHoverCard.module.scss";
import { BuildingLensMilestones$ } from "mods/bindings";

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

export interface HoverCardContext {
  milestoneNames: string[];
  separators: NumberSeparators;
  /**
   * The game's own sentence about an asset, resolved per entry. A function on
   * the context rather than a hook in the card, because the card wraps every
   * tile and only one of them is ever pointed at.
   */
  describe: (prefabName: string | null | undefined) => string | null;
  /** The game's word for a LeisureType, resolved where translate lives. */
  leisureName: (leisureType: string | null | undefined) => string;
  /** Bound translate, for the service-fact table's own keys. */
  translateFact: (key: string, fallback: string | null) => string | null;
  labels: {
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
  };
}

/**
 * Read the live city state ONCE, in the component that owns the list. There are
 * a dozen bindings here, and a view that subscribed per row would open hundreds
 * of them to render one hover card. The card takes the result as a prop.
 */
export const useHoverCardContext = (): HoverCardContext => {
  const { translate } = useLocalization();
  // One subscription per grid, like the milestones below — the whole reason
  // this context exists rather than each card reading its own.
  const unitSystem = useUnitSystem();
  const milestoneNames = useValue(BuildingLensMilestones$) ?? [];

  // One object until one of these changes, so the rows it is handed to can skip
  // a render; translate holds still until the language changes.
  return useMemo(() => ({
    milestoneNames,
    // Clamped here, not in the resolver: the expanded table row shows the same
    // description where there is room for all of it, and shortening it there
    // would be the card dictating to the table.
    describe: (prefabName) => clampAssetDescription(resolveAssetDescription(prefabName, translate)),
    // Resolved up here for the same reason describe is: translate belongs to
    // the component that holds the localization hook, not to the card.
    leisureName: (leisureType: string | null | undefined) => leisureLabel(leisureType, translate),
    translateFact: translate,
    separators: getNumberSeparators(translate, unitSystem),
    labels: {
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
    },
  }), [translate, unitSystem, milestoneNames]);
};

/**
 * One card body, shared by every view mode, rendered only when the tooltip is
 * shown. Its own component ON PURPOSE: React does not invoke the function until
 * then, so the formatting below happens on hover, not once per tile.
 */
const HoverCardContent = ({
  entry,
  context,
}: {
  entry: BuildingCatalogEntry;
  context: HoverCardContext;
}) => {
  const { milestoneNames, separators, labels, describe, leisureName, translateFact } = context;
  const label = entry.name || entry.prefabName;
  // What the thing IS, before every line that is a number about it — the same
  // sentence vanilla shows on selection.
  const description = describe(entry.prefabName);

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
      moneyPerDistance: (value) => formatBuildingMetric(value, "cost", separators, true),
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
  const footprints = entry.footprints ?? [];
  const footprintOverflow = entry.footprintOverflow ?? 0;

  // Uncapped here: the cap is applied per tier below, so a long tail of our
  // own figures can never push one of the game's lines off the card.
  const lines = buildTileTooltipLines([
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

  // Two tiers: the game's own figures first in the normal weight, ours after a
  // hairline and dimmer. The classification is data (VANILLA_FACT_KEYS plus
  // the fixed keys above), so the ledger and this card cannot disagree.
  const promoted = PROMOTED_BY_CATEGORY[entry.category];
  const isPrimary = (line: (typeof lines)[number]): boolean =>
    VANILLA_LINE_KEYS.has(line.key) || isVanillaFact(line.key) || (promoted?.has(line.key) ?? false);
  const vanillaTier = lines.filter(isPrimary);
  // Vanilla's tier in full; the cap applies to ours alone.
  const extraTier = lines.filter((line) => !isPrimary(line)).slice(0, TILE_TOOLTIP_MAX_LINES);

  const renderLine = (line: (typeof lines)[number]) => (
    <div
      key={line.key}
      data-line={line.key}
      className={classNames(
        styles.cardLine,
        // A list of values is a stack; pairing it with a neighbour would
        // put a one-line figure beside a three-line block.
        line.values && line.values.length > 0 && styles.cardLineWide,
        line.tone === "warn" && styles.cardWarn,
        line.tone === "good" && styles.cardGood,
      )}
    >
      <span className={styles.cardLabel}>{line.label}</span>
      {line.values
        ? (
          <span className={classNames(styles.cardValue, styles.cardValueList)}>
            {line.values.map((entryValue) => (
              <span key={entryValue} className={styles.cardValueLine}>{entryValue}</span>
            ))}
          </span>
        )
        : <span className={styles.cardValue}>{line.value}</span>}
    </div>
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardName}>{label}</div>
      {description && <div className={styles.cardDescription}>{description}</div>}
      {/* Two across where they fit, so short figures do not each take a whole
          row. Paired by the flow rather than by a column count, so a long line
          still gets a row to itself. */}
      {/* With the game's tier empty, ours IS the card: normal weight, no
          divider, so it does not read as an afterthought. With both empty
          there is no block at all — a frame around nothing promises detail. */}
      {vanillaTier.length === 0
        ? (extraTier.length === 0 ? null : (
          <div className={styles.cardLines}>
            {extraTier.map(renderLine)}
          </div>
        ))
        : (
          <>
            <div className={styles.cardLines}>
              {vanillaTier.map(renderLine)}
            </div>
            {extraTier.length > 0 && (
              <>
                <div className={styles.cardDivider} aria-hidden="true" />
                <div className={classNames(styles.cardLines, styles.cardLinesExtra)} data-tier="extra">
                  {extraTier.map(renderLine)}
                </div>
              </>
            )}
          </>
        )}
      {/* The shapes, narrowest first. A player choosing a zone is matching
          against a block on the map, and a picture of the lot is closer to
          that than "2–4 wide" is. */}
      {footprints.length > 0 && (
        <div className={styles.glyphs}>
          {footprints.map((footprint) => (
            <FootprintGlyph key={`${footprint.width}x${footprint.depth}`} footprint={footprint} />
          ))}
          {footprintOverflow > 0 && <span className={styles.glyphOverflow}>+{footprintOverflow}</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Wraps a tile so hovering it explains the asset. Deliberately does no work of
 * its own: see HoverCardContent.
 */
export const BuildingHoverCard = ({
  entry,
  context,
  children,
}: {
  entry: BuildingCatalogEntry;
  context: HoverCardContext;
  children: JSX.Element;
}) => (
  <Tooltip tooltip={<HoverCardContent entry={entry} context={context} />}>
    {children}
  </Tooltip>
);
