import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";

import { clearPointed, getAssetMenuView, type Pointed } from "domain/assetMenuViewStore";
import { isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { TAB_COUNT_SIZE, TAB_NAME_SIZE } from "domain/assetMenuLayout";
import { hoverCardForm, pointerCardText, statusLine, type PointerCardWords, type StatusLine } from "domain/hoverCard";
import { lookOf } from "domain/looks";
import { hoverCardLabels } from "domain/hoverCardLines";
import { coversPoint, placePointerCard, placeSlotCard, remRect, SLOT_ROOM, slotRowsKept, type Rect } from "domain/hoverCardPlace";
import type { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";
import { sameValue } from "domain/catalogWindow";
import type { KeyKind } from "domain/rowNumbers";
import { readoutSepWidth } from "domain/tabRow";
import { LAYOUT_HEIGHT } from "domain/sharedContracts.generated";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuHoverCard$, AssetMenuLook$, AssetMenuTuning$, BuildingCatalog$, SHIPPED_TUNING } from "mods/bindings";
import { HoverCardContent, useHoverCardContext, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
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
 * rested as long, as it does the first again where the pointer comes back to it sooner. With `active` false it reads nothing from the store, so a component that only sometimes
 * says the building never draws again as the pointer crosses cells.
 */
export function usePointedAfterDelay(active = true): Pointed | null {
  const pointed = useAssetMenuView((view) => (active ? view.pointed : null));
  const delay = useValue(AssetMenuTuning$).hoverDelay ?? SHIPPED_TUNING.hoverDelay;
  const [shown, setShown] = useState<Pointed | null>(null);

  useEffect(() => {
    if (pointed === null) {
      setShown(null);
      return undefined;
    }
    // Another building: the one shown is shown no more, so the pointer coming back to it waits again.
    setShown((last) => (last !== null && last.entry.id !== pointed.entry.id ? null : last));
    const timer = setTimeout(() => setShown(pointed), delay);
    return () => clearTimeout(timer);
  }, [pointed, delay]);

  return pointed !== null && shown !== null && shown.entry.id === pointed.entry.id ? pointed : null;
}

/** The pointed building as the page has it now, or as it was pointed at while the page holds it no more. */
const pageRow = (page: BuildingCatalogPage | null | undefined, pointed: Pointed): BuildingCatalogEntry =>
  page?.items?.find((row) => row.id === pointed.entry.id) ?? pointed.entry;

/** The words the card and the status line say beyond the figures: the hover card's labels, the unlock line, the locked word. */
function useCardWords(): PointerCardWords {
  const { translate } = useLocalization();
  const stateWords = useStateWords();

  return useMemo(() => ({
    labels: hoverCardLabels((key, fallback) => translate(key, fallback)),
    unlocksAt: translate("Tooltip.LABEL[BetterBuildingMenu.UnlocksAtMilestone]", "Unlocks at milestone {0}") ?? "Unlocks at milestone {0}",
    lockedWord: stateWords.locked,
  }), [translate, stateWords.locked]);
}

/**
 * Status line only: what the readout says of the building pointed at, in the room the tabs leave it, the
 * tabs never moving; null while nothing is pointed at, or the Hover card row picks another form. It reads
 * the pointed building, and works the room out, only under that form, and says the building as the page
 * has it now. Above 100% text the readout's two lines do not fit the row, so it draws one.
 * See docs/design-notes.md, "The hover card".
 */
export function useStatusLine(room: () => number, keyKind: KeyKind): StatusLine | null {
  const status = hoverCardForm(useValue(AssetMenuHoverCard$)) === "status";
  const pointed = usePointedAfterDelay(status);
  const page = useValue(BuildingCatalog$);
  const words = useCardWords();
  const separators = useNumberSeparators();
  const textScale = useTextScale();
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;

  if (!status || pointed === null) return null;

  const entry = pageRow(page, pointed);
  const line = TAB_COUNT_SIZE * textScale;
  return statusLine(entry, keyKind, separators, words, achievedMilestone, room(), {
    name: TAB_NAME_SIZE * textScale,
    line,
    sep: readoutSepWidth(line),
  }, textScale > 1);
}

/**
 * Where the pointer last moved over the box, in the page's pixels, and the building pointed at as it moved;
 * null until it has moved there.
 */
type PointerAt = MutableRefObject<{ x: number; y: number; id: number | null } | null>;

interface CardProps {
  pointed: Pointed;
  boxRef: RefObject<HTMLElement>;
  pointer: PointerAt;
}

/**
 * Runs `run` two frames on, never in the tick of a render or an event, where Cohtml reports the previous
 * layout's sizes: now, again when `restart` changes, and whenever what the box draws may have moved under
 * the pointer. That is the screen, the box or `cardRef`'s card changing size; a wheel over the box, as
 * Cohtml sends no scroll event and a wheel scrolls the body; and a key, as PageUp and PageDown scroll it
 * and Up and Down reveal Enter's target.
 */
function useAfterLayout(boxRef: RefObject<HTMLElement>, cardRef: RefObject<HTMLElement> | null, run: (box: HTMLElement) => void, restart: unknown): void {
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const card = cardRef?.current ?? null;
    const keys = typeof document === "undefined" ? null : document;
    let outer = 0;
    let inner = 0;
    const schedule = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => runRef.current(box));
      });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(box);
    if (card) observer?.observe(card);
    box.addEventListener("wheel", schedule);
    window.addEventListener("resize", schedule);
    // Captured, as the app container stops a key from bubbling.
    keys?.addEventListener("keydown", schedule, true);
    schedule();
    return () => {
      observer?.disconnect();
      box.removeEventListener("wheel", schedule);
      window.removeEventListener("resize", schedule);
      keys?.removeEventListener("keydown", schedule, true);
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [boxRef, cardRef, restart]);
}

