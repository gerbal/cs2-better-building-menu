import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { FOCUS_DISABLED } from "cs2/input";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { memo, useEffect, useMemo, type ReactNode } from "react";

import { NO_SECTIONS } from "domain/bodyCells";
import { labelPlace, labelSlots, slotPosition, slotsHeight, type BodyGrid } from "domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "domain/buildingCatalog";
import { entryStateWord, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedFact, lockedThumbnail } from "domain/buildingLockState";
import { familyTones, pillText } from "domain/iconFamilies";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { useTextScale } from "domain/textScaleSetting";
import { ActivePrefabId$ } from "mods/bindings";
import { clearPointed } from "domain/assetMenuViewStore";
import { pointAt } from "mods/HoverCard/pointing";
import styles from "./iconsBody.module.scss";
import { LabelPlate } from "./LabelPlate";
import { PlannedName } from "./PlannedName";
import { UniqueMark } from "./UniqueMark";
import { useBodyCells } from "./useBodyCells";
import { useStateWords, type StateWords } from "./useBodyWords";

/** The names' font in the icons with names at 100% text: iconsBody.module.scss's `.nameBand`. */
const NAME_FONT = 10;

/** The room a name keeps inside its icon, both sides together: the band's inset and padding. */
const NAME_INSET = 4;

interface IconProps {
  entry: BuildingCatalogEntry;
  grid: BodyGrid;
  /** The slot the icon sits in, which the labels before it push on. */
  slot: number;
  armed: boolean;
  /** Its plate's tone, 1 for the other: the tones alternate with each family run. */
  tone: number;
  /** Whether it draws its name under its picture, the developer's icons with names. */
  named: boolean;
  textScale: number;
  stateWords: StateWords;
  achievedMilestone: number;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One building as its picture alone on a plate: a family member's varying word on a pill at its foot; a
 * locked one dark, its lock over why it waits. Its name and numbers are the hover card's. The live check
 * and the render tests count what a body shows through the data-bbm markers.
 */
const Icon = memo(function Icon({ entry, grid, slot, armed, tone, named, textScale, stateWords, achievedMilestone, onPlace }: IconProps) {
  const name = entry.name || entry.prefabName;
  const locked = isEntryLocked(entry);
  const built = isEntryAlreadyBuilt(entry);
  const { left, top } = slotPosition(grid, slot);
  const word = entryStateWord(entry, stateWords.locked, stateWords.built);
  // A cell that goes from under the pointer sends no leave: it takes its own building away as it goes.
  useEffect(() => () => clearPointed(entry.id), [entry.id]);
  const pill = named ? "" : pillText(entry, grid.cellWidth, textScale);
  // Inset a rem on every side; inline, as Icon size sizes it.
  const picture = { width: `${grid.picture}rem`, height: `${grid.picture}rem` };

  return (
    <Button
      className={classNames(styles.icon, tone === 1 && styles.alt, armed && styles.armed, (locked || built) && styles.unplaceable)}
      // Inline, over the game's Button and its own square: the slot is the icon's place and size.
      style={{ left: `${left}rem`, top: `${top}rem`, width: `${grid.cellWidth}rem`, height: `${grid.cellHeight}rem` }}
      variant="flat"
      focusKey={FOCUS_DISABLED}
      onSelect={() => onPlace(entry)}
      onMouseEnter={(event: { currentTarget: Element }) => pointAt(entry, event.currentTarget)}
      onMouseLeave={() => clearPointed(entry.id)}
      aria-label={word ? `${name} — ${word}` : name}
      aria-disabled={locked || built ? "true" : undefined}
      data-catalog-entry={entry.id}
      data-bbm-item="true"
      // Always written, both ways: the silhouette rule keys off "false", as Cohtml rejects :not().
      data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
    >
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
      {locked && (
        <span className={classNames(styles.locked, named && styles.lockedRow)}>
          {/* A raster, because a masked vector is what this engine cannot draw. */}
          <img className={styles.lockGlyph} src="coui://betterbuildingmenu/LockRaster.png" alt="" aria-hidden="true" />
          <span className={styles.milestone} data-bbm-fact="true">{lockedFact(entry, stateWords.locked, achievedMilestone)}</span>
        </span>
      )}
      {pill !== "" && (
        <span className={styles.pill}>
          <span className={styles.pillWord} data-bbm-pill="true">{pill}</span>
        </span>
      )}
      {named && (
        <span className={styles.nameBand}>
          <PlannedName name={name} width={grid.cellWidth - NAME_INSET} lines={2} font={NAME_FONT * textScale} distinct={entry.distinctWord ?? ""} />
        </span>
      )}
    </Button>
  );
});

export interface IconsBodyProps {
  entries: BuildingCatalogEntry[];
  grid: BodyGrid;
  /** The labels over the result, counted over the whole of it; none by default. */
  sections?: readonly CatalogSection[];
  /** Where the window starts in the result's order, which the sections' starts count from. */
  offset?: number;
  /** Whether each icon draws its name under its picture: the developer's icons with names. */
  named?: boolean;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, inside the scroll, below the last line. */
  footer?: ReactNode;
}

/**
 * The icons: each building its picture on a plate, placed from its slot index, three lines in the game's
 * own body, a wider box adding columns; the label plates over its groups each two icons wide, moved to
 * the next line rather than split. Names are the hover card's. See docs/design-notes.md, "The icons".
 */
export const IconsBody = memo(function IconsBody({ entries, grid, sections = NO_SECTIONS, offset = 0, named = false, onPlace, footer }: IconsBodyProps) {
  const stateWords = useStateWords();
  const textScale = useTextScale();
  const armedId = useValue(ActivePrefabId$);
  const span = labelSlots(grid);
  const { cells, slots } = useBodyCells(entries, sections, grid.cols, offset, undefined, span);
  const tones = useMemo(() => familyTones(entries), [entries]);
  // "MS n" only for a milestone ahead of the city: past it, only the development tree holds a building back.
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;

  return (
    <div className={styles.body} data-bbm-view="icons">
      <Scrollable className={styles.scroller} vertical trackVisibility="scrollable">
        <div className={styles.slots} style={{ height: `${slotsHeight(grid, slots)}rem` }}>
          {cells.map((cell) => cell.kind === "label" ? (
            // Two icons wide: the name over the count, as in a tile's square.
            <LabelPlate key={cell.section.id} section={cell.section} place={labelPlace(grid, cell.slot, cell.span)} stacked />
          ) : (
            <Icon
              key={cell.entry.id}
              entry={cell.entry}
              grid={grid}
              slot={cell.slot}
              armed={armedId !== 0 && cell.entry.id === armedId}
              tone={tones.get(cell.entry.id) ?? 0}
              named={named}
              textScale={textScale}
              stateWords={stateWords}
              achievedMilestone={achievedMilestone}
              onPlace={onPlace}
            />
          ))}
        </div>
        {footer}
      </Scrollable>
    </div>
  );
});
