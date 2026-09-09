import { bindValue, useValue } from "cs2/api";
import { Button, Scrollable } from "cs2/ui";
import { type ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { canPlace, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { topSearchResult } from "domain/buildingSearchRank";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { stripRedundantNamePrefix, tileLabelLineBudget, wrapTileLabel } from "domain/tileLabel";
import { reduceBudgetToFit } from "domain/measuredFit";
import { sortedMetricFor, sortedMetricValue } from "domain/sortedMetric";
import { formatBuildingMetric, getNumberSeparators } from "domain/buildingLensMetricFormat";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { useUnitSystem } from "domain/unitSettings";
import { useTextScale } from "domain/textScaleSetting";
import mod from "../../../mod.json";
import styles from "./buildingGrid.module.scss";

const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn", "Name");
const TileSize$ = bindValue<number>(mod.id, "BuildingLensTileSize", 72);
/**
 * The prefab the game currently has armed.
 *
 * The legacy grid has always drawn this (PrefabSelection.tsx passes
 * `selected={prefab.id == ActivePrefabId}`); the lens grid never did, so after
 * picking a building nothing on screen said which one was about to be placed.
 */
const ActivePrefabId$ = bindValue<number>(mod.id, "ActivePrefabId", 0);

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
   */
  standalone?: boolean;
}

/**
 * Thumbnails first: the fast path back to the map.
 *
 * The table asks you to read; this asks you to recognise. The order is the
 * backend's — the same one the table shows, relevance first while a search is
 * active — so a building keeps its position between visits and becomes a
 * pointer gesture rather than a lookup. The numbers we project are not gone —
 * they moved to the hover card, which costs nothing until you actually want
 * them.
 */
/**
 * The name on a tile, shortened for drawing only — the tooltip and the
 * Button's aria-label still carry the whole of it.
 *
 * One element per line rather than one element that wraps: the wrapping is
 * decided in tileLabel.ts, where it is testable and where the last line can
 * be elided by the rule that keeps a distinguishing suffix. The character
 * budget is an estimate, and it is corrected from what was drawn: above
 * 1.33px per rem text renders 2–3 % wider relative to rem than at 1080p, and
 * a budget that exactly filled its line at 720p spilled a few pixels at
 * 1440p and on ultrawide. The correction only ever tightens — see
 * domain/measuredFit.ts — so measure → shorten → measure cannot spiral.
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
      let next = effective;
      for (const line of Array.from(box.children) as HTMLElement[]) {
        next = Math.min(next, reduceBudgetToFit(effective, line.clientWidth, line.scrollWidth));
      }
      if (next < effective) setFit(next);
    };
    // Watch the box rather than guess when it settles — Cohtml relayouts a
    // frame after a view change (see GroupedResults). Fallback: the second
    // frame, which is where the measured relayout landed.
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(measure);
      observer.observe(box);
      measure();
      return () => observer.disconnect();
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(measure);
    });
    return () => {
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
  const separators = getNumberSeparators(translate, useUnitSystem());
  // Already in Locale.json — an orphaned key with no consumer until now.
  const lockedLabel = translate("Tooltip.LABEL[BetterBuildingMenu.Locked]", "Locked") ?? "Locked";
  const builtLabel =
    translate("Tooltip.LABEL[BetterBuildingMenu.AlreadyBuilt]", "Already built") ?? "Already built";
  const tileSize = useValue(TileSize$);
  // The name line is fontSizeM; its character budget follows the text scale.
  const textScale = useTextScale();
  const activePrefabId = useValue(ActivePrefabId$);
  // The page arrives in the order every view shows: grouped, then by
  // relevance while a search is active, then by the chosen sort. The grid
  // used to re-rank (and silently drop) entries here; see
  // BuildingCatalogRelevance.cs.
  const ordered = entries;

  // Enter arms the best match, so a search can be completed without leaving
  // the keyboard. Bound on the document because the search field belongs to
  // the menu's own header, not to this component.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;

      const top = topSearchResult(ordered, searchText ?? "");
      if (!top) return;

      onPlace(top);
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [ordered, searchText, onPlace]);

  const place = (entry: BuildingCatalogEntry) => {
    // Vanilla refuses the same selection rather than hiding the tile
    // (ToolbarUISystem.cs:924), and its own grid routes a locked click to a
    // disabled sound instead of a placement.
    if (!canPlace(entry)) return;

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
          // again after placement rebuilds the panel.
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
          // Unplaceable either way, and announced as such. It used to read as
          // an ordinary tile, so clicking armed a placement the game refused.
          aria-disabled={locked || alreadyBuilt ? "true" : undefined}
          data-locked={locked ? "true" : undefined}
          data-already-built={alreadyBuilt ? "true" : undefined}
          /* Always written, both ways: the silhouette rule keys off "false"
             rather than off :not(), which Cohtml's selector engine rejects. */
          data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
        >
          {/* The artwork and everything drawn ON the artwork, in one box.
              Vanilla positions both marks against its tile because its tile IS
              the artwork — a 68rem image in a 72rem item, centred, with the name
              in a tooltip rather than under it. Ours has a 32rem label below the
              thumbnail, so "inset from the tile" and "inset from the artwork"
              stopped being the same thing: the badge drifted down toward the
              label and sat left of a thumbnail that is centred in a wider tile.

              Anchoring to this box instead makes vanilla's own numbers transfer
              unchanged, and retires the `bottom: 34rem` on the padlock, which
              was the label's height written into a coordinate — correct only
              while the label stays exactly two lines. */}
          <span className={styles.artwork}>
            {entry.thumbnail
              ? <img
                  className={styles.thumb}
                  src={lockedThumbnail(entry, locked || alreadyBuilt)}
                  onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                  alt=""
                />
              : null}
            {/* Vanilla draws this only when the legacy interface is on, so on a
                default install its entire locked signal is the black silhouette.
                We draw it always: at this tile size a silhouette alone is not
                distinguishable from a thumbnail that has not rendered yet.

                A RASTER image, not the masked span this used to be. The mask was
                over Media/Glyphs/Lock.svg, and a vector under a compositing
                effect is what this engine cannot draw — see hasVectorThumbnail.
                Measured: with the thumbnail filter off, 35 masked padlocks still
                flickered on their own. LockRaster.png is that same glyph
                rasterised and tinted to the #FFCB00 the mask was rendering, so
                the appearance is unchanged and the surface is gone.

                The cost is the theme token: a baked colour cannot follow
                --lockedColor the way background-color under a mask did. Worth
                it, and revisit if the game ever ships a raster glyph set. */}
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
          {/* Shortened for drawing only. The tooltip above and the aria-label on
              the Button both still carry the whole name.

              One element per line rather than one element that wraps: the
              wrapping is decided in tileLabel.ts, where it is testable and
              where the last line can be elided by the same rule that keeps a
              distinguishing suffix. Leaving it to the engine would put the
              break wherever 64px happened to fall and clip the overflow
              unmarked. */}
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
      {ordered.map((entry) => tile(entry, `grid-${entry.id}`))}
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