/**
 * Whether the pointed building's cell, as drawn now, still lies under the pointer: where the pointer last
 * moved over the box while this building was pointed at, else where it entered the cell, else the cell's
 * middle, so a move heard before the enter never judges it. Where it does not, the building is pointed at
 * no more. Content that moves under a resting pointer (a wheel, a key, a new page) may send no leave, and a
 * card that followed the building would name one the pointer has left. See docs/design-notes.md, "The hover card".
 */
function stillPointed(cell: Rect | null, pointed: Pointed, pointer: PointerAt, innerHeight: number): cell is Rect {
  const moved = pointer.current !== null && pointer.current.id === pointed.entry.id ? pointer.current : null;
  const at = moved !== null
    ? remRect({ left: moved.x, top: moved.y, width: 0, height: 0 }, innerHeight)
    : pointed.at ?? { x: pointed.cell.x + pointed.cell.w / 2, y: pointed.cell.y + pointed.cell.h / 2 };
  if (cell !== null && coversPoint(cell, at)) return true;
  clearPointed(pointed.entry.id);
  return false;
}

/** Where a card goes, in screen rem, from its drawn size, the box as drawn with the pointed cell in it, and the screen. */
type Placer = (card: Rect, drawn: DrawnCells & { cell: Rect }, screen: { w: number; h: number }) => Rect;

interface PlacedCard {
  cardRef: RefObject<HTMLDivElement>;
  /** Where the card goes in the box's rem; null until placed for the building pointed at, as drawn. */
  placed: { left: number; top: number } | null;
  page: BuildingCatalogPage | null | undefined;
  /** The pointed building as the page has it now. */
  entry: BuildingCatalogEntry;
}

/**
 * A card drawn unseen first, then, two frames on, measured and placed against the box, in the box's own
 * rem (`useAfterLayout`), again whenever the page changes or what the box draws may have moved, and waits
 * for a new place when `drawn` (what the card draws) changes. Where the pointed cell no longer lies under
 * the pointer the building goes instead (`stillPointed`).
 */
function usePlacedCard(pointed: Pointed, boxRef: RefObject<HTMLElement>, pointer: PointerAt, placer: Placer, drawn: unknown = null): PlacedCard {
  const page = useValue(BuildingCatalog$);
  const cardRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ id: number; drawn: unknown; left: number; top: number } | null>(null);
  const restart = useMemo(() => [pointed, page, drawn], [pointed, page, drawn]);

  useAfterLayout(boxRef, cardRef, (box) => {
    const card = cardRef.current;
    if (!card) return;
    const id = pointed.entry.id;
    const height = window.innerHeight;
    const cells = drawnCells(box, id, height);
    if (!stillPointed(cells.cell, pointed, pointer, height)) return;
    const at = placer(
      remRect(card.getBoundingClientRect(), height),
      { ...cells, cell: cells.cell },
      { w: (window.innerWidth * LAYOUT_HEIGHT) / height, h: LAYOUT_HEIGHT },
    );
    const left = at.x - cells.box.x;
    const top = at.y - cells.box.y;
    setPlace((last) => (last !== null && last.id === id && last.drawn === drawn && last.left === left && last.top === top ? last : { id, drawn, left, top }));
  }, restart);

  return {
    cardRef,
    placed: place !== null && place.id === pointed.entry.id && place.drawn === drawn ? place : null,
    page,
    entry: pageRow(page, pointed),
  };
}

/** Status line only draws no card, but the building still goes when its cell moves from under the pointer. */
function StatusCheck({ pointed, boxRef, pointer }: CardProps) {
  const page = useValue(BuildingCatalog$);
  const restart = useMemo(() => [pointed, page], [pointed, page]);

  useAfterLayout(boxRef, null, (box) => {
    const height = window.innerHeight;
    stillPointed(drawnCells(box, pointed.entry.id, height).cell, pointed, pointer, height);
  }, restart);

  return null;
}

