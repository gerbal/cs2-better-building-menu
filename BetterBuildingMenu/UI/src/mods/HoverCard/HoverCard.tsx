import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { clearPointed, type Pointed } from "domain/assetMenuViewStore";
import { isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { hoverCardForm, pointerCardText } from "domain/hoverCard";
import { hoverCardLabels } from "domain/hoverCardLines";
import { placePointerCard, placeSlotCard, remRect, type Rect } from "domain/hoverCardPlace";
import type { KeyKind } from "domain/rowNumbers";
import { LAYOUT_HEIGHT } from "domain/sharedContracts.generated";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuHoverCard$, AssetMenuTuning$, BuildingCatalog$, SHIPPED_TUNING } from "mods/bindings";
import { HoverCardContent, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { PlannedName } from "mods/Bodies/PlannedName";
import { UNIT_GLYPHS } from "mods/Bodies/unitGlyphs";
import { useNumberSeparators, useStateWords } from "mods/Bodies/useBodyWords";
import { useAssetMenuView } from "mods/useAssetMenuView";
import styles from "./hoverCard.module.scss";
import { drawnCells, type DrawnCells } from "./pointing";

/** The name's font at 100% text, and the room it is planned in: hoverCard.module.scss's `.name`. */
const NAME_FONT = 13;
const NAME_ROOM = 150;
/** The lines a name may take: enough that a building's name draws whole. */
const NAME_LINES = 3;

/**
 * The building the pointer rests on, once it has rested the Hover delay knob's time; null at once when it
 * leaves. A move from one cell to the next takes the first away at once, and shows the next once it has
 * rested as long.
 */
export function usePointedAfterDelay(): Pointed | null {
  const pointed = useAssetMenuView((view) => view.pointed);
  const delay = useValue(AssetMenuTuning$).hoverDelay ?? SHIPPED_TUNING.hoverDelay;
  const [shown, setShown] = useState<Pointed | null>(null);

  useEffect(() => {
    if (pointed === null) {
      setShown(null);
      return undefined;
    }
    const timer = setTimeout(() => setShown(pointed), delay);
    return () => clearTimeout(timer);
  }, [pointed, delay]);

  return pointed !== null && shown !== null && shown.entry.id === pointed.entry.id ? pointed : null;
}

interface CardProps {
  pointed: Pointed;
  boxRef: RefObject<HTMLElement>;
}

/** Where a card goes, in screen rem, from its drawn size, the box as drawn with the pointed cell in it, and the screen. */
type Placer = (card: Rect, drawn: DrawnCells & { cell: Rect }, screen: { w: number; h: number }) => Rect;

/**
 * A card drawn unseen first, then, two frames on, measured and placed against the box, in the box's own
 * rem: never in the tick of a render or an event, where Cohtml reports the previous layout's sizes. It
 * places itself again when the page, the screen, the box or the card change size, and on a wheel over the
 * box. Null until placed for the building pointed at.
 */
function usePlacedCard(pointed: Pointed, boxRef: RefObject<HTMLElement>, page: unknown, placer: Placer): { cardRef: RefObject<HTMLDivElement>; placed: { left: number; top: number } | null } {
  const cardRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ id: number; left: number; top: number } | null>(null);
  const placerRef = useRef(placer);
  placerRef.current = placer;

  useEffect(() => {
    const card = cardRef.current;
    const box = boxRef.current;
    if (!card || !box) return undefined;
    const id = pointed.entry.id;
    const place = () => {
      const height = window.innerHeight;
      const drawn = drawnCells(box, id, height);
      const at = placerRef.current(
        remRect(card.getBoundingClientRect(), height),
        // Where the cell is drawn now, or where the pointer entered it while it is not.
        { ...drawn, cell: drawn.cell ?? pointed.cell },
        { w: (window.innerWidth * LAYOUT_HEIGHT) / height, h: LAYOUT_HEIGHT },
      );
      const left = at.x - drawn.box.x;
      const top = at.y - drawn.box.y;
      setPlace((last) => (last !== null && last.id === id && last.left === left && last.top === top ? last : { id, left, top }));
    };
    let outer = 0;
    let inner = 0;
    const schedule = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(place);
      });
    };
    // Cohtml sends no scroll event: a wheel over the box is what scrolls its body.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(box);
    observer?.observe(card);
    box.addEventListener("wheel", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer?.disconnect();
      box.removeEventListener("wheel", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pointed, boxRef, page]);

  return { cardRef, placed: place !== null && place.id === pointed.entry.id ? place : null };
}

/**
 * The card beside the pointer, placed by `placePointerCard` against the box, the screen's HUD and the
 * cells drawn. It says the building as the page has it now.
 */
