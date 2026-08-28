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
} from "domain/buildingLensMetricFormat";
import { getCapacityForecast, getCostForecast } from "domain/buildingForecast";
import { SERVICE_FORECAST_BINDINGS, getServiceForecastKey } from "domain/serviceForecast";
import { buildTileTooltipLines, isMetricPresent } from "domain/buildingTileTooltip";
import { clampAssetDescription, getBuildingExtensionLabels, resolveAssetDescription } from "domain/buildingLensRowDetails";
import { isEntryAlreadyBuilt, isEntryLocked, listLockConditions } from "domain/buildingLockState";
import { FootprintGlyph } from "mods/BuildingGlyphs/FootprintGlyph";
import type { ZoneFootprint } from "domain/zoningHierarchy";
import styles from "./buildingHoverCard.module.scss";

// The game's own live city state, so the card compares against the player's
// city rather than against nothing. One pair per demand series;
// SERVICE_FORECAST_BINDINGS names which pair a given building belongs to.
const Money$ = bindValue<number>("toolbarBottom", "money", 0);

// Milestone index -> name, dense by index. A locked asset carries only the
// index, so this is read once here rather than resolved per asset in C#.
const BuildingLensMilestones$ = bindValue<string[]>(mod.id, "BuildingLensMilestones", []);

const SERIES = Object.entries(SERVICE_FORECAST_BINDINGS).map(([key, b]) => ({
  key,
  unit: b.unit,
  capacity$: bindValue<number>(b.group, b.capacity, 0),
  demand$: bindValue<number>(b.group, b.demand, 0),
}));

export interface HoverCardContext {
  money: number;
  milestoneNames: string[];
  seriesByKey: Map<string, { capacity: number; demand: number; unit: string }>;
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
  labels: {
    cost: string;
    upkeep: string;
    capacity: string;
    lot: string;
    shareOfFunds: string;
    short: string;
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
  const money = useValue(Money$);
  const milestoneNames = useValue(BuildingLensMilestones$) ?? [];
  const seriesByKey = new Map(
    SERIES.map((s) => [s.key, { capacity: useValue(s.capacity$), demand: useValue(s.demand$), unit: s.unit }])
  );

  return {
    money,
    milestoneNames,
    seriesByKey,
    // Clamped here, not in the resolver: the expanded table row shows the same
    // description in a place that has room for all of it, and shortening it
    // there to suit a hover card would be the card dictating to the table.
    describe: (prefabName) => clampAssetDescription(resolveAssetDescription(prefabName, translate)),
    separators: getNumberSeparators(translate),
    labels: {
      cost: translate("Tooltip.LABEL[FindItBuildingMenu.Cost]", "Cost") ?? "Cost",
      upkeep: translate("Tooltip.LABEL[FindItBuildingMenu.Upkeep]", "Upkeep") ?? "Upkeep",
      capacity: translate("Tooltip.LABEL[FindItBuildingMenu.Capacity]", "Capacity") ?? "Capacity",
      lot: translate("Tooltip.LABEL[FindItBuildingMenu.Lot]", "Lot") ?? "Lot",
      shareOfFunds:
        translate("Tooltip.LABEL[FindItBuildingMenu.ShareOfFunds]", "{0}% of funds") ?? "{0}% of funds",
      short: translate("Tooltip.LABEL[FindItBuildingMenu.ShortBy]", "{0} short") ?? "{0} short",
      // "Requires", not "Availability". The line lists what the player has to
      // go and do; naming it after the state it describes made the reader work
      // out the implication for themselves.
      locked: translate("Tooltip.LABEL[FindItBuildingMenu.Requires]", "Requires") ?? "Requires",
      // The GAME's own string, asked for by its own key, so this reads exactly
      // as vanilla's already-built row does and in whatever language the player
      // has set. Ours is the fallback for when that key is not in the
      // dictionary, not the first choice.
      alreadyBuilt:
        translate("Toolbar.ASSET_ALREADY_BUILT", "")
        || translate("Tooltip.LABEL[FindItBuildingMenu.AlreadyBuilt]", "Already built")
        || "Already built",
      lockedValue: translate("Tooltip.LABEL[FindItBuildingMenu.Locked]", "Locked") ?? "Locked",
      bonuses: translate("Tooltip.LABEL[FindItBuildingMenu.Provides]", "Provides") ?? "Provides",
      parking: translate("Tooltip.LABEL[FindItBuildingMenu.Parking]", "Parking") ?? "Parking",
      households: translate("Tooltip.LABEL[FindItBuildingMenu.Households]", "Households") ?? "Households",
      householdsUnit: translate("Tooltip.LABEL[FindItBuildingMenu.HouseholdsUnit]", "households") ?? "households",
      workers: translate("Tooltip.LABEL[FindItBuildingMenu.Workers]", "Workers") ?? "Workers",
      workersUnit: translate("Tooltip.LABEL[FindItBuildingMenu.WorkersUnit]", "jobs") ?? "jobs",
      upgrades: translate("Tooltip.LABEL[FindItBuildingMenu.Upgrades]", "Upgrades") ?? "Upgrades",
      // "bays" rather than a bare number: the count is approximate for marked
      // lanes, and naming the unit keeps it from reading as an exact capacity.
      parkingBays: translate("Tooltip.LABEL[FindItBuildingMenu.ParkingBays]", "bays") ?? "bays",
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
  const { money, milestoneNames, seriesByKey, separators, labels, describe } = context;
  const label = entry.name || entry.prefabName;
  // What the thing IS, before every line that is a number about it. This is
  // what vanilla shows on selection and the lens used to drop the moment a
  // player browsed through us instead of the vanilla grid.
  const description = describe(entry.prefabName);

  const cost = formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance);
  const upkeep = formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance);
  const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
  const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);

