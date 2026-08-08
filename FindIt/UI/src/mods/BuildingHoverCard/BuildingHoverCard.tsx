import { bindValue, useValue } from "cs2/api";
import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
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
import { FootprintGlyph } from "mods/ZoningHierarchy/FootprintGlyph";
import type { ZoneFootprint } from "domain/zoningHierarchy";
import styles from "./buildingHoverCard.module.scss";

// The game's own live city state, so the card compares against the player's
// city rather than against nothing. One pair per demand series;
// SERVICE_FORECAST_BINDINGS names which pair a given building belongs to.
const Money$ = bindValue<number>("toolbarBottom", "money", 0);

const SERIES = Object.entries(SERVICE_FORECAST_BINDINGS).map(([key, b]) => ({
  key,
  unit: b.unit,
  capacity$: bindValue<number>(b.group, b.capacity, 0),
  demand$: bindValue<number>(b.group, b.demand, 0),
}));

export interface HoverCardContext {
  money: number;
  seriesByKey: Map<string, { capacity: number; demand: number; unit: string }>;
  separators: NumberSeparators;
  labels: {
    cost: string;
    upkeep: string;
    capacity: string;
    lot: string;
    shareOfFunds: string;
    short: string;
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
  const seriesByKey = new Map(
    SERIES.map((s) => [s.key, { capacity: useValue(s.capacity$), demand: useValue(s.demand$), unit: s.unit }])
  );

  return {
    money,
    seriesByKey,
    separators: getNumberSeparators(translate),
    labels: {
      cost: translate("Tooltip.LABEL[FindItBuildingMenu.Cost]", "Cost") ?? "Cost",
      upkeep: translate("Tooltip.LABEL[FindItBuildingMenu.Upkeep]", "Upkeep") ?? "Upkeep",
      capacity: translate("Tooltip.LABEL[FindItBuildingMenu.Capacity]", "Capacity") ?? "Capacity",
      lot: translate("Tooltip.LABEL[FindItBuildingMenu.Lot]", "Lot") ?? "Lot",
      shareOfFunds:
        translate("Tooltip.LABEL[FindItBuildingMenu.ShareOfFunds]", "{0}% of funds") ?? "{0}% of funds",
      short: translate("Tooltip.LABEL[FindItBuildingMenu.ShortBy]", "{0} short") ?? "{0} short",
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
export const BuildingHoverCard = ({
  entry,
  context,
  children,
}: {
  entry: BuildingCatalogEntry;
  context: HoverCardContext;
  children: JSX.Element;
}) => {
  const { money, seriesByKey, separators, labels } = context;
  const label = entry.name || entry.prefabName;

  const cost = formatBuildingMetric(entry.constructionCost, "cost", separators);
  const upkeep = formatBuildingMetric(entry.upkeep, "upkeep", separators);
  const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
  const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);

  const costForecast = getCostForecast(entry.constructionCost, money);
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
      tone: capacityForecast ? (capacityForecast.covers ? "good" : "warn") : undefined,
      // Only the shortfall is stated. See buildingTileTooltip for why the
      // covered case says nothing.
      value: capacityForecast && !capacityForecast.covers
        ? `${capacity} · ${labels.short.replace("{0}", groupDigits(capacityForecast.shortfall, separators))}`
        : capacity,
    },
    { key: "upkeep", label: labels.upkeep, applicable: isMetricPresent(entry.upkeep), value: upkeep },
    { key: "lot", label: labels.lot, applicable: hasFootprint(entry.lotWidth, entry.lotDepth), value: lot },
  ]);

  return (
    <Tooltip
      tooltip={
        <div className={styles.card}>
          <div className={styles.cardName}>{label}</div>
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
              <span className={styles.cardValue}>{line.value}</span>
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
      }
    >
      {children}
    </Tooltip>
  );
};
