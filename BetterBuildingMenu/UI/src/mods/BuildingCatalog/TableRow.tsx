import { Button } from "cs2/ui";
import classNames from "classnames";
import { memo, type CSSProperties } from "react";
import { BuildingCatalogEntry, formatBuildingCatalogLabels } from "domain/buildingCatalog";
import type { BuildingLensMetric } from "domain/buildingLensLayout";
import {
  formatBuildingLevel,
  formatBuildingMetric,
  METRIC_NOT_APPLICABLE,
  formatCapacity,
  formatLotDimensions,
  getNumberSeparators,
  hasFootprint, METRIC_NO_DATA,
} from "domain/buildingLensMetricFormat";
import { shortenTileLabel } from "domain/tileLabel";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import {
  canPlace,
  entryStateWord,
  hasVectorThumbnail,
  isEntryAlreadyBuilt,
  isEntryLocked,
  lockedThumbnail,
} from "domain/buildingLockState";
import { BuildingHoverCard, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { BuildingResultDetails } from "./BuildingResultDetails";
import styles from "./buildingCatalog.module.scss";

/** The translated words a row needs; translated once by the view, not per row. */
export interface TableRowLabels {
  place: string;
  inspect: string;
  locked: string;
  built: string;
}

export interface TableRowProps {
  entry: BuildingCatalogEntry;
  expanded: boolean;
  /** Characters the name cell can show before the middle is elided. */
  nameBudget: number;
  separators: ReturnType<typeof getNumberSeparators>;
  labels: TableRowLabels;
  /** What the hover card reads, the same card every view shows; read once by the table. */
  hoverCard: HoverCardContext;
  /** The width of one metric column, shared with the header so they line up. */
  columnStyle(metric: BuildingLensMetric): CSSProperties;
  /** Resolves a raw facet id (a DLC's numeric id) to the name the filter shows. */
  resolveFacetLabel(groupId: string, value: string): string | null;
  onPlace(entry: BuildingCatalogEntry): void;
  onToggleExpanded(id: number): void;
}

/**
 * One row of the table: the hover-carded Place control holding the identity
 * cell and the seven metric cells, the details chevron, and the details
 * themselves when expanded. Memoised: a keystroke re-renders the table, and a
 * row whose props hold still need not follow it.
 */
export const TableRow = memo(function TableRow({
  entry,
  expanded,
  nameBudget,
  separators,
  labels,
  hoverCard,
  columnStyle,
  resolveFacetLabel,
  onPlace,
  onToggleExpanded,
}: TableRowProps) {
  const rawCategoryIdentity = entry.subCategory
    ? `${entry.category} · ${entry.subCategory}`
    : entry.category;
  const entryLabel = entry.name || entry.prefabName;
  const rowPlaceLabel = `${labels.place}: ${entryLabel}`;
  const rowInspectLabel = `${labels.inspect}: ${entryLabel}`;
  const stateWord = entryStateWord(entry, labels.locked, labels.built);

  return (
    <div
      className={styles.row}
      // How the scroll anchor finds this row again after the panel is rebuilt.
      // An id rather than a position: the window can come back a different
      // length, and an expanded row is height: auto.
      data-catalog-entry={entry.id}
      data-expanded={expanded ? "true" : undefined}
      data-locked={isEntryLocked(entry) ? "true" : undefined}
      data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
      // Same pair as the grid and the list: the ground says unplaceable, the
      // reason is said in the Place button below.
      data-already-built={isEntryAlreadyBuilt(entry) ? "true" : undefined}
    >
      {/* Wrapping .rowSelect rather than the row: the row also holds the
          details control, which is not this building's description. cs2/ui's
          Tooltip clones its child instead of wrapping it in an element, so
          the flex row is unaffected. No title= alongside it — that would put
          two tooltips on one control. */}
      <BuildingHoverCard entry={entry} context={hoverCard}>
        <Button
          className={styles.rowSelect}
          variant="icon"
          // The row places, as a click in every other view does. NOT disabled
          // when the entry cannot be: onPlace refuses, and disabling takes the
          // hover card with it — where a locked building says what it awaits.
          onSelect={() => onPlace(entry)}
          aria-label={stateWord ? `${rowPlaceLabel} — ${stateWord}` : rowPlaceLabel}
          data-refused={canPlace(entry) ? undefined : "true"}
          data-expanded={expanded ? "true" : undefined}
        >
          <div className={styles.identityCell}>
            {/* The badge sits ON the picture here too, at the same ratio the
                grid and the rows use. */}
            <div className={styles.thumbnail}>
              {entry.thumbnail && (
                <img
                  // Named, so the silhouette filter can reach the building
                  // without also reaching the badge on top of it.
                  className={styles.picture}
                  src={lockedThumbnail(entry, isEntryLocked(entry) || isEntryAlreadyBuilt(entry))}
                  onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                />
              )}
              {entry.isUnique === true && (
                <img
                  className={classNames(
                    styles.uniqueAsset,
                    isEntryAlreadyBuilt(entry) ? styles.alreadyBuilt : styles.uniqueMark
                  )}
                  src={isEntryAlreadyBuilt(entry)
                    ? "Media/Game/Icons/AlreadyBuilt.svg"
                    : "Media/Game/Icons/Unique.svg"}
                  alt=""
                  aria-hidden="true"
                />
              )}
            </div>
            <div className={styles.identity}>
              <div className={styles.nameLine}>
                {/* Elide the MIDDLE, not the tail, which is what tells one
                    name from its neighbours; and not the tiles' prefix strip,
                    because this table is flat and multi-theme, so dropping the
                    theme token collides two names. title has the full name. */}
                <div className={styles.name} title={entryLabel}>
                  {shortenTileLabel(entryLabel, nameBudget)}
                </div>
                {/* The row's own verb, which is Place — or the reason it will
                    not, so a locked row says so where the eye already is
                    rather than only in a tooltip. */}
                <span className={styles.placeHint} aria-hidden="true">
                  {stateWord ?? labels.place}
                </span>
              </div>
              <div className={styles.category} title={rawCategoryIdentity}>
                {formatBuildingCatalogLabels(entry)}
              </div>
            </div>
          </div>
          <div className={classNames(styles.metric, styles.metricCost)} style={columnStyle("cost")} data-metric="cost" title={`Cost ${formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)}`}>
            {formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance)}
          </div>
          <div className={classNames(styles.metric, styles.metricUpkeep)} style={columnStyle("upkeep")} data-metric="upkeep" title={`Upkeep ${formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)}`}>
            {formatBuildingMetric(entry.upkeep, "upkeep", separators, entry.costIsPerDistance)}
          </div>
          <div className={classNames(styles.metric, styles.metricWorkers)} style={columnStyle("workers")} data-metric="workers" title={`Workers ${formatBuildingMetric(entry.workers, "workers", separators)}`}>
            {formatBuildingMetric(entry.workers, "workers", separators)}
          </div>
          <div className={classNames(styles.metric, styles.metricCapacity)} style={columnStyle("capacity")} data-metric="capacity" title={`Capacity ${formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}`}>
            {formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators)}
          </div>
          <div className={classNames(styles.metric, styles.metricLot)} style={columnStyle("lot")} data-metric="lot" title="Lot dimensions">
            {/* A road's lot is 0x0 and a zone has none: a measurement of
                something that does not exist, so no data rather than "0 × 0"
                — the rule the tile and the hover card already follow. */}
            {hasFootprint(entry.lotWidth, entry.lotDepth) ? formatLotDimensions(entry.lotWidth, entry.lotDepth) : METRIC_NO_DATA}
          </div>
          <div
            className={classNames(styles.metric, styles.metricLevel)}
            style={columnStyle("level")} data-metric="level"
            title={entry.buildingLevel >= 1 ? "Building level" : "No building level"}
          >
            {/* Not the raw number: a service building has no level, and a 0
                beside a Workers dash meaning "not known" reads as one we
                failed to read. */}
            {formatBuildingLevel(entry.buildingLevel)}
          </div>
          <div
            className={classNames(styles.parking, styles.metricParking, entry.hasParking && styles.parkingActive)}
            style={columnStyle("parking")} data-metric="parking"
            title={entry.hasParking ? `${entry.parkingSlots} parking bays (approximate)` : "No parking"}
          >
            {/* The count, not a glyph: between two car parks "does it park
                cars" is yes either way. Not the no-data dash for zero, since
                no parking is a fact rather than a gap. */}
            {entry.hasParking ? entry.parkingSlots : METRIC_NOT_APPLICABLE}
          </div>
        </Button>
      </BuildingHoverCard>
      {/* Expanding is its own control, so the row keeps one verb — Place —
          and the chevron says "there is more inside this". */}
      <Button
        className={classNames(styles.rowDetailsButton, expanded && styles.rowDetailsButtonOpen)}
        variant="icon"
        onSelect={() => onToggleExpanded(entry.id)}
        aria-label={rowInspectLabel}
        title={rowInspectLabel}
        data-expanded={expanded ? "true" : undefined}
      >
        {/* The game's own stroke arrow, masked so it takes the button's
            colour. Not the U+2304/U+2303 arrowheads: Noto Sans, the game's UI
            face, does not carry them and draws a missing-glyph box. */}
        <img
          className={styles.rowDetailsGlyph}
          style={{ maskImage: expanded ? "url(Media/Glyphs/StrokeArrowUp.svg)" : "url(Media/Glyphs/StrokeArrowDown.svg)" }}
          alt=""
          aria-hidden="true"
        />
      </Button>
      {expanded && (
        <BuildingResultDetails entry={entry} resolveFacetLabel={resolveFacetLabel} />
      )}
    </div>
  );
});
