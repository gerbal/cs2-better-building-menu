import { useValue } from "mods/panelValue";
import { Button, Scrollable } from "cs2/ui";
import { type ReactNode } from "react";
import { memo, useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { canPlace, entryStateWord, isEntryLocked } from "domain/buildingLockState";
import { entryLabel, entryStateAttributes, sortedBadgeText } from "domain/buildingEntryView";
import { BuildingHoverCard, useHoverCardContext, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { entryThumbnail, uniqueBadge, type UniqueBadgeClasses } from "mods/entryArtwork";
import { stripRedundantNamePrefix, tileLabelLineBudget, wrapTileLabel } from "domain/tileLabel";
import { lineBudgetFromDrawn } from "domain/measuredFit";
import { sortedMetricFor } from "domain/sortedMetric";
import { useTextScale } from "mods/gameSettings";
import { useGuardedPlace } from "mods/useGuardedPlace";
import { useSettledMeasure } from "mods/useSettledMeasure";
import styles from "./buildingGrid.module.scss";
import { ActivePrefabId$, BuildingCatalogSortColumn$, AssetMenuTileSize$ } from "mods/bindings";

const UNIQUE_BADGE: UniqueBadgeClasses = { badge: styles.uniqueAsset, unique: styles.uniqueMark, alreadyBuilt: styles.alreadyBuilt };

interface BuildingGridProps {
  entries: BuildingCatalogEntry[];
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, rendered inside this grid's own scroll. */
  footer?: ReactNode;
  /**
   * False when this grid is one group among several. A scroll container per
   * group would give every heading its own scrollbar, so the caller wraps the
   * whole grouped result in one scroll instead.
   */
  standalone?: boolean;
}

/**
 * The name on a tile, shortened for drawing only — the tooltip and aria-label
 * carry the whole of it. The character budget is an estimate corrected from
 * what was drawn, and the correction only tightens, so it cannot spiral.
 */
const TileName = ({ label, budget }: { label: string; budget: number }) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  // A new name or a new estimate starts from the estimate again.
  useEffect(() => {
    setFit(null);
  }, [label, budget]);
  const effective = fit === null ? budget : Math.min(budget, fit);

  useSettledMeasure(boxRef, (box) => {
    const next = lineBudgetFromDrawn(effective, Array.from(box.children) as HTMLElement[]);
    if (next < effective) setFit(next);
  }, [label, effective]);

  return (
    <span ref={boxRef} className={styles.tileName}>
      {wrapTileLabel(label, effective).map((line, index) => (
        <span
          key={index}
          className={classNames(
            styles.tileNameLine,
            // A line wrapTileLabel already cut carries its own ellipsis, so
            // CSS must not add a second one — "Helico…De…" reads as corruption.
            line.includes("…") && styles.tileNameLineElided
          )}
        >
          {line}
        </span>
      ))}
    </span>
  );
};

export const BuildingGrid = ({ entries, onPlace, footer, standalone = true }: BuildingGridProps) => {
  // One card for every view mode, read once here rather than per tile: it is a
  // dozen live bindings, and a tile each would open hundreds of them to draw
  // one hover at a time. The tiles take its separators and state words too.
  const hoverCard = useHoverCardContext();
  // The figure the result is ordered by, drawn on the tile so a re-sort says
  // why the tiles moved. Null for Name and Category, which the tile shows.
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const tileSize = useValue(AssetMenuTileSize$);
  // The name line is fontSizeM; its character budget follows the text scale.
  const textScale = useTextScale();
  const activePrefabId = useValue(ActivePrefabId$);
  // Vanilla's own grid routes a locked click to a disabled sound, not a placement.
  const place = useGuardedPlace(onPlace);

  const tiles = (
    <div className={classNames(styles.tiles, styles.bodyTiles)}>
      {/* In page order, which every view shares; nothing is re-ranked here. */}
      {entries.map((entry) => (
        <BuildingTile
          key={`grid-${entry.id}`}
          entry={entry}
          armed={activePrefabId !== 0 && entry.id === activePrefabId}
          sortedMetric={sortedMetric}
          tileSize={tileSize}
          textScale={textScale}
          hoverCard={hoverCard}
          onPlace={place}
        />
      ))}
    </div>
  );

  if (!standalone) {
    return tiles;
  }

  return (
    <div className={styles.grid}>
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

interface BuildingTileProps {
  entry: BuildingCatalogEntry;
  /** Whether this tile's prefab is the armed one. ActivePrefabId is 0 when nothing is armed. */
  armed: boolean;
  sortedMetric: ReturnType<typeof sortedMetricFor>;
  tileSize: number;
  textScale: number;
  /** The hover card's context, whose separators and state words the tile draws with too. */
  hoverCard: HoverCardContext;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One tile. Memoised: an entry keeps its object while its content is the same (see
 * stableEntries), so growing the window draws, and measures the names of, only the
 * new tiles.
 */
const BuildingTile = memo(function BuildingTile({
  entry,
  armed,
  sortedMetric,
  tileSize,
  textScale,
  hoverCard,
  onPlace,
}: BuildingTileProps) {
  const label = entryLabel(entry);
  const stateWord = entryStateWord(entry, hoverCard.labels.lockedValue, hoverCard.labels.alreadyBuilt);
  const sortedText = sortedBadgeText(entry, sortedMetric, hoverCard.separators);

  return (
    <BuildingHoverCard entry={entry} context={hoverCard}>
      <Button
        className={classNames(
          styles.tile,
          sortedMetric !== null && styles.tileSorted,
          armed && styles.tileArmed
        )}
        style={{ width: `${tileSize}rem` }}
        variant="icon"
        // See the table row: this is how the scroll anchor finds the tile
        // again after placement rebuilds the asset menu.
        data-catalog-entry={entry.id}
        // Announced as well as drawn, for the same reason the locked state is.
        aria-current={armed ? "true" : undefined}
        onSelect={() => onPlace(entry)}
        // Locked is announced, not just drawn. The visual treatment is a
        // silhouette, which says nothing to a screen reader and little to
        // anyone whose thumbnail has not generated yet.
        aria-label={stateWord ? `${label} — ${stateWord}` : label}
        // Unplaceable either way, and announced as such rather than reading
        // as an ordinary tile that arms a placement the game refuses.
        aria-disabled={canPlace(entry) ? undefined : "true"}
        {...entryStateAttributes(entry)}
      >
        {/* The artwork and everything drawn ON it, in one box. Vanilla's tile
            IS its artwork; ours carries a label below, so anchoring the marks
            here rather than to the tile lets vanilla's insets transfer
            unchanged whatever height the label takes. */}
        <span className={styles.artwork}>
          {entryThumbnail(entry, styles.thumb)}
          {/* Always drawn, unlike vanilla: at this tile size a silhouette
              alone is not distinguishable from a thumbnail that has not
              rendered yet. A RASTER, because a masked vector is what this
              engine cannot draw — see hasVectorThumbnail. */}
          {isEntryLocked(entry) && (
            <img
              className={styles.lockGlyph}
              src="coui://betterbuildingmenu/LockRaster.png"
              alt=""
              aria-hidden="true"
            />
          )}
          {/* Independent of locked, which is how vanilla arranges it: the
              padlock answers "can I build it yet" and this answers "is there
              only one of these, and have I got it". A locked unique carries both. */}
          {uniqueBadge(entry, UNIQUE_BADGE)}
        </span>
        {/* One element per line rather than one that wraps: tileLabel.ts
            decides the break, where it is testable and the last line can be
            elided by the rule that keeps a distinguishing suffix. */}
        <TileName
          label={stripRedundantNamePrefix(label, {
            category: entry.categoryLabel ?? entry.category,
            subCategory: entry.subCategoryLabel ?? entry.subCategory,
            theme: entry.theme,
          })}
          budget={tileLabelLineBudget(tileSize, textScale)}
        />
        {sortedText !== null && <span className={styles.sortedMetric}>{sortedText}</span>}
      </Button>
    </BuildingHoverCard>
  );
});
