import { Button } from "cs2/ui";
import classNames from "classnames";
import type { CSSProperties } from "react";
import { BuildingCatalogEntry, formatBuildingCatalogLabels } from "domain/buildingCatalog";
import type { BuildingLensMetric } from "domain/buildingLensLayout";
import {
  formatBuildingLevel,
  formatBuildingMetric,
  METRIC_NOT_APPLICABLE,
  formatCapacity,
  formatLotDimensions,
  getNumberSeparators,
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
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
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
 * themselves when expanded.
 */
export const TableRow = ({
  entry,
  expanded,
  nameBudget,
  separators,
  labels,
  columnStyle,
  resolveFacetLabel,
  onPlace,
  onToggleExpanded,
}: TableRowProps) => {
  // The same card every other view mode shows. The table had none, so it was
  // the one mode that could not answer a question its columns had no room
  // for.
  const hoverCard = useHoverCardContext();
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
      // How the scroll anchor finds this row again after the panel is
      // rebuilt. An id rather than a position, because the window can come
      // back a different length and these rows are not a uniform height — an
      // expanded one is height: auto.
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
          // The row places. Every other view mode already behaved this way —
          // a click in Grid, List and Cards arms the tool — and only the
          // table disagreed, so a player who learned the verb anywhere else
          // got something different here (cm-auzd).
          //
          // NOT disabled when the entry cannot be placed, deliberately.
          // onPlace already refuses, and disabling the row would take its
          // hover card with it — which is exactly where a locked building
          // explains what it is waiting for. The refusal is named in
          // aria-label and title instead.
          onSelect={() => onPlace(entry)}
          aria-label={stateWord ? `${rowPlaceLabel} — ${stateWord}` : rowPlaceLabel}
          data-refused={canPlace(entry) ? undefined : "true"}
          data-expanded={expanded ? "true" : undefined}
        >
          <div className={styles.identityCell}>
            {/* The badge sits ON the picture here too, at the same ratio the
                grid and the rows use — this thumbnail is 68rem, which
                happens to be vanilla's own image size. */}
            <div className={styles.thumbnail}>
              {entry.thumbnail && (
                <img
                  // Named, so the silhouette filter can reach the building
                  // without also reaching the badge on top of it. The grid
                  // and the list have always named theirs (.thumb, .icon).
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
                {/* Elide the MIDDLE, not the tail. CSS can only cut at an
                    edge, and the tail is what distinguishes one name from its
                    neighbours — "EU Commercial Gas Station 01 - L1 2x2" and
                    "EU Commercial High 01 - L1 2x2" differ only after the
                    twelfth character.

                    NOT stripRedundantNamePrefix, which the tiles use. That
                    drops leading theme words, safe in the grid because the
                    grid is scoped to one menu. This table is flat, sortable
                    and multi-theme: dropping the token turns "EU Commercial
                    High 01" and "NA Commercial High 01" into the same string,
                    sorted adjacent — the very collision this removes.

                    title carries the full name either way. */}
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
            {formatLotDimensions(entry.lotWidth, entry.lotDepth)}
          </div>
          <div
            className={classNames(styles.metric, styles.metricLevel)}
            style={columnStyle("level")} data-metric="level"
            title={entry.buildingLevel >= 1 ? "Building level" : "No building level"}
          >
            {/* Not the raw number. A service building has no level, and
                printing its 0 beside a Workers dash meaning "not known" said
                it might have one we failed to read. See cm-ch0z. */}
            {formatBuildingLevel(entry.buildingLevel)}
          </div>
          <div
            className={classNames(styles.parking, styles.metricParking, entry.hasParking && styles.parkingActive)}
            style={columnStyle("parking")} data-metric="parking"
            title={entry.hasParking ? `${entry.parkingSlots} parking bays (approximate)` : "No parking"}
          >
            {/* The count, not a "P". A glyph answered "does it park cars",
                which is rarely the question — between two car parks the
                answer is yes either way. Still not the no-data dash for zero:
                a building with no parking is a fact rather than a gap. */}
            {entry.hasParking ? entry.parkingSlots : METRIC_NOT_APPLICABLE}
          </div>
        </Button>
      </BuildingHoverCard>
      {/* Expanding is its own control. It used to be the whole row, which
          meant the row and every other view mode taught two different verbs
          for the same gesture. A chevron says "there is more inside this"
          without claiming the row. */}
      <Button
        className={classNames(styles.rowDetailsButton, expanded && styles.rowDetailsButtonOpen)}
        variant="icon"
        onSelect={() => onToggleExpanded(entry.id)}
        aria-label={rowInspectLabel}
        title={rowInspectLabel}
        data-expanded={expanded ? "true" : undefined}
      >
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </Button>
      {expanded && (
        <BuildingResultDetails entry={entry} resolveFacetLabel={resolveFacetLabel} />
      )}
    </div>
  );
};
