import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { Button, Scrollable } from "cs2/ui";
import classNames from "classnames";
import { memo, useEffect, type ReactNode } from "react";

import enterMark from "images/enter.svg";
import type { BuildingCatalogEntry } from "domain/buildingCatalog";
import { entryStateWord, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { cardNameBox, type CardText } from "domain/cardsLayout";
import { useTextScale } from "domain/textScaleSetting";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { ActivePrefabId$ } from "mods/bindings";
import type { CardPlace, CardsLayout } from "mods/BuildingCatalog/useCardsLayout";
import { clearPointed } from "domain/assetMenuViewStore";
import { pointAt, type CellEnter } from "mods/HoverCard/pointing";
import styles from "./cardsBody.module.scss";
import { LabelPlate } from "./LabelPlate";
import { PlannedName } from "./PlannedName";
import { UniqueMark } from "./UniqueMark";
import { useStateWords, type StateWords } from "./useBodyWords";

interface CardProps {
  entry: BuildingCatalogEntry;
  text: CardText;
  place: CardPlace;
  held: boolean;
  armed: boolean;
  enter: boolean;
  textScale: number;
  stateWords: StateWords;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One building on a card: its picture, with the unique or built mark and, on Enter's target, "↵";
 * its whole name over its facts line (a locked card's milestone beside the lock, then the lot, the cost
 * and the capacity); and under a sort by a number, the value sorted by at its right. The live check and
 * the render tests count what a body shows through the data-bbm markers.
 */
const Card = memo(function Card({ entry, text, place, held, armed, enter, textScale, stateWords, onPlace }: CardProps) {
  const fullName = entry.name || entry.prefabName;
  const locked = isEntryLocked(entry);
  const built = isEntryAlreadyBuilt(entry);
  const word = entryStateWord(entry, stateWords.locked, stateWords.built);
  // A cell that goes from under the pointer sends no leave: it takes its own building away as it goes.
  useEffect(() => () => clearPointed(entry.id), [entry.id]);

  return (
    <Button
      className={classNames(styles.card, armed && styles.armed, locked && styles.locked, built && styles.built)}
      // Inline, over the game's Button and its own square: the packer's place is the card's place and size.
      style={{ left: `${place.left}rem`, top: `${place.top}rem`, width: `${place.width}rem`, height: `${place.height}rem` }}
      variant="flat"
      focusKey={FOCUS_DISABLED}
      onSelect={() => onPlace(entry)}
      onMouseEnter={(event: CellEnter) => pointAt(entry, event)}
      onMouseLeave={() => clearPointed(entry.id)}
      aria-label={word ? `${fullName} — ${word}` : fullName}
      aria-disabled={locked || built ? "true" : undefined}
      data-catalog-entry={entry.id}
      data-bbm-item="true"
      // Always written, both ways: the silhouette rule keys off "false", as Cohtml rejects :not().
      data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
    >
      {/* The picture, its mark and Enter's badge share a box, so they sit on the building. */}
      <span className={styles.artwork}>
        <img
          className={styles.picture}
          src={lockedThumbnail(entry, locked || built)}
          onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
          alt=""
          aria-hidden="true"
          data-bbm-pic="true"
        />
        <UniqueMark entry={entry} built={built} className={classNames(styles.mark, built ? styles.builtMark : styles.uniqueMark)} />
        {enter && (
          <span className={styles.enterBadge}>
            <img className={styles.enterMark} style={{ maskImage: `url(${enterMark})` }} alt="" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className={styles.words}>
        {held ? (
          // Planned on its one line in the room the card has, cut with "…": Cohtml draws no CSS ellipsis.
          <PlannedName className={classNames(styles.name, styles.nameHeld)} name={fullName} distinct={entry.distinctWord ?? ""} {...cardNameBox(text, place.width, textScale)} />
        ) : (
          <span className={styles.name} data-bbm-name={fullName.length}>{text.name}</span>
        )}
        {/* Each figure in its own box, "·" between: two figures with only space between read as one number. */}
        <span className={styles.facts} data-bbm-fact="true">
          {text.locked !== null && (
            <>
              {/* A raster, because a masked vector is what this engine cannot draw. */}
              <img className={styles.lockGlyph} src="coui://betterbuildingmenu/LockRaster.png" alt="" aria-hidden="true" />
              <span className={styles.milestone}>{text.locked}</span>
              {text.facts.length > 0 && <span className={styles.factDot} aria-hidden="true">·</span>}
            </>
          )}
          {text.facts.map((fact, at) => (
            <span key={at} className={styles.factRun}>
              {at > 0 && <span className={styles.factDot} aria-hidden="true">·</span>}
              <span className={styles.fact}>{fact}</span>
            </span>
          ))}
        </span>
      </span>
      {/* Right-aligned, so the sorted figures line up down the rows and the order reads down the page. */}
      {text.sorted !== null && <span className={styles.sorted}>{text.sorted}</span>}
    </Button>
  );
});

export interface CardsBodyProps {
  layout: CardsLayout;
  /** Enter's target, while the page answers the query in the box; null otherwise. */
  enterId: number | null;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /** The end of the feed, inside the scroll, below the last row. */
  footer?: ReactNode;
}

/**
 * The cards: each building on a card as wide as its words, placed by the row packer, with the label
 * plates over its groups and its locked rows in the rows among them, all in the look's tokens. See
 * docs/design-notes.md, "The cards".
 */
export const CardsBody = memo(function CardsBody({ layout, enterId, onPlace, footer }: CardsBodyProps) {
  const stateWords = useStateWords();
  const armedId = useValue(ActivePrefabId$);
  const textScale = useTextScale();

  return (
    <div className={styles.body} data-bbm-view="cards">
      <Scrollable className={styles.scroller} vertical trackVisibility="scrollable">
        <div className={styles.slots} style={{ height: `${layout.height}rem` }}>
          {layout.cells.map((cell) => cell.kind === "label" ? (
            <LabelPlate key={cell.section.id} section={cell.section} place={cell.place} stacked={false} />
          ) : (
            <Card
              key={cell.entry.id}
              entry={cell.entry}
              text={cell.text}
              place={cell.place}
              held={cell.held}
              armed={armedId !== 0 && cell.entry.id === armedId}
              enter={cell.entry.id === enterId}
              textScale={textScale}
              stateWords={stateWords}
              onPlace={onPlace}
            />
          ))}
        </div>
        {footer}
      </Scrollable>
    </div>
  );
});
