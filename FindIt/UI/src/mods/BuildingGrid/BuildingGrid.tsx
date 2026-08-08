import { bindValue, useValue } from "cs2/api";
import { Button, Scrollable, Tooltip } from "cs2/ui";
import { useEffect } from "react";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  getNumberSeparators,
} from "domain/buildingLensMetricFormat";
import { getShelf, recordPlacement } from "domain/buildingShelf";
import { getCapacityForecast, getCostForecast } from "domain/buildingForecast";
import { SERVICE_FORECAST_BINDINGS, getServiceForecastKey } from "domain/serviceForecast";
import { groupDigits } from "domain/buildingLensMetricFormat";
import { rankBuildingMatches, topSearchResult } from "domain/buildingSearchRank";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { shortenTileLabel, stripRedundantNamePrefix, tileLabelCharBudget } from "domain/tileLabel";
import mod from "../../../mod.json";
import styles from "./buildingGrid.module.scss";

// The game's own live city state, so the hover card compares against the
// player's city rather than against nothing. One pair per demand series;
// SERVICE_FORECAST_BINDINGS names which pair a given building belongs to.
const Money$ = bindValue<number>("toolbarBottom", "money", 0);

const SERIES = Object.entries(SERVICE_FORECAST_BINDINGS).map(([key, b]) => ({
  key,
  unit: b.unit,
  capacity$: bindValue<number>(b.group, b.capacity, 0),
  demand$: bindValue<number>(b.group, b.demand, 0),
}));

const ShowShelf$ = bindValue<boolean>(mod.id, "BuildingLensShowShelf", true);
const ShelfSize$ = bindValue<number>(mod.id, "BuildingLensShelfSize", 12);
const TileSize$ = bindValue<number>(mod.id, "BuildingLensTileSize", 72);

interface BuildingGridProps {
  entries: BuildingCatalogEntry[];
  searchText: string;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /**
   * False when this grid is one group among several, which is the grouped view.
   * A scroll container per group would give every heading its own scrollbar and
   * make the set impossible to read as one thing; the caller wraps the whole
   * grouped result in a single scroll instead.
   *
   * The shelf goes with it: "frequently placed" repeated above every group is
   * the same shortlist printed N times.
   */
  standalone?: boolean;
}

/**
 * Thumbnails first: the fast path back to the map.
 *
 * The table asks you to read; this asks you to recognise. Order is fixed (see
 * stableGridOrder) so a building keeps its position between visits and becomes
 * a pointer gesture rather than a lookup. The numbers we project are not gone —
 * they moved to the hover card, which costs nothing until you actually want
 * them.
 */
