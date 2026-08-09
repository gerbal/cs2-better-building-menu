import { bindValue, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { type ReactNode } from "react";
import { useEffect } from "react";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { getShelf, recordPlacement } from "domain/buildingShelf";
import { canPlace, isEntryLocked } from "domain/buildingLockState";
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { rankBuildingMatches, topSearchResult } from "domain/buildingSearchRank";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { shortenTileLabel, stripRedundantNamePrefix, tileLabelCharBudget } from "domain/tileLabel";
import { sortedMetricFor, sortedMetricValue } from "domain/sortedMetric";
import { formatBuildingMetric, getNumberSeparators } from "domain/buildingLensMetricFormat";
import type { SortColumn } from "domain/buildingCatalogContracts";
import mod from "../../../mod.json";
import styles from "./buildingGrid.module.scss";

const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn", "Name");
const ShowShelf$ = bindValue<boolean>(mod.id, "BuildingLensShowShelf", true);
const ShelfSize$ = bindValue<number>(mod.id, "BuildingLensShelfSize", 12);
const TileSize$ = bindValue<number>(mod.id, "BuildingLensTileSize", 88);

interface BuildingGridProps {
  entries: BuildingCatalogEntry[];
  searchText: string;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, rendered inside this grid's own scroll. */
  footer?: ReactNode;
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
export const BuildingGrid = ({ entries, searchText, onPlace, footer, standalone = true }: BuildingGridProps) => {
  const { translate } = useLocalization();
  // One card for every view mode. Read once here rather than per tile: it is a
  // dozen live bindings, and a grid of 125 subscribing per row would open
  // sixteen hundred of them to draw one hover at a time.
  const hoverCard = useHoverCardContext();
  // The figure the result is currently ordered by, drawn on the tile. Sorting
  // by Capacity moved these tiles and nothing on screen said so; see
  // sortedMetric.ts. Null for Name and Category, which the tile already shows.
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const separators = getNumberSeparators(translate);
  // Already in Locale.json — an orphaned key with no consumer until now.
  const lockedLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Locked]", "Locked") ?? "Locked";
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
    // Vanilla refuses the same selection rather than hiding the tile
    // (ToolbarUISystem.cs:924), and its own grid routes a locked click to a
    // disabled sound instead of a placement. Recording it in the shelf would
    // also promote something the player cannot build.
    if (!canPlace(entry)) return;

    recordPlacement(entry.id);
    onPlace(entry);
  };

  /**
   * The sorted figure, or nothing.
   *
   * `lot` prints the pair the table's combined cell prints, because sorting by
   * width and reading only "6" invites the reader to think that is the lot.
   * A metric this entry never carried draws nothing at all rather than a dash:
   * the badge exists to explain an order, and "—" explains none.
   */
  const sortedBadge = (entry: BuildingCatalogEntry) => {
    if (sortedMetric === null) {
      return null;
    }

    const text = sortedMetric === "lot"
      ? (typeof entry.lotWidth === "number" && typeof entry.lotDepth === "number"
        ? `${entry.lotWidth}×${entry.lotDepth}`
        : null)
      : (() => {
        const value = sortedMetricValue(entry, sortedMetric);
        return value === null
          ? null
          : formatBuildingMetric(value, sortedMetric, separators, entry.costIsPerDistance);
      })();

    return text === null ? null : <span className={styles.sortedMetric}>{text}</span>;
  };

  const tile = (entry: BuildingCatalogEntry, key: string) => {
    const label = entry.name || entry.prefabName;
    const locked = isEntryLocked(entry);

    return (
      <BuildingHoverCard key={key} entry={entry} context={hoverCard}>
        <Button
          className={classNames(styles.tile, sortedMetric !== null && styles.tileSorted)}
          style={{ width: `${tileSize}rem` }}
          variant="icon"
          // See the table row: this is how the scroll anchor finds the tile
          // again after placement rebuilds the panel.
          data-catalog-entry={entry.id}
          onSelect={() => place(entry)}
          // Locked is announced, not just drawn. The visual treatment is a
          // silhouette, which says nothing to a screen reader and little to
          // anyone whose thumbnail has not generated yet.
          aria-label={locked ? `${label} — ${lockedLabel}` : label}
          aria-disabled={locked ? "true" : undefined}
          data-locked={locked ? "true" : undefined}
        >
          {entry.thumbnail
            ? <img
                className={styles.thumb}
                src={entry.thumbnail}
                onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                alt=""
              />
            : null}
          {/* Vanilla draws this only when the legacy interface is on, so on a
              default install its entire locked signal is the black silhouette.
              We draw it always: at this tile size a silhouette alone is not
              distinguishable from a thumbnail that has not rendered yet.
              Inline maskImage rather than a stylesheet url() — webpack's
              css-loader runs with url: true and would try to resolve a bare
              path as a module request from src/. */}
          {locked && (
            <span
              className={styles.lockGlyph}
              style={{ maskImage: "url(assetdb://gameui/Media/Glyphs/Lock.svg)" }}
              aria-hidden="true"
            />
          )}
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
          {sortedBadge(entry)}
        </Button>
      </BuildingHoverCard>
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

      <Scrollable
        className={styles.body}
        vertical
        trackVisibility="scrollable"
      >
        {tiles}
        {footer}
      </Scrollable>
    </div>
  );
};
