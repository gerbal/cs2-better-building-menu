import { useValue } from "cs2/api";
import { milestone } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { clearPointed, type Pointed } from "domain/assetMenuViewStore";
import { isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { hoverCardForm, pointerCardText } from "domain/hoverCard";
import { hoverCardLabels } from "domain/hoverCardLines";
import { placePointerCard, remRect } from "domain/hoverCardPlace";
import type { KeyKind } from "domain/rowNumbers";
import { LAYOUT_HEIGHT } from "domain/sharedContracts.generated";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenuHoverCard$, AssetMenuTuning$, BuildingCatalog$, SHIPPED_TUNING } from "mods/bindings";
import { PlannedName } from "mods/Bodies/PlannedName";
import { UNIT_GLYPHS } from "mods/Bodies/unitGlyphs";
import { useNumberSeparators, useStateWords } from "mods/Bodies/useBodyWords";
import { useAssetMenuView } from "mods/useAssetMenuView";
import styles from "./hoverCard.module.scss";

/** The name's font at 100% text, and the room it is planned in: hoverCard.module.scss's `.name`. */
const NAME_FONT = 13;
const NAME_ROOM = 150;
/** The lines a name may take: enough that a building's name draws whole. */
const NAME_LINES = 3;

/**
 * The building the pointer rests on, once it has rested the Hover delay knob's time; null at once when it
 * leaves. A move from one cell to the next shows the first until the next has rested as long.
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

  return pointed === null ? null : shown;
}

/** The view's key kind, which the card names the key number by; capacity before a page has said. */
function useKeyKind(): KeyKind {
  return (useValue(BuildingCatalog$)?.facts?.keyKind ?? "capacity") as KeyKind;
}

interface PointerCardProps {
  pointed: Pointed;
  boxRef: RefObject<HTMLElement>;
}

/**
 * The card beside the pointer: drawn unseen first, then, two frames on, measured and placed by
 * `placePointerCard` against the box, the screen's HUD and the cells drawn, in the box's own rem.
 */
function PointerCard({ pointed, boxRef }: PointerCardProps) {
  const { entry } = pointed;
  const { translate } = useLocalization();
  const separators = useNumberSeparators();
  const stateWords = useStateWords();
  const textScale = useTextScale();
  const keyKind = useKeyKind();
  const achievedMilestone = useValue(milestone.achievedMilestone$) ?? 0;
  const cardRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ id: number; left: number; top: number } | null>(null);
  const words = useMemo(() => ({
    labels: hoverCardLabels((key, fallback) => translate(key, fallback)),
    unlocksAt: translate("Tooltip.LABEL[BetterBuildingMenu.UnlocksAtMilestone]", "Unlocks at milestone {0}") ?? "Unlocks at milestone {0}",
    lockedWord: stateWords.locked,
  }), [translate, stateWords.locked]);
  const text = pointerCardText(entry, keyKind, separators, words, achievedMilestone);
  const locked = isEntryLocked(entry);

  useEffect(() => {
    // Never in the tick of the render: Cohtml reports the previous layout's sizes then.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const card = cardRef.current;
        const box = boxRef.current;
        if (!card || !box) return;
        const height = window.innerHeight;
        const boxRect = remRect(box.getBoundingClientRect(), height);
        const drawn = remRect(card.getBoundingClientRect(), height);
        const cells = Array.from(box.querySelectorAll("[data-bbm-item]")).map((cell) => remRect(cell.getBoundingClientRect(), height));
        const at = placePointerCard({
          cell: pointed.cell,
          card: { w: drawn.w, h: drawn.h },
          box: boxRect,
          screen: { w: (window.innerWidth * LAYOUT_HEIGHT) / height, h: LAYOUT_HEIGHT },
          cells,
        });
        setPlace({ id: entry.id, left: at.x - boxRect.x, top: at.y - boxRect.y });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pointed, boxRef, entry.id]);

  const placed = place !== null && place.id === entry.id ? place : null;

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
}

export interface HoverCardProps {
  /** The box, which the card places itself against and finds the cells drawn in. */
  boxRef: RefObject<HTMLElement>;
  /** While a list is open the card hides, so it never covers the list's rows. */
  hidden: boolean;
}

/**
 * The one hover card of the menu, a child of the box's root: the building pointed at, in the form the
 * Hover card row picks. Beside the pointer draws a card above the box; Status line only draws none here,
 * the readout saying it instead. Nothing is pointed at once the menu closes. See docs/design-notes.md,
 * "The hover card".
 */
export const HoverCard = ({ boxRef, hidden }: HoverCardProps) => {
  const form = hoverCardForm(useValue(AssetMenuHoverCard$));
  const pointed = usePointedAfterDelay();

  useEffect(() => () => clearPointed(), []);

  if (hidden || pointed === null || form !== "pointer") return null;

  return <PointerCard pointed={pointed} boxRef={boxRef} />;
};
