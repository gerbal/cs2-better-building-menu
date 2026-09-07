import { bindValue, useValue } from "cs2/api";
import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
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
import { buildTileTooltipLines, isMetricPresent } from "domain/buildingTileTooltip";
import { leisureLabel } from "domain/buildingLensRowDetails";
import { orderFacts, renderServiceFacts, renderServiceTextFacts } from "domain/serviceFacts";
import { clampAssetDescription, getBuildingExtensionLabels, resolveAssetDescription } from "domain/buildingLensRowDetails";
import { isEntryAlreadyBuilt, isEntryLocked, listLockConditions } from "domain/buildingLockState";
import { FootprintGlyph } from "mods/BuildingGlyphs/FootprintGlyph";
import type { ZoneFootprint } from "domain/zoningHierarchy";
import { useUnitSystem } from "domain/unitSettings";
import styles from "./buildingHoverCard.module.scss";

// Milestone index -> name, dense by index. A locked asset carries only the
// index, so this is read once here rather than resolved per asset in C#.
const BuildingLensMilestones$ = bindValue<string[]>(mod.id, "BuildingLensMilestones", []);

export interface HoverCardContext {
  milestoneNames: string[];
  separators: NumberSeparators;
  /**
   * The game's own sentence about an asset, resolved per entry.
   *
   * A function on the context rather than a `useLocalization` call in the card,
   * for the same reason every other value here is passed down: the card wraps
   * every tile, so a hook inside it is one hook per row — four hundred of them
   * on a full grid — to render the one card the player is actually pointing at.
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
 * Read the live city state ONCE, in the component that owns the list.
 *
 * Every subscription here is a binding, and there are a dozen of them. A view
 * showing 125 roads that subscribed per row would open sixteen hundred of them
 * to render one hover card at a time. The parent calls this; the card takes the
 * result as a prop.
 */
export const useHoverCardContext = (): HoverCardContext => {
  const { translate } = useLocalization();
  // One subscription per grid, like the milestones above it — the whole reason
  // this context exists rather than each card reading its own.
  const unitSystem = useUnitSystem();
  const milestoneNames = useValue(BuildingLensMilestones$) ?? [];

  return {
    milestoneNames,
    // Clamped here, not in the resolver: the expanded table row shows the same
    // description in a place that has room for all of it, and shortening it
    // there to suit a hover card would be the card dictating to the table.
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
      // "Requires", not "Availability". The line lists what the player has to
      // go and do; naming it after the state it describes made the reader work
      // out the implication for themselves.
      locked: translate("Tooltip.LABEL[BetterBuildingMenu.Requires]", "Requires") ?? "Requires",
      // The GAME's own string, asked for by its own key, so this reads exactly
      // as vanilla's already-built row does and in whatever language the player
      // has set. Ours is the fallback for when that key is not in the
      // dictionary, not the first choice.
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
  };
};

/**
 * One hover card, shared by every view mode.
 *
 * Grid, list, cards and table are four ways of drawing the same catalogue, so
 * an asset has to describe itself the same way in all of them. They had drifted
 * into three different answers: the grid carried a four-line labelled card, the
 * list and cards carried a thinner one line of "cost · lot", and the table had
 * no card at all — so the mode you happened to be in decided what the game
 * would tell you about a building.
 */
/**
 * The card itself, rendered only when the tooltip is actually shown.
 *
 * Its own component ON PURPOSE, and this is the whole point of the split.
 * React builds the ELEMENT for a tooltip cheaply and does not invoke the
 * function until the tooltip renders — so everything below happens on hover
 * rather than once per tile at grid time.
 *
 * Measured before and after. All of this used to run in BuildingHoverCard's
 * own body: a describe() lookup, four metric formatters, a cost forecast, a
 * forecast-series lookup and a capacity forecast, per entry. At roughly 2ms a
 * tile that is ~200ms of a ~283ms frozen frame every time a 100-tile menu
 * opens, for a card the player sees one of.
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
  // What the thing IS, before every line that is a number about it. This is
  // what vanilla shows on selection and the lens used to drop the moment a
  // player browsed through us instead of the vanilla grid.
  const description = describe(entry.prefabName);

  const cost = formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance);
  const upkeep = formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance);
  // The kind LABELS the figure, as on every other line: "Outdoor Recreation 1"
  // reads the same way as "Attractiveness 1" beside it. The kind alone would
  // not separate a bench from a botanical garden, and the amount is what a
  // player compares — but the amount alone names nothing, so it needs the kind
  // in front of it either way.
  //
  // It read "Recreation: Outdoor Recreation 1" before, whose label repeated
  // the word already in the value. The game's own word for the kind comes from
  // Properties.LEISURE_TYPE, so it can simply BE the label.
  //
  // Rejected: "Recreation: 1 Outdoor", which needs "Recreation" stripped off a
  // LOCALIZED string. Three of the seven kinds do not contain the word in
  // English at all — Meals, Entertainment, Travel — and no other language puts
  // it where a suffix strip would find it ("Erholung im Innenraum").
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
  const serviceFacts = renderServiceFacts(
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
    },
  );
  const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
  const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);

  // NO separate zone-facts block. There was one, reading an `entry.facts`
  // string array that nothing has ever written: ZoneCatalogEntry holds some of
  // those figures and is never published — it feeds the coverage audit alone —
  // and neither PrefabIndex nor BuildingCatalogEntry carried a zone field, so
  // the array was always empty and a zone tooltip drew its name and
  // description and stopped.
  //
  // A zone's figures now arrive as service facts, indexed off
  // ZoneServiceConsumptionData, ZonePollutionData, ZonePropertiesData and
  // ZoneData, and are drawn by the same lines every other specialist figure
  // uses. See serviceFacts.ts.
  const footprints = entry.footprints ?? [];
  const footprintOverflow = entry.footprintOverflow ?? 0;

  const lines = buildTileTooltipLines([
    // First, because it changes what every line under it means: a cost you
    // cannot pay yet is a different fact from a cost you can. Value is the bare
    // word — vanilla does not bind unlock requirements per asset, so there is no
    // honest "unlocks at N" to put here.
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
    // card means. Vanilla says this in the asset details panel as a band of its
    // own; our card is a label/value list, so it says it as a line — the same
    // fact, in this card's idiom, rather than a band bolted onto a list.
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
      // The price, and nothing about the treasury. The balance is on the HUD at
      // all times; a share of it is a fact about the CITY on a card about a
      // BUILDING, which is the same objection that took the capacity forecast
      // out (cm-7r5r).
      value: cost,
    },
    {
      key: "capacity",
      label: labels.capacity,
      // Zero is not a fact. A school's clinic or playground carries a
      // SchoolData with no students; "Capacity 0 students" states as a figure
      // what is really the absence of one.
      applicable: isMetricPresent(entry.capacity) && entry.capacity !== 0,
      // The building's own figure, and nothing about the city. A forecast here
      // answered a question about the CITY on a card about a BUILDING, and it
      // moved with the simulation while the building did not (cm-7r5r).
      value: capacity,
    },
    // What a park actually gives the city. "Parks & Recreation" holds a city
    // park, an indoor arena and a beach, and the catalog could not tell them
    // apart — the card showed a lot size, a cost and nothing about what the
    // thing is FOR. The game's own word for it, via Properties.LEISURE_TYPE.
    {
      key: "leisure",
      label: leisureKind,
      // A kind with no amount still says what the building is for, so it shows
      // as a statement rather than being dropped for having no figure.
      applicable: leisureKind !== "",
      statement: leisure === "",
      value: leisure,
    },
    // How far it reaches. For a telecom tower this is most of the point — a
    // network capacity says how much and nothing about where — and the same
    // component covers schools, hospitals and parks, so the line is not a
    // communications special case.
    {
      key: "range",
      label: labels.range,
      applicable: range !== "",
      value: range,
    },
    // The two figures a player picks one road over another by, and a network
    // card had neither: it showed a cost per kilometre and stopped. Both are
    // null on anything that is not a network, so this costs a building nothing.
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
    // After the universal figures, because these are the specialist ones: a
    // player reads cost and capacity on every card and helicopters on four.
    // Beside capacity, because it is one: how many cars the thing holds. Only
    // when there are bays — a zero here is a fact, but it is a fact about
    // something the player was not asking after on a building with no parking.
    {
      key: "parking",
      label: labels.parking,
      applicable: (entry.parkingSlots ?? 0) > 0,
      value: `${groupDigits(entry.parkingSlots ?? 0, separators)} ${labels.parkingBays}`,
    },
    // What the building HOLDS. cm-2xvs.19, from a residential signature
    // building whose card said nothing about the one thing it is for.
    //
    // Households is its own field rather than Capacity: capacity is derived
    // from SERVICE components — shelter beds, water m³, megawatts — and a
    // residential building has none, so it indexed null and the line vanished.
    {
      key: "households",
      label: labels.households,
      applicable: isMetricPresent(entry.households),
      value: `${groupDigits(entry.households ?? 0, separators)} ${labels.householdsUnit}`,
    },
    // Workers has been on the entry all along and reached only the table. A
    // zero IS meaningful here — "staffed by nobody" distinguishes a monument
    // from a workplace — so this tests presence, not magnitude, unlike parking.
    {
      key: "workers",
      label: labels.workers,
      applicable: isMetricPresent(entry.workers),
      value: `${groupDigits(entry.workers ?? 0, separators)} ${labels.workersUnit}`,
    },
    // The upgrades that can be attached later. Named, not counted: "3
    // upgrades" tells the player to go and look, and the point of a hover card
    // is that they do not have to.
    // The variable tail. Everything ABOVE this point is a field a reader can
    // expect in the same place on every card — cost, capacity, range, lot,
    // workers — so the eye learns those positions once. What a building
    // carries beyond them differs by type and can only be listed, but it is
    // listed in one declared order (FACT_ORDER) so a figure two buildings
    // share appears in the same relative place on both.
    //
    // Worded and numeric figures are merged BEFORE ordering: they render from
    // two lists, and showing all the words then all the numbers would let the
    // value's type decide the layout.
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
    // Above upkeep: what the building DOES outranks what it costs to run,
    // and for a signature building — which is always free — the effect is the
    // only thing distinguishing one from the next.
    {
      key: "bonuses",
      label: labels.bonuses,
      applicable: (entry.bonuses?.length ?? 0) > 0,
      value: labels.bonuses,
      values: entry.bonuses ?? [],
      tone: "good",
    },
    { key: "upkeep", label: labels.upkeep, applicable: isMetricPresent(entry.upkeep), value: upkeep },
    { key: "lot", label: labels.lot, applicable: hasFootprint(entry.lotWidth, entry.lotDepth), value: lot },
  ]);

  return (
    <div className={styles.card}>
      <div className={styles.cardName}>{label}</div>
      {description && <div className={styles.cardDescription}>{description}</div>}
      {/* Two across where they fit. Measured on a zone card: six label/value
          pairs, each on its own 215px row and each using about fifty of it —
          the card was three times taller than its content needed. The pairing
          is done by the flow rather than by a column count, so a long line
          (a list of unlock conditions, a recreation kind) still takes a whole
          row and only the short figures double up. */}
      <div className={styles.cardLines}>
      {lines.map((line) => (
        <div
          key={line.key}
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
      ))}
      </div>
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
 * Wraps a tile so hovering it explains the asset.
 *
 * Deliberately does no work of its own: see HoverCardContent.
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
