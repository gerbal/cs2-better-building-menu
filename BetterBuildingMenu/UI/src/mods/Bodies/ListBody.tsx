import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { FOCUS_DISABLED } from "cs2/input";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { memo, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import enterMark from "images/enter.svg";
import type { NumberSeparators } from "domain/assetMenuMetricFormat";
import type { AssetMenuMetric } from "domain/assetMenuLayout";
import { setDrawnForm } from "domain/assetMenuViewStore";
import { NO_SECTIONS } from "domain/bodyCells";
import { labelPlace, slotPosition, slotsHeight, type BodyGrid } from "domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection, SharedValue } from "domain/buildingCatalog";
import { entryStateWord, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { drawnPlateNumbers, NAME_FONT, plateNameRoom } from "domain/listPlate";
import { wordsApart, type ApartHints } from "domain/platesApart";
import type { KeyKind, UnitMarks } from "domain/rowNumbers";
import { sortedMetricFor } from "domain/sortedMetric";
import { useTextScale } from "domain/textScaleSetting";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { ActivePrefabId$, AssetMenuTuning$, BuildingCatalogSortColumn$, SHIPPED_TUNING } from "mods/bindings";
import { useAssetMenuView } from "mods/useAssetMenuView";
import { clearPointed } from "domain/assetMenuViewStore";
import { pointAt, type CellEnter } from "mods/HoverCard/pointing";
import { LabelPlate } from "./LabelPlate";
import styles from "./listBody.module.scss";
import { PlannedName } from "./PlannedName";
import { UniqueMark } from "./UniqueMark";
import { UNIT_GLYPHS } from "./unitGlyphs";
import { useBodyCells, useNearField } from "./useBodyCells";
import { useNumberSeparators, useStateWords, useUnitMarks, type StateWords } from "./useBodyWords";
import { slotIsNear, useNearLines } from "./useNearLines";

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
  /** How the look marks the key number's unit. */
  marks: UnitMarks;
  /** The query the page answers, whose words the name keeps; "" without one. */
  typed: string;
  /** Whether the typed words draw dimmed. */
  dim: boolean;
  textScale: number;
  separators: NumberSeparators;
  stateWords: StateWords;
  achievedMilestone: number;
  /** What the name is planned with beyond its distinguishing word, where it drew as another plate. */
  apart?: ApartHints;
  /** Whether the plate is on or near the screen, its name planned; away from it, sketched. */
  near: boolean;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One building on a plate: its picture, its name on its lines, and its numbers; "↵" beside them on
 * Enter's target. The live check and the render tests count what a body shows through the data-bbm
 * markers.
 */
const Plate = memo(function Plate({ entry, grid, slot, armed, enter, sortedMetric, keyKind, said, marks, typed, dim, textScale, separators, stateWords, achievedMilestone, apart, near, onPlace }: PlateProps) {
  const name = entry.name || entry.prefabName;
  const numbers = drawnPlateNumbers(entry, grid, sortedMetric, separators, stateWords.locked, achievedMilestone, keyKind, said, marks);
  const { left, top } = slotPosition(grid, slot);
  const word = entryStateWord(entry, stateWords.locked, stateWords.built);
  // A cell that goes from under the pointer sends no leave: it takes its own building away as it goes.
  useEffect(() => () => clearPointed(entry.id), [entry.id]);
  const locked = isEntryLocked(entry);
  const built = isEntryAlreadyBuilt(entry);
  const big = grid.form === "big";
  // A big plate's picture is as tall as the plate allows, inline; the other forms' is the stylesheet's.
  const picture = big ? { width: `${grid.picture}rem`, height: `${grid.picture}rem` } : undefined;
  const words = (
    <>
      {/* Planned over its lines, each a box of its own: Cohtml never breaks at a hyphen, and the
          planner keeps what tells the name apart. */}
      <PlannedName
        className={styles.name}
        name={name}
        width={plateNameRoom(grid, numbers, enter, textScale)}
        lines={grid.nameLines}
        font={NAME_FONT * textScale}
        distinct={entry.distinctWord ?? ""}
        apart={apart}
        typed={typed}
        dim={dim}
        near={near}
      />
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
    <Button
      className={classNames(styles.plate, (grid.form === "plate1" || grid.form === "plateWhole") && styles.largeText, big && styles.big, armed && styles.armed, locked && styles.locked, built && styles.built)}
      // Inline, over the game's Button and its own square: the slot is the plate's place and size.
      style={{ left: `${left}rem`, top: `${top}rem`, width: `${grid.cellWidth}rem`, height: `${grid.cellHeight}rem` }}
      variant="flat"
      focusKey={FOCUS_DISABLED}
      onSelect={() => onPlace(entry)}
      onMouseEnter={(event: CellEnter) => pointAt(entry, event)}
      onMouseLeave={() => clearPointed(entry.id)}
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
  );
});

/** No plate planned beyond its own distinguishing word. */
const NO_HINTS: ReadonlyMap<number, ApartHints> = new Map();

export interface ListBodyProps {
  entries: BuildingCatalogEntry[];
  grid: BodyGrid;
  /** The labels over the result, counted over the whole of it; none by default. */
  sections?: readonly CatalogSection[];
  /** Where the window starts in the result's order, which the sections' starts count from. */
  offset?: number;
  /**
   * The query the page answers, "" without one: its results fill nearest the field at a wider step, by
   * the Search flow knob, and each name keeps the words typed. The page's own query, not the box's, so
   * the last query's rows keep their places until the page answers.
   */
  typed?: string;
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
export const ListBody = memo(function ListBody({ entries, grid, sections = NO_SECTIONS, offset = 0, typed = "", keyKind = "capacity", enterId, onPlace, footer }: ListBodyProps) {
  const separators = useNumberSeparators();
  const stateWords = useStateWords();
  const marks = useUnitMarks();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const armedId = useValue(ActivePrefabId$);
  // "MS n" only for a milestone ahead of the city: past it, only the development tree holds a building back.
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  const textScale = useTextScale();
  const dim = useValue(AssetMenuTuning$).dimTypedWord ?? SHIPPED_TUNING.dimTypedWord;
  const flow = useNearField(typed.trim() !== "", grid.firstCols, grid.lines);
  // What the readout says once, which the rows that hold it leave blank. See docs/design-notes.md, "Numbers said once".
  const said = useAssetMenuView((view) => view.said);
  // The form it draws, which decides the numbers the readout may say once; none once it goes. Before
  // the paint, as the readout's own publish.
  const drawnForm = grid.form === "tile" || grid.form === "icon" ? null : grid.form;
  useLayoutEffect(() => setDrawnForm(drawnForm), [drawnForm]);
  useLayoutEffect(() => () => setDrawnForm(null), []);
  const { cells, slots } = useBodyCells(entries, sections, grid.cols, offset, flow);
  // Only the plates on or near the screen plan their names; the rest are sketched until they come near.
  const { body, near } = useNearLines(grid, entries);
  const { from, to } = near;
  // Those plates as the page pass reads them, each in its estimate's room as its plate first plans it, so
  // the pass plans again only the few drawn alike.
  const nearPlates = useMemo(() => cells.flatMap((cell) => (cell.kind === "label" || !slotIsNear({ from, to }, grid.cols, cell.slot) ? [] : [{
    id: cell.entry.id,
    name: cell.entry.name || cell.entry.prefabName,
    distinct: cell.entry.distinctWord ?? "",
    room: {
      width: plateNameRoom(grid, drawnPlateNumbers(cell.entry, grid, sortedMetric, separators, stateWords.locked, achievedMilestone, keyKind, said, marks), cell.entry.id === enterId, textScale),
      lines: grid.nameLines,
      font: NAME_FONT * textScale,
    },
  }])), [cells, from, to, grid, sortedMetric, separators, stateWords.locked, achievedMilestone, keyKind, said, marks, enterId, textScale]);
  // The plates drawn alike told apart over those near the screen, after the paint: a keystroke draws each
  // name's own cut at once, and the few drawn alike are planned again a frame later. Hints worked out for
  // another search are none. See docs/design-notes.md, "Names".
  const [told, setTold] = useState<{ typed: string; hints: ReadonlyMap<number, ApartHints> }>({ typed, hints: NO_HINTS });
  useEffect(() => {
    const hints = wordsApart(nearPlates, typed.split(/\s+/));
    setTold((last) => (last.typed === typed && last.hints === hints ? last : { typed, hints }));
  }, [nearPlates, typed]);
  const apart = told.typed === typed ? told.hints : NO_HINTS;

  return (
    <div ref={body} className={styles.body} data-bbm-view="list">
      <Scrollable className={styles.scroller} vertical trackVisibility="scrollable">
        <div className={styles.slots} style={{ height: `${slotsHeight(grid, slots)}rem` }}>
          {cells.map((cell) => cell.kind === "label" ? (
            <LabelPlate key={cell.section.id} section={cell.section} place={labelPlace(grid, cell.slot, cell.span)} stacked={false} />
          ) : (
            // A plate far from the screen is only sketched, so it takes no hints: one going from the screen
            // draws once, not again when the page pass leaves it out.
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
              marks={marks}
              typed={typed}
              dim={dim}
              textScale={textScale}
              separators={separators}
              stateWords={stateWords}
              achievedMilestone={achievedMilestone}
              apart={slotIsNear(near, grid.cols, cell.slot) ? apart.get(cell.entry.id) : undefined}
              near={slotIsNear(near, grid.cols, cell.slot)}
              onPlace={onPlace}
            />
          ))}
        </div>
        {footer}
      </Scrollable>
    </div>
  );
});
