import { useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { type ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { canPlace, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { stripRedundantNamePrefix, tileLabelLineBudget, wrapTileLabel } from "domain/tileLabel";
import { lineBudgetFromDrawn } from "domain/measuredFit";
import { sortedMetricFor, sortedMetricValue } from "domain/sortedMetric";
import { formatBuildingMetric, getNumberSeparators } from "domain/assetMenuMetricFormat";
import { useUnitSystem } from "domain/unitSettings";
import { useTextScale } from "domain/textScaleSetting";
import styles from "./buildingGrid.module.scss";
import { ActivePrefabId$, BuildingCatalogSortColumn$, AssetMenuTileSize$ } from "mods/bindings";

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

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const next = lineBudgetFromDrawn(effective, Array.from(box.children) as HTMLElement[]);
      if (next < effective) setFit(next);
    };
    // Never in the tick of the render: Cohtml reports the PREVIOUS text's
    // scrollWidth for a line whose text just changed, and 0 for one it has not
    // laid out. Every read waits two frames, the observer's included.
    let outer = 0;
    let inner = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(measure);
      });
    };
    // Watch the box rather than guess when it settles — Cohtml relayouts a
    // frame after a view change; the box's own resize is the signal.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(box);
    scheduleMeasure();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
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
  const { translate } = useLocalization();
  // One card for every view mode, read once here rather than per tile: it is a
  // dozen live bindings, and a tile each would open hundreds of them to draw
  // one hover at a time.
  const hoverCard = useHoverCardContext();
  // The figure the result is ordered by, drawn on the tile so a re-sort says
  // why the tiles moved. Null for Name and Category, which the tile shows.
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const separators = getNumberSeparators(translate, useUnitSystem());
  const lockedLabel = translate("Tooltip.LABEL[BetterBuildingMenu.Locked]", "Locked") ?? "Locked";
  const builtLabel =
    translate("Tooltip.LABEL[BetterBuildingMenu.AlreadyBuilt]", "Already built") ?? "Already built";
  const tileSize = useValue(AssetMenuTileSize$);
  // The name line is fontSizeM; its character budget follows the text scale.
  const textScale = useTextScale();
  const activePrefabId = useValue(ActivePrefabId$);
  const place = (entry: BuildingCatalogEntry) => {
    // Vanilla refuses the same selection rather than hiding the tile: its own
    // grid routes a locked click to a disabled sound, not a placement.
    if (!canPlace(entry)) return;

    onPlace(entry);
  };

  /**
   * The sorted figure, or nothing. `lot` prints the pair, because a lone "6"
   * reads as the whole lot; a metric the entry never carried draws nothing at
   * all, since the badge exists to explain an order and a dash explains none.
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
    // Independent of locked, which is how vanilla arranges it: the padlock
    // answers "can I build it yet" and this answers "is there only one of
    // these, and have I got it". A locked unique carries both marks.
    const alreadyBuilt = isEntryAlreadyBuilt(entry);
    const unique = entry.isUnique === true;
    // Strict equality against a real id: ActivePrefabId is 0 when nothing is
    // armed, and an entry id of 0 would otherwise light every tile.
    const armed = activePrefabId !== 0 && entry.id === activePrefabId;

    return (
      <BuildingHoverCard key={key} entry={entry} context={hoverCard}>
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
          onSelect={() => place(entry)}
          // Locked is announced, not just drawn. The visual treatment is a
          // silhouette, which says nothing to a screen reader and little to
          // anyone whose thumbnail has not generated yet.
          aria-label={
            locked
              ? `${label} — ${lockedLabel}`
              : alreadyBuilt ? `${label} — ${builtLabel}` : label
          }
          // Unplaceable either way, and announced as such rather than reading
          // as an ordinary tile that arms a placement the game refuses.
          aria-disabled={locked || alreadyBuilt ? "true" : undefined}
          data-locked={locked ? "true" : undefined}
          data-already-built={alreadyBuilt ? "true" : undefined}
          /* Always written, both ways: the silhouette rule keys off "false"
             rather than off :not(), which Cohtml's selector engine rejects. */
          data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
        >
          {/* The artwork and everything drawn ON it, in one box. Vanilla's tile
              IS its artwork; ours carries a label below, so anchoring the marks
              here rather than to the tile lets vanilla's insets transfer
              unchanged whatever height the label takes. */}
          <span className={styles.artwork}>
            {entry.thumbnail
              ? <img
                  className={styles.thumb}
                  src={lockedThumbnail(entry, locked || alreadyBuilt)}
                  onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                  alt=""
                />
              : null}
            {/* Always drawn, unlike vanilla: at this tile size a silhouette
                alone is not distinguishable from a thumbnail that has not
                rendered yet. A RASTER, because a masked vector is what this
                engine cannot draw — see hasVectorThumbnail. */}
            {locked && (
              <img
                className={styles.lockGlyph}
                src="coui://betterbuildingmenu/Icons/Standard/LockRaster.png"
                alt=""
                aria-hidden="true"
              />
            )}
            {/* Vanilla's own icons, and its own two-state rule: every unique is
                badged, with a different symbol once the city has one. An <img>
                rather than a masked glyph because these are full-colour icons
                the game ships for exactly this. */}
            {unique && (
              <img
                className={classNames(styles.uniqueAsset, alreadyBuilt ? styles.alreadyBuilt : styles.uniqueMark)}
                src={alreadyBuilt ? "Media/Game/Icons/AlreadyBuilt.svg" : "Media/Game/Icons/Unique.svg"}
                alt=""
                aria-hidden="true"
              />
            )}
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
          {sortedBadge(entry)}
        </Button>
      </BuildingHoverCard>
    );
  };

  const tiles = (
    <div className={classNames(styles.tiles, styles.bodyTiles)}>
      {/* In page order, which every view shares; nothing is re-ranked here. */}
      {entries.map((entry) => tile(entry, `grid-${entry.id}`))}
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
