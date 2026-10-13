import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { memo, type ReactNode } from "react";

import enterMark from "images/enter.svg";
import type { NumberSeparators } from "domain/assetMenuMetricFormat";
import type { AssetMenuMetric } from "domain/assetMenuLayout";
import { slotPosition, slotsHeight, type BodyGrid } from "domain/bodyGeometry";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { entryStateWord, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { plateNumbers } from "domain/listPlate";
import { sortedMetricFor } from "domain/sortedMetric";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { ActivePrefabId$, BuildingCatalogSortColumn$ } from "mods/bindings";
import { BuildingHoverCard, useHoverCardContext, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import styles from "./listBody.module.scss";
import { useNumberSeparators, useStateWords, type StateWords } from "./useBodyWords";

interface PlateProps {
  entry: BuildingCatalogEntry;
  grid: BodyGrid;
  index: number;
  armed: boolean;
  enter: boolean;
  sortedMetric: AssetMenuMetric | null;
  separators: NumberSeparators;
  stateWords: StateWords;
  hoverCard: HoverCardContext;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One building on a plate: its picture, its name on its lines, and its numbers; "↵" beside them on
 * Enter's target. The live check and the render tests count what a body shows through the data-bbm
 * markers.
 */
const Plate = memo(function Plate({ entry, grid, index, armed, enter, sortedMetric, separators, stateWords, hoverCard, onPlace }: PlateProps) {
  const name = entry.name || entry.prefabName;
  const numbers = plateNumbers(entry, sortedMetric, separators, stateWords.locked);
  const { left, top } = slotPosition(grid, index);
  const word = entryStateWord(entry, stateWords.locked, stateWords.built);
  const locked = isEntryLocked(entry);

  return (
    <BuildingHoverCard entry={entry} context={hoverCard}>
      <Button
        className={classNames(styles.plate, grid.form !== "plate2" && styles.largeText, armed && styles.armed, locked && styles.locked)}
        // Inline, over the game's Button and its own square: the slot is the plate's place and size.
        style={{ left: `${left}rem`, top: `${top}rem`, width: `${grid.cellWidth}rem`, height: `${grid.cellHeight}rem` }}
        variant="flat"
        focusKey={FOCUS_DISABLED}
        onSelect={() => onPlace(entry)}
        aria-label={word ? `${name} — ${word}` : name}
        aria-disabled={locked || isEntryAlreadyBuilt(entry) ? "true" : undefined}
        data-catalog-entry={entry.id}
        data-bbm-item="true"
      >
        <img
          className={styles.picture}
          src={lockedThumbnail(entry, locked || isEntryAlreadyBuilt(entry))}
          onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
          alt=""
          aria-hidden="true"
          data-bbm-pic="true"
        />
        {/* Plain text, no spans: Cohtml drops the space after an inline element, and never breaks at a hyphen. */}
        <p className={classNames(styles.name, grid.nameLines === 1 && styles.oneLine)} data-bbm-name={name.length} {...{ cohinline: "" }}>
          {name}
        </p>
        <div className={styles.numbers} data-bbm-fact="true">
          <span className={classNames(styles.first, numbers.locked && styles.milestone)}>
            {enter && <img className={styles.enterMark} style={{ maskImage: `url(${enterMark})` }} alt="" aria-hidden="true" />}
            {numbers.first}
          </span>
          {numbers.second !== null && <span className={styles.second}>{numbers.second}</span>}
        </div>
      </Button>
    </BuildingHoverCard>
  );
});

export interface ListBodyProps {
  entries: BuildingCatalogEntry[];
  grid: BodyGrid;
  /** Enter's target, while the page answers the query in the box; null otherwise. */
  enterId: number | null;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, inside the scroll, below the last line. */
  footer?: ReactNode;
}

/**
 * The list: each building on a plate, placed from its slot index, in the page's order. The game's
 * Scrollable draws the track at the box's right edge, inside its margin. See docs/design-notes.md,
 * "The bodies".
 */
export const ListBody = memo(function ListBody({ entries, grid, enterId, onPlace, footer }: ListBodyProps) {
  const separators = useNumberSeparators();
  const stateWords = useStateWords();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const armedId = useValue(ActivePrefabId$);
  const hoverCard = useHoverCardContext();

  return (
    <div className={styles.body} data-bbm-view="list">
      <Scrollable className={styles.scroller} vertical trackVisibility="scrollable">
        <div className={styles.slots} style={{ height: `${slotsHeight(grid, entries.length)}rem` }}>
          {entries.map((entry, index) => (
            <Plate
              key={entry.id}
              entry={entry}
              grid={grid}
              index={index}
              armed={entry.id === armedId}
              enter={entry.id === enterId}
              sortedMetric={sortedMetric}
              separators={separators}
              stateWords={stateWords}
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