const PointerCard = memo(function PointerCard({ pointed, boxRef }: CardProps) {
  const page = useValue(BuildingCatalog$);
  const entry = page?.items?.find((row) => row.id === pointed.entry.id) ?? pointed.entry;
  const { translate } = useLocalization();
  const separators = useNumberSeparators();
  const stateWords = useStateWords();
  const textScale = useTextScale();
  // The view's key kind, which the card names the key number by; capacity before a page has said.
  const keyKind = (page?.facts?.keyKind ?? "capacity") as KeyKind;
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  const { cardRef, placed } = usePlacedCard(pointed, boxRef, page, (card, drawn, screen) =>
    placePointerCard({ cell: drawn.cell, card: { w: card.w, h: card.h }, box: drawn.box, screen, cells: drawn.cells }));
  const words = useMemo(() => ({
    labels: hoverCardLabels((key, fallback) => translate(key, fallback)),
    unlocksAt: translate("Tooltip.LABEL[BetterBuildingMenu.UnlocksAtMilestone]", "Unlocks at milestone {0}") ?? "Unlocks at milestone {0}",
    lockedWord: stateWords.locked,
  }), [translate, stateWords.locked]);
  const text = pointerCardText(entry, keyKind, separators, words, achievedMilestone);
  const locked = isEntryLocked(entry);

  return (
    <div
      ref={cardRef}
      className={classNames(styles.card, placed === null && styles.unplaced)}
      style={placed === null ? undefined : { left: `${placed.left}rem`, top: `${placed.top}rem` }}
      data-bbm-hovercard="pointer"
    >
      <span className={styles.plate}>
        <img
          className={styles.picture}
          src={lockedThumbnail(entry, locked || isEntryAlreadyBuilt(entry))}
          onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
          alt=""
          aria-hidden="true"
        />
        {locked && <img className={styles.lockGlyph} src="coui://betterbuildingmenu/LockRaster.png" alt="" aria-hidden="true" />}
      </span>
      <span className={styles.column} style={{ minWidth: `${NAME_ROOM * textScale}rem` }}>
        <PlannedName className={styles.name} name={entry.name || entry.prefabName} width={NAME_ROOM * textScale} lines={NAME_LINES} font={NAME_FONT * textScale} marked={false} />
        {text.rows.length > 0 && (
          <span className={styles.table}>
            {text.rows.map((row) => (
              <span key={row.key} className={styles.row} data-line={row.key}>
                <span className={styles.label}>
                  {row.glyph !== null && <img className={styles.glyph} style={{ maskImage: `url(${UNIT_GLYPHS[row.glyph]})` }} alt="" aria-hidden="true" />}
                  {row.label}
                </span>
                <span className={styles.value}>{row.value}</span>
              </span>
            ))}
          </span>
        )}
        {text.unlock !== null && (
          <span className={styles.unlock}>
            <img className={styles.unlockGlyph} src="coui://betterbuildingmenu/LockRaster.png" alt="" aria-hidden="true" />
            {text.unlock}
          </span>
        )}
      </span>
    </div>
  );
});

/**
 * The game's detail slot: a wide card above the box, placed by `placeSlotCard` over the pointed cell, the
 * game's own card's lines beside a 150 picture, then the building's packs. It says the building as the
 * page has it now.
 */
const SlotCard = memo(function SlotCard({ pointed, boxRef }: CardProps) {
  const page = useValue(BuildingCatalog$);
  const entry = page?.items?.find((row) => row.id === pointed.entry.id) ?? pointed.entry;
  const context = useHoverCardContext();
  const { cardRef, placed } = usePlacedCard(pointed, boxRef, page, (card, drawn, screen) =>
    placeSlotCard({ cell: drawn.cell, height: card.h, box: drawn.box, screen }));
  const packs = (entry.assetPacks ?? []).join(" · ");

  return (
    <div
      ref={cardRef}
      className={classNames(styles.card, styles.slot, placed === null && styles.unplaced)}
      style={placed === null ? undefined : { left: `${placed.left}rem`, top: `${placed.top}rem` }}
      data-bbm-hovercard="slot"
    >
      <span className={styles.slotPlate}>
        <img
          className={styles.slotPicture}
          src={lockedThumbnail(entry, isEntryLocked(entry) || isEntryAlreadyBuilt(entry))}
          onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
          alt=""
          aria-hidden="true"
        />
      </span>
      <span className={styles.slotColumn}>
        <HoverCardContent entry={entry} context={context} onPanel />
        {packs !== "" && <span className={styles.packs}>{packs}</span>}
      </span>
    </div>
  );
});

export interface HoverCardProps {
  /** The box, which the card places itself against and finds the cells drawn in. */
  boxRef: RefObject<HTMLElement>;
  /** While a list is open the card hides, so it never covers the list's rows. */
  hidden: boolean;
}

/**
 * The one hover card of the menu, a child of the box's root: the building pointed at, in the form the
 * Hover card row picks. Beside the pointer and the game's detail slot draw a card above the box; Status
 * line only draws none here, the readout saying it instead. Nothing is pointed at once the menu closes.
 * See docs/design-notes.md, "The hover card".
 */
export const HoverCard = ({ boxRef, hidden }: HoverCardProps) => {
  const form = hoverCardForm(useValue(AssetMenuHoverCard$));
  const pointed = usePointedAfterDelay();

  useEffect(() => () => clearPointed(), []);

  if (hidden || pointed === null || form === "status") return null;

  return form === "slot" ? <SlotCard pointed={pointed} boxRef={boxRef} /> : <PointerCard pointed={pointed} boxRef={boxRef} />;
};
