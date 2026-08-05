import { Button, Tooltip } from "cs2/ui";
import { useEffect } from "react";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { formatBuildingMetric, formatLotDimensions } from "domain/buildingLensMetricFormat";
import { recordPlacement } from "domain/buildingShelf";
import { rankBuildingMatches, topSearchResult } from "domain/buildingSearchRank";
import styles from "./buildingList.module.scss";

interface BuildingListProps {
  entries: BuildingCatalogEntry[];
  searchText: string;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * Compact wrapped rows of fully-readable names.
 *
 * The third mode, and the one the zoning view was already doing by hand. Grid
 * shows a thumbnail with the name truncated — "Canopy-Covered Parkl…" — which
 * is fine when you recognise the building by sight and useless when you are
 * looking for one by name. Table shows every metric but fits about twelve rows
 * on a screen.
 *
 * This shows a small icon and the whole name, several to a row. It is the mode
 * for "there are two hundred of these and I know roughly what it is called",
 * which is the case that arrives with DLC and mods and that the other two
 * modes both handle badly.
 *
 * Deliberately no metrics on the tile and no hover forecast: adding them turns
 * this back into the table, which already exists.
 */
export const BuildingList = ({ entries, searchText, onPlace }: BuildingListProps) => {
  // Search relevance still applies within whatever order the query returned,
  // so typing narrows to the best match the same way it does in the grid.
  const ordered = rankBuildingMatches(entries, searchText ?? "");

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

  return (
    <div className={styles.list}>
      {ordered.map((entry) => {
        const label = entry.name || entry.prefabName;
        const cost = formatBuildingMetric(entry.constructionCost, "cost");
        const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);

        return (
          <Tooltip
            key={entry.id}
            tooltip={
              <div className={styles.card}>
                <div className={styles.cardName}>{label}</div>
                <div className={styles.cardMeta}>{cost} · {lot}</div>
              </div>
            }
          >
            <Button
              className={styles.item}
              variant="icon"
              onSelect={() => place(entry)}
              aria-label={label}
            >
              {entry.thumbnail
                ? <img className={styles.icon} src={entry.thumbnail} alt="" aria-hidden="true" />
                : <span className={styles.iconPlaceholder} aria-hidden="true" />}
              <span className={styles.name}>{label}</span>
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
};
