import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { FOCUS_DISABLED } from "cs2/input";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { memo, useState, type ReactNode } from "react";

import type { NumberSeparators } from "domain/assetMenuMetricFormat";
import type { AssetMenuMetric } from "domain/assetMenuLayout";
import { NO_SECTIONS } from "domain/bodyCells";
import { labelPlace, screenSlots, slotPosition, slotsHeight, TILE_NAME_LINE_MIN, type BodyGrid } from "domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection, SharedValue } from "domain/buildingCatalog";
import { entryStateWord, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { sortedMetricFor } from "domain/sortedMetric";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { tileLabelLineBudget } from "domain/tileLabel";
import { tileFacts } from "domain/tileNameLine";
import { tagRoom, tileTag } from "domain/tileTag";
import { useTextScale } from "domain/textScaleSetting";
import { ActivePrefabId$, AssetMenuTuning$, BuildingCatalogSortColumn$, SHIPPED_TUNING } from "mods/bindings";
import { useAssetMenuView } from "mods/useAssetMenuView";
import { BuildingHoverCard, useHoverCardContext, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { FittedName } from "./FittedName";
import { LabelPlate } from "./LabelPlate";
import styles from "./tilesBody.module.scss";
import { UniqueMark } from "./UniqueMark";
import { useBodyCells } from "./useBodyCells";
import { useNumberSeparators, useStateWords, type StateWords } from "./useBodyWords";

/** The share of the line under the tiles the name may take; the numbers after it take the rest. */
const NAME_SHARE = 0.6;

/** The name line's font at 100% text: tilesBody.module.scss's `.lineName`. */
const LINE_NAME_FONT = 11;

interface TileProps {
  entry: BuildingCatalogEntry;
  grid: BodyGrid;
  /** The slot the tile sits in, which the labels before it push on. */
  slot: number;
  armed: boolean;
  sortedMetric: AssetMenuMetric | null;
  /** The values the readout says once: a tag that would say one is left off. */
  said: readonly SharedValue[];
  textScale: number;
  separators: NumberSeparators;
  stateWords: StateWords;
  achievedMilestone: number;
  hoverCard: HoverCardContext;
  onPlace: (entry: BuildingCatalogEntry) => void;
  onPoint: (id: number | null) => void;
}

/**
 * One building as a picture tile, with a tag at its foot: its cost, or why a locked one waits, or under
 * a sort by a value that value. Its name is the line's under the tiles. The live check and the render
 * tests count what a body shows through the data-bbm markers.
 */
const Tile = memo(function Tile({ entry, grid, slot, armed, sortedMetric, said, textScale, separators, stateWords, achievedMilestone, hoverCard, onPlace, onPoint }: TileProps) {
  const name = entry.name || entry.prefabName;
  const locked = isEntryLocked(entry);
  const built = isEntryAlreadyBuilt(entry);
  const { left, top } = slotPosition(grid, slot);
  const tag = tileTag(entry, sortedMetric, separators, stateWords.locked, achievedMilestone, grid.cellWidth, textScale, said);
  const word = entryStateWord(entry, stateWords.locked, stateWords.built);
  // Inset 2 on every side; inline, as Tile size sizes it.
  const picture = { width: `${grid.cellWidth - 4}rem`, height: `${grid.cellHeight - 4}rem` };

  return (
    <BuildingHoverCard entry={entry} context={hoverCard}>
      <Button
        className={classNames(styles.tile, armed && styles.armed, (locked || built) && styles.unplaceable)}
        // Inline, over the game's Button and its own square: the slot is the tile's place and size.
        style={{ left: `${left}rem`, top: `${top}rem`, width: `${grid.cellWidth}rem`, height: `${grid.cellHeight}rem` }}
        variant="flat"
        focusKey={FOCUS_DISABLED}
        onSelect={() => onPlace(entry)}
        onMouseEnter={() => onPoint(entry.id)}
        onMouseLeave={() => onPoint(null)}
        aria-label={word ? `${name} — ${word}` : name}
        aria-disabled={locked || built ? "true" : undefined}
        data-catalog-entry={entry.id}
        data-bbm-item="true"
        // Always written, both ways: the silhouette rule keys off "false", as Cohtml rejects :not().
        data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
      >
        {/* The picture and its mark share a box, so the game's unique and already-built marks sit on the
            building, as 0.2.x's grid drew them. */}
        <span className={styles.artwork} style={picture}>
          <img
            className={styles.picture}
            src={lockedThumbnail(entry, locked || built)}
            onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
            style={picture}
            alt=""
            aria-hidden="true"
            data-bbm-pic="true"
          />
          <UniqueMark entry={entry} built={built} className={classNames(styles.mark, built ? styles.builtMark : styles.uniqueMark)} />
        </span>
        {/* A raster, because a masked vector is what this engine cannot draw. */}
        {locked && <img className={styles.lockGlyph} src="coui://betterbuildingmenu/LockRaster.png" alt="" aria-hidden="true" />}
        {tag.text !== "" && (
          // Bounded inline, as Tile size sizes the tile: a figure the tag cannot hold is cut with an ellipsis, never silently.
          <span className={classNames(styles.tag, tag.locked && styles.milestone)} style={{ maxWidth: `${tagRoom(grid.cellWidth)}rem` }} data-bbm-fact="true">
            {tag.text}
          </span>
        )}
      </Button>
    </BuildingHoverCard>
  );
});

export interface TilesBodyProps {
  entries: BuildingCatalogEntry[];
  grid: BodyGrid;
  /** The labels over the result, counted over the whole of it; none by default. */
  sections?: readonly CatalogSection[];
  /** Where the window starts in the result's order, which the sections' starts count from. */
  offset?: number;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, inside the scroll, below the last line. */
  footer?: ReactNode;
}

/**
 * The tiles: each building a picture tile, placed from its slot index, with the label plates over its
 * groups and its locked rows in tiles of their own; then under the tiles a line naming the tile pointed
 * at, else the armed one, with the numbers a tile does not show. The line drops where too little room is
 * left under the tiles, and by the Tile name line knob. See docs/design-notes.md, "The bodies".
 */
export const TilesBody = memo(function TilesBody({ entries, grid, sections = NO_SECTIONS, offset = 0, onPlace, footer }: TilesBodyProps) {
  const separators = useNumberSeparators();
  const stateWords = useStateWords();
  const textScale = useTextScale();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const armedId = useValue(ActivePrefabId$);
  const lineKnob = useValue(AssetMenuTuning$).tileNameLine ?? SHIPPED_TUNING.tileNameLine;
  const { cells, slots } = useBodyCells(entries, sections, grid.cols, offset);
  const said = useAssetMenuView((view) => view.said);
  const hoverCard = useHoverCardContext();
  // "MS n" only for a milestone ahead of the city: past it, only the development tree holds a building back.
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  // By id, so a tile that leaves the page under the pointer names nothing.
  const [pointedId, setPointedId] = useState<number | null>(null);
  const nameLine = lineKnob && grid.nameLine >= TILE_NAME_LINE_MIN;
  const named = nameLine
    ? entries.find((entry) => entry.id === pointedId) ?? entries.find((entry) => armedId !== 0 && entry.id === armedId) ?? null
    : null;
  // A screen of the tiles' own lines, so the line under them stays put as the tiles scroll.
  const tilesHeight = slotsHeight(grid, screenSlots(grid));

  return (
    <div className={styles.body} data-bbm-view="tiles">
      <div className={styles.window} style={nameLine ? { height: `${tilesHeight}rem` } : undefined}>
        <Scrollable className={styles.scroller} vertical trackVisibility="scrollable">
          <div className={styles.slots} style={{ height: `${slotsHeight(grid, slots)}rem` }}>
            {cells.map((cell) => cell.kind === "label" ? (
              // A tile's square holds the name over the count; a line of its own holds them side by side.
              <LabelPlate key={cell.section.id} section={cell.section} place={labelPlace(grid, cell.slot, cell.span)} stacked={cell.span === 1} />
            ) : (
              <Tile
                key={cell.entry.id}
                entry={cell.entry}
                grid={grid}
                slot={cell.slot}
                armed={armedId !== 0 && cell.entry.id === armedId}
                sortedMetric={sortedMetric}
                said={said}
                textScale={textScale}
                separators={separators}
                stateWords={stateWords}
                achievedMilestone={achievedMilestone}
                hoverCard={hoverCard}
                onPlace={onPlace}
                onPoint={setPointedId}
              />
            ))}
          </div>
          {footer}
        </Scrollable>
      </div>
      {nameLine && (
        <div className={styles.nameLine} style={{ height: `${grid.nameLine}rem` }}>
          {named !== null && (
            <>
              <FittedName
                className={styles.lineName}
                label={named.name || named.prefabName}
                budget={tileLabelLineBudget(grid.cellWidth * grid.cols * NAME_SHARE, textScale, LINE_NAME_FONT)}
                lines={1}
              />
              <span className={styles.lineFacts}>{tileFacts(named, separators)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});
