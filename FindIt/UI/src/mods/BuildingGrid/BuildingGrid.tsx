import { bindValue, useValue } from "cs2/api";
import { Button, Scrollable, Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
} from "domain/buildingLensMetricFormat";
import { getShelf, recordPlacement } from "domain/buildingShelf";
import { rankBuildingMatches } from "domain/buildingSearchRank";
import mod from "../../../mod.json";
import styles from "./buildingGrid.module.scss";

const ShowShelf$ = bindValue<boolean>(mod.id, "BuildingLensShowShelf", true);
const ShelfSize$ = bindValue<number>(mod.id, "BuildingLensShelfSize", 12);
const TileSize$ = bindValue<number>(mod.id, "BuildingLensTileSize", 88);

interface BuildingGridProps {
  entries: BuildingCatalogEntry[];
  searchText: string;
  onPlace: (entry: BuildingCatalogEntry) => void;
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
export const BuildingGrid = ({ entries, searchText, onPlace }: BuildingGridProps) => {
  const { translate } = useLocalization();
  const showShelf = useValue(ShowShelf$);
  const shelfSize = useValue(ShelfSize$);
  const tileSize = useValue(TileSize$);
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

  const place = (entry: BuildingCatalogEntry) => {
    recordPlacement(entry.id);
    onPlace(entry);
  };

  const tile = (entry: BuildingCatalogEntry, key: string) => {
    const cost = formatBuildingMetric(entry.constructionCost, "cost");
    const upkeep = formatBuildingMetric(entry.upkeep, "upkeep");
    const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory);
    const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);
    const label = entry.name || entry.prefabName;

    return (
      <Tooltip
        key={key}
        tooltip={
          // Three lines, hard cap. The whole argument for the grid collapses if
          // the hover card grows into the table again.
          <div className={styles.card}>
            <div className={styles.cardName}>{label}</div>
            <div className={styles.cardLine}>{cost} · {upkeep}</div>
            <div className={styles.cardLine}>{capacity} · {lot}</div>
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
          {entry.thumbnail ? <img className={styles.thumb} src={entry.thumbnail} alt="" /> : null}
          <span className={styles.tileName}>{label}</span>
        </Button>
      </Tooltip>
    );
  };

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
        <div className={classNames(styles.tiles, styles.bodyTiles)}>
          {ordered.map((entry) => tile(entry, `grid-${entry.id}`))}
        </div>
      </Scrollable>
    </div>
  );
};