export const BuildingGrid = ({ entries, searchText, onPlace, standalone = true }: BuildingGridProps) => {
  const { translate } = useLocalization();
  const separators = getNumberSeparators(translate);
  const showShelf = useValue(ShowShelf$);
  const shelfSize = useValue(ShelfSize$);
  const tileSize = useValue(TileSize$);
  const money = useValue(Money$);
  // Hooks must not be called conditionally, so every series is read every
  // render and the relevant one is picked per tile.
  const series = SERIES.map((s) => ({
    key: s.key,
    unit: s.unit,
    capacity: useValue(s.capacity$),
    demand: useValue(s.demand$),
  }));
  const seriesByKey = new Map(series.map((s) => [s.key, s]));
  // Relevance while a query is active, stable position while browsing. The two
  // orders want opposite things and rankBuildingMatches falls back to the
  // stable one for an empty query and for ties.
  const ordered = rankBuildingMatches(entries, searchText ?? "");
  const shelfIds = getShelf();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  // Only what is in this category; the shelf is global but must not advertise
  // buildings the current filter has excluded.
  const shelf = (showShelf ? shelfIds.slice(0, shelfSize) : [])
    .map((id) => byId.get(id))
    .filter(Boolean) as BuildingCatalogEntry[];

  // Enter arms the best match, so a search can be completed without leaving
  // the keyboard. Bound on the document because the search field belongs to
  // FindIt's own header, not to this component.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;

      const top = topSearchResult(ordered, searchText ?? "");
      if (!top) return;

      recordPlacement(top.id);
      onPlace(top);
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [ordered, searchText, onPlace]);

  const place = (entry: BuildingCatalogEntry) => {
    recordPlacement(entry.id);
    onPlace(entry);
  };

  const tile = (entry: BuildingCatalogEntry, key: string) => {
    const cost = formatBuildingMetric(entry.constructionCost, "cost", separators);
    const upkeep = formatBuildingMetric(entry.upkeep, "upkeep", separators);
    const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
    const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);
    const label = entry.name || entry.prefabName;

    // The forecast is the reason to stop and read: cost against what you have,
    // and coverage against what the city is short of.
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

    return (
      <Tooltip
        key={key}
        tooltip={
          // Three lines, hard cap. The whole argument for the grid collapses if
          // the hover card grows into the table again.
          <div className={styles.card}>
            <div className={styles.cardName}>{label}</div>
            {costForecast && costForecast.treasury !== null ? (
              <div className={classNames(styles.cardLine, !costForecast.affordable && styles.cardWarn)}>
                {groupDigits(costForecast.cost, separators)} of {groupDigits(costForecast.treasury, separators)}
                {costForecast.share !== null && Number.isFinite(costForecast.share)
                  ? ` · ${costForecast.share}%`
                  : ""}
              </div>
            ) : (
              <div className={styles.cardLine}>{cost}</div>
            )}
            {capacityForecast ? (
              <div className={classNames(styles.cardLine, capacityForecast.covers && styles.cardGood)}>
                {capacityForecast.projected !== null
                  ? `${groupDigits(capacityForecast.projected, separators)} of ${groupDigits(capacityForecast.demand, separators)}`
                  : `+${groupDigits(capacityForecast.added, separators)} vs ${groupDigits(capacityForecast.demand, separators)}`}{" "}
                {capacityForecast.unit}
                {capacityForecast.covers
                  ? " · covers it"
                  : ` · ${groupDigits(capacityForecast.shortfall, separators)} short`}
              </div>
            ) : (
              <div className={styles.cardLine}>{capacity} · {lot}</div>
            )}
            <div className={styles.cardLine}>{upkeep} · {lot}</div>
          </div>
        }
      >
        <Button
          className={styles.tile}
          style={{ width: `${tileSize}rem` }}
          variant="icon"
          onSelect={() => place(entry)}
          aria-label={label}
        >
          {entry.thumbnail
            ? <img
                className={styles.thumb}
                src={entry.thumbnail}
                onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                alt=""
              />
            : null}
          {/* Shortened for drawing only. The tooltip above and the aria-label on
              the Button both still carry the whole name. */}
          <span className={styles.tileName}>
            {shortenTileLabel(
              stripRedundantNamePrefix(label, {
                category: entry.categoryLabel ?? entry.category,
                subCategory: entry.subCategoryLabel ?? entry.subCategory,
                theme: entry.theme,
              }),
              tileLabelCharBudget(tileSize)
            )}
          </span>
        </Button>
      </Tooltip>
    );
  };

  const tiles = (
    <div className={classNames(styles.tiles, styles.bodyTiles)}>
      {ordered.map((entry) => tile(entry, `grid-${entry.id}`))}
    </div>
  );

  if (!standalone) {
    return tiles;
  }

  return (
    <div className={styles.grid}>
      {shelf.length > 0 && !searchText?.trim() && (
        <div className={styles.shelf}>
          <div className={styles.shelfLabel}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.Shelf]", "Frequently placed") ?? "Frequently placed"}
          </div>
          <div className={styles.tiles}>{shelf.map((entry) => tile(entry, `shelf-${entry.id}`))}</div>
        </div>
      )}

      <Scrollable className={styles.body} vertical trackVisibility="scrollable">
        {tiles}
      </Scrollable>
    </div>
  );
};
