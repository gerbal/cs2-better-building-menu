import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { FOCUS_DISABLED } from "cs2/input";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { memo, useLayoutEffect, type ReactNode } from "react";

import enterMark from "images/enter.svg";
import type { NumberSeparators } from "domain/assetMenuMetricFormat";
import type { AssetMenuMetric } from "domain/assetMenuLayout";
import { setDrawnForm } from "domain/assetMenuViewStore";
import { NO_SECTIONS } from "domain/bodyCells";
import { labelPlace, slotPosition, slotsHeight, type BodyGrid } from "domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection, SharedValue } from "domain/buildingCatalog";
import { entryStateWord, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { oneLineNumber, plateNumbers } from "domain/listPlate";
import type { KeyKind } from "domain/rowNumbers";
import { sortedMetricFor } from "domain/sortedMetric";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { ActivePrefabId$, BuildingCatalogSortColumn$ } from "mods/bindings";
import { useAssetMenuView } from "mods/useAssetMenuView";
import { BuildingHoverCard, useHoverCardContext, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { LabelPlate } from "./LabelPlate";
import styles from "./listBody.module.scss";
import { UniqueMark } from "./UniqueMark";
import { UNIT_GLYPHS } from "./unitGlyphs";
import { useBodyCells, useNearField } from "./useBodyCells";
import { useNumberSeparators, useStateWords, type StateWords } from "./useBodyWords";

interface PlateProps {
  entry: BuildingCatalogEntry;
  grid: BodyGrid;
  /** The slot the plate sits in, which the labels before it push on. */
  slot: number;
  armed: boolean;
  enter: boolean;
  sortedMetric: AssetMenuMetric | null;
  /** The kind of number the view's rows show second. */
  keyKind: KeyKind;
  /** The values the readout says once, which this plate leaves blank where it holds them. */
  said: readonly SharedValue[];
  separators: NumberSeparators;
  stateWords: StateWords;
  achievedMilestone: number;
  hoverCard: HoverCardContext;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One building on a plate: its picture, its name on its lines, and its numbers; "↵" beside them on
 * Enter's target. The live check and the render tests count what a body shows through the data-bbm
 * markers.
 */
const Plate = memo(function Plate({ entry, grid, slot, armed, enter, sortedMetric, keyKind, said, separators, stateWords, achievedMilestone, hoverCard, onPlace }: PlateProps) {
  const name = entry.name || entry.prefabName;
  const both = plateNumbers(entry, sortedMetric, separators, stateWords.locked, achievedMilestone, keyKind, said);
  // A one-line plate is one number tall: two would be cut at its top and foot.
  const numbers = grid.form === "plate1" ? oneLineNumber(entry, both, sortedMetric, said) : both;
  const { left, top } = slotPosition(grid, slot);
  const word = entryStateWord(entry, stateWords.locked, stateWords.built);
  const locked = isEntryLocked(entry);
  const built = isEntryAlreadyBuilt(entry);
  const big = grid.form === "big";
  // A big plate's picture is as tall as the plate allows, inline; the other forms' is the stylesheet's.
  const picture = big ? { width: `${grid.picture}rem`, height: `${grid.picture}rem` } : undefined;
  const words = (
    <>
      {/* Plain text, no spans: Cohtml drops the space after an inline element, and never breaks at a
          hyphen. */}
      <p className={classNames(styles.name, grid.nameLines === 1 && styles.oneLine)} data-bbm-name={name.length} {...{ cohinline: "" }}>
        {name}
      </p>
      <div className={styles.numbers} data-bbm-fact="true">
        {/* The mark and the number each in their own box: no bare text beside an element in a flex
            row. */}
        <span className={styles.firstLine}>
          {enter && <img className={styles.enterMark} style={{ maskImage: `url(${enterMark})` }} alt="" aria-hidden="true" />}
          {/* A one-line plate's key number, where the readout said the cost, keeps its glyph. */}
          {numbers.second === null && numbers.glyph !== null && (
            <img className={styles.unitGlyph} style={{ maskImage: `url(${UNIT_GLYPHS[numbers.glyph]})` }} alt="" aria-hidden="true" />
          )}
          <span className={classNames(styles.first, numbers.locked && styles.milestone, numbers.firstIsKey && styles.keyNumber)}>{numbers.first}</span>
        </span>
        {numbers.second !== null && (
          // The glyph beside the number, never in its run: the readout names the unit it stands for.
          <span className={styles.secondLine}>
            {numbers.glyph !== null && (
              <img className={styles.unitGlyph} style={{ maskImage: `url(${UNIT_GLYPHS[numbers.glyph]})` }} alt="" aria-hidden="true" />
            )}
            <span className={styles.second}>{numbers.second}</span>
          </span>
        )}
      </div>
    </>
  );

  return (
    <BuildingHoverCard entry={entry} context={hoverCard}>
      <Button
        className={classNames(styles.plate, (grid.form === "plate1" || grid.form === "plateWhole") && styles.largeText, big && styles.big, armed && styles.armed, locked && styles.locked, built && styles.built)}
        // Inline, over the game's Button and its own square: the slot is the plate's place and size.
        style={{ left: `${left}rem`, top: `${top}rem`, width: `${grid.cellWidth}rem`, height: `${grid.cellHeight}rem` }}
        variant="flat"
        focusKey={FOCUS_DISABLED}
        onSelect={() => onPlace(entry)}
        aria-label={word ? `${name} — ${word}` : name}
        aria-disabled={locked || built ? "true" : undefined}
        data-catalog-entry={entry.id}
        data-bbm-item="true"
      >
        {/* The picture and its mark share a box, so the game's unique and already-built marks sit on the
            building, as 0.2.x's list drew them. */}
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
        {/* A big plate stacks its name over its numbers beside the picture; the others line all three
            up. */}
        {big ? <span className={styles.bigWords}>{words}</span> : words}
      </Button>
    </BuildingHoverCard>
  );
});

export interface ListBodyProps {
  entries: BuildingCatalogEntry[];
  grid: BodyGrid;
  /** The labels over the result, counted over the whole of it; none by default. */
  sections?: readonly CatalogSection[];
  /** Where the window starts in the result's order, which the sections' starts count from. */
  offset?: number;
  /**
   * Whether the page answers a typed query: its results fill nearest the field at a wider step, by
   * the Search flow knob.
   */
  searching?: boolean;
  /** The kind of number the view's rows show second, from the page's facts; the capacity by default. */
  keyKind?: KeyKind;
  /** Enter's target, while the page answers the query in the box; null otherwise. */
  enterId: number | null;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, inside the scroll, below the last line. */
  footer?: ReactNode;
}

/**
 * The list: each building on a plate, placed from its slot index, in the page's order, with the label
 * plates over its groups and its locked rows in slots of their own. The game's Scrollable draws the track
 * at the box's right edge, inside its margin. See docs/design-notes.md, "The bodies".
 */
export const ListBody = memo(function ListBody({ entries, grid, sections = NO_SECTIONS, offset = 0, searching = false, keyKind = "capacity", enterId, onPlace, footer }: ListBodyProps) {
  const separators = useNumberSeparators();
  const stateWords = useStateWords();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const armedId = useValue(ActivePrefabId$);
  const hoverCard = useHoverCardContext();
  // "MS n" only for a milestone ahead of the city: past it, only the development tree holds a building back.
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  const flow = useNearField(searching, grid.firstCols, grid.lines);
  // What the readout says once, which the rows that hold it leave blank. See docs/design-notes.md, "Numbers said once".
  const said = useAssetMenuView((view) => view.said);
  // The form it draws, which decides the numbers the readout may say once; none once it goes. Before
  // the paint, as the readout's own publish.
  const drawnForm = grid.form === "tile" ? null : grid.form;
  useLayoutEffect(() => setDrawnForm(drawnForm), [drawnForm]);
  useLayoutEffect(() => () => setDrawnForm(null), []);
  const { cells, slots } = useBodyCells(entries, sections, grid.cols, offset, flow);

  return (
    <div className={styles.body} data-bbm-view="list">
      <Scrollable className={styles.scroller} vertical trackVisibility="scrollable">
        <div className={styles.slots} style={{ height: `${slotsHeight(grid, slots)}rem` }}>
          {cells.map((cell) => cell.kind === "label" ? (
            <LabelPlate key={cell.section.id} section={cell.section} place={labelPlace(grid, cell.slot, cell.span)} stacked={false} />
          ) : (
            <Plate
              key={cell.entry.id}
              entry={cell.entry}
              grid={grid}
              slot={cell.slot}
              armed={cell.entry.id === armedId}
              enter={cell.entry.id === enterId}
              sortedMetric={sortedMetric}
              keyKind={keyKind}
              said={said}
              separators={separators}
              stateWords={stateWords}
              achievedMilestone={achievedMilestone}
              hoverCard={hoverCard}
              onPlace={onPlace}
            />
          ))}
        </div>
        {footer}
      </Scrollable>
    </div>
  );
});