  // No affordability forecast for a rate. A road's figure is per kilometre, so
  // "67% of funds" would be answering a question the player did not ask — they
  // might lay 300m of it. The cost still shows; only the comparison is dropped.
  const costForecast = entry.costIsPerDistance
    ? null
    : getCostForecast(entry.constructionCost, money);
  const forecastKey = getServiceForecastKey(entry);
  const live = forecastKey ? seriesByKey.get(forecastKey.key) : null;
  const capacityForecast = live
    ? getCapacityForecast({
        added: entry.capacity,
        current: live.capacity,
        demand: live.demand,
        unit: live.unit,
      })
    : null;

  // Zones carry their own facts — how tall they grow, what they trade in —
  // which the game measures and never shows. They are a property of the entry,
  // not of the view, so they belong on the card in every mode.
  const facts = (entry as unknown as { facts?: string[] }).facts ?? [];
  const footprints = (entry as unknown as { footprints?: ZoneFootprint[] }).footprints ?? [];
  const footprintOverflow = (entry as unknown as { footprintOverflow?: number }).footprintOverflow ?? 0;

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
      tone: costForecast && !costForecast.affordable ? "warn" : undefined,
      // The treasury balance is on screen at all times, so the card does not
      // repeat it. What it cannot read off the HUD is what share of the balance
      // this one purchase would take.
      value: costForecast && costForecast.share !== null && Number.isFinite(costForecast.share)
        ? `${cost} · ${labels.shareOfFunds.replace("{0}", `${costForecast.share}`)}`
        : cost,
    },
    {
      key: "capacity",
      label: labels.capacity,
      applicable: isMetricPresent(entry.capacity),
      // cm-7r5r. A shortfall is only claimed when the city's own capacity was
      // the baseline. Without one, the verdict is "does THIS BUILDING alone
      // meet the whole city's demand", which is nearly always no and says
      // nothing useful — a 25-patient clinic read as 355 short whether the
      // city had ample beds or none. Silence there rather than a number the
      // data cannot support, and no warning tone to dress it up.
      tone: capacityForecast?.basis === "city"
        ? (capacityForecast.covers ? "good" : "warn")
        : undefined,
      // Only the shortfall is stated. See buildingTileTooltip for why the
      // covered case says nothing.
      value: capacityForecast?.basis === "city" && !capacityForecast.covers
        ? `${capacity} · ${labels.short.replace("{0}", groupDigits(capacityForecast.shortfall, separators))}`
        : capacity,
    },
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
      {lines.map((line) => (
        <div
          key={line.key}
          className={classNames(
            styles.cardLine,
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
      {facts.length > 0 && <div className={styles.cardFacts}>{facts.join(" · ")}</div>}
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