/**
 * The card beside the pointer, placed by `placePointerCard` against the box, the screen's HUD and the
 * cells drawn. It says the building as the page has it now.
 */
const PointerCard = memo(function PointerCard({ pointed, boxRef, pointer }: CardProps) {
  const { cardRef, placed, page, entry } = usePlacedCard(pointed, boxRef, pointer, (card, drawn, screen) =>
    placePointerCard({ cell: drawn.cell, card: { w: card.w, h: card.h }, box: drawn.box, screen, cells: drawn.cells }));
  const separators = useNumberSeparators();
  const words = useCardWords();
  const textScale = useTextScale();
  // The view's key kind, which the card names the key number by; capacity before a page has said.
  const keyKind = (page?.facts?.keyKind ?? "capacity") as KeyKind;
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  // Its key number's glyph as the look marks units: none in Plates, whose words say them.
  const text = pointerCardText(entry, keyKind, separators, words, achievedMilestone, lookOf(useValue(AssetMenuLook$)).units);
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

/** The rows a slot card draws, measured for what it says of one building: the row, the card's words, the text scale. */
interface SlotRows {
  entry: BuildingCatalogEntry;
  context: HoverCardContext;
  textScale: number;
  /** The leading rows that fit the slot's room. */
  rows: number;
  /** Whether every row fits, the packs, which come last, among them. */
  all: boolean;
}

/**
 * The game's detail slot: a wide card above the box, placed by `placeSlotCard` over the pointed cell, the
 * game's own card's lines beside a large picture, then the building's packs. It is drawn unseen with every
 * row, measured two frames on, then drawn with the leading rows that fit `SLOT_ROOM` whole (`slotRowsKept`)
 * and placed as drawn, so a long card drops its last rows, the packs first, and never cuts one.
 */
const SlotCard = memo(function SlotCard({ pointed, boxRef, pointer }: CardProps) {
  const context = useHoverCardContext();
  const textScale = useTextScale();
  const columnRef = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState<SlotRows | null>(null);
  const { cardRef, placed, entry } = usePlacedCard(pointed, boxRef, pointer, (card, drawn, screen) =>
    placeSlotCard({ cell: drawn.cell, height: card.h, box: drawn.box, screen }), measured);
  // Kept while the card says the same: a page that brings the building back unchanged keeps it drawn and placed.
  const rows = measured !== null && measured.context === context && measured.textScale === textScale && sameValue(measured.entry, entry) ? measured : null;
  const packs = (entry.assetPacks ?? []).join(" · ");

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return undefined;
    const measure = () => {
      const height = window.innerHeight;
      const top = remRect(column.getBoundingClientRect(), height).y;
      const bottoms = Array.from(column.querySelectorAll("[data-card-row]")).map((row) => {
        const at = remRect(row.getBoundingClientRect(), height);
        return at.y + at.h - top;
      });
      const kept = slotRowsKept(bottoms, SLOT_ROOM);
      // With every row drawn, the rows that fit; with fewer, fewer again only where a drawn row grew (a line
      // too long for its half takes the row), so it settles.
      if (rows === null) setMeasured({ entry, context, textScale, rows: kept, all: kept === bottoms.length });
      else if (kept < bottoms.length) setMeasured({ entry, context, textScale, rows: kept, all: false });
    };
    // Never in the tick of a render: Cohtml reports the previous layout's sizes then.
    let outer = 0;
    let inner = 0;
    const schedule = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(measure);
      });
    };
    // The column is capped, so its content is what grows.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(column);
    if (column.firstElementChild) observer?.observe(column.firstElementChild);
    schedule();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [rows, entry, context, textScale]);

  return (
    <div
      ref={cardRef}
      className={classNames(styles.card, styles.slot, (rows === null || placed === null) && styles.unplaced)}
      style={rows === null || placed === null ? undefined : { left: `${placed.left}rem`, top: `${placed.top}rem` }}
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
      <span ref={columnRef} className={styles.slotColumn}>
        <HoverCardContent entry={entry} context={context} onPanel rows={rows === null || rows.all ? undefined : rows.rows} />
        {packs !== "" && (rows === null || rows.all) && <span className={styles.packs} data-card-row="packs">{packs}</span>}
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
  const pointer: PointerAt = useRef<{ x: number; y: number; id: number | null } | null>(null);

  useEffect(() => () => clearPointed(), []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const moved = (event: MouseEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY, id: getAssetMenuView().pointed?.entry.id ?? null };
    };
    box.addEventListener("mousemove", moved);
    return () => box.removeEventListener("mousemove", moved);
  }, [boxRef]);

  if (hidden || pointed === null) return null;
  if (form === "status") return <StatusCheck pointed={pointed} boxRef={boxRef} pointer={pointer} />;

  return form === "slot"
    ? <SlotCard pointed={pointed} boxRef={boxRef} pointer={pointer} />
    : <PointerCard pointed={pointed} boxRef={boxRef} pointer={pointer} />;
};
