import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";

import { TAB_CELL_GAP } from "domain/assetMenuLayout";
import { deviceRem } from "domain/bodyGeometry";
import type { StatusDrawn, StatusLine } from "domain/hoverCard";

/** The readout as the game drew it at one text scale and box width: the room the tabs leave it, and its texts. */
export interface DrawnReadout {
  at: string;
  /** In rem; null before the row has been laid out. */
  room: number | null;
  drawn: StatusDrawn;
}

/** A width read again, within a hundredth of a rem, is the same width. */
const SAME_WIDTH = 0.01;

const sameWidths = (one: ReadonlyMap<string, number>, other: ReadonlyMap<string, number>): boolean =>
  one.size === other.size && [...one].every(([text, width]) => Math.abs((other.get(text) ?? Number.NaN) - width) <= SAME_WIDTH);

const sameReadout = (one: DrawnReadout, other: DrawnReadout): boolean =>
  one.at === other.at
  && (one.room === null ? other.room === null : other.room !== null && Math.abs(one.room - other.room) <= SAME_WIDTH)
  && (one.drawn.sep === null ? other.drawn.sep === null : other.drawn.sep !== null && Math.abs(one.drawn.sep - other.drawn.sep) <= SAME_WIDTH)
  && one.drawn.pixel === other.drawn.pixel
  && sameWidths(one.drawn.names, other.drawn.names) && sameWidths(one.drawn.figures, other.drawn.figures);

export interface DrawnReadoutRefs {
  /** The row, whose width the tabs and the readout share. */
  row: RefObject<HTMLDivElement>;
  /** The tabs, whose own width is what they take of it, however the row shrinks them. */
  cells: RefObject<HTMLDivElement>;
  /** Status line only's texts, drawn unseen in the readout's faces: the name, a "·", then each figure. */
  measure: RefObject<HTMLSpanElement>;
}

/**
 * Status line only's room and texts as the game drew them, into `onRead`: the room the tabs leave the
 * readout (the row's width less the tabs' own and the two gaps before the readout) and each text `status`
 * could say, drawn unseen. Read two frames after what it could say changes, never in the render's tick,
 * and again when the row or the tabs change size, for `at`: the text scale, the box width, and the row's
 * tabs and their counts in their form. A reading for another `at` is none (`drawnAt`), so another menu's
 * row never lends this one its room, and the estimates stand in. See docs/design-notes.md, "The hover card".
 */
export function useDrawnReadout(status: StatusLine | null, at: string, onRead: Dispatch<SetStateAction<DrawnReadout | null>>): DrawnReadoutRefs {
  const row = useRef<HTMLDivElement>(null);
  const cells = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  // What the readout could say, as one text: it is read again only when that changes.
  const says = status === null ? null : `${status.name}\u0001${status.figures.join("\u0002")}`;
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const rowBox = row.current;
    const tabs = cells.current;
    if (says === null || !rowBox || !tabs) return undefined;
    let outer = 0;
    let inner = 0;
    const readNow = () => {
      const rem = deviceRem(window.innerHeight);
      const shown = statusRef.current;
      const texts = measure.current;
      if (!(rem > 0) || shown === null || !texts) return;
      // The tabs' own width, as the row shrinks them to the readout: Cohtml's scrollWidth holds what runs past.
      // Whole pixels, each reading up to one off: a pixel less, as each text drawn counts one more.
      const room = rowBox.clientWidth > 0 ? (rowBox.clientWidth - Math.max(tabs.offsetWidth, tabs.scrollWidth) - 1) * rem - 2 * TAB_CELL_GAP : null;
      const [name, sep, ...figures] = Array.from(texts.children) as HTMLElement[];
      // A text of no width has not been laid out: the estimate stands in for it.
      const width = (element: HTMLElement | undefined) => (element !== undefined && element.offsetWidth > 0 ? element.offsetWidth * rem : null);
      const named = width(name);
      const next: DrawnReadout = {
        at,
        room,
        drawn: {
          names: new Map(named === null ? [] : [[shown.name, named]]),
          figures: new Map(shown.figures.flatMap((figure, index) => {
            const drawn = width(figures[index]);
            return drawn === null ? [] : [[figure, drawn] as const];
          })),
          sep: width(sep),
          pixel: rem,
        },
      };
      onRead((last) => (last !== null && sameReadout(last, next) ? last : next));
    };
    const schedule = () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(readNow);
      });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(rowBox);
    observer?.observe(tabs);
    schedule();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [says, at, onRead]);

  return { row, cells, measure };
}

/** A reading of the readout, where it was read at `at`; else none. */
export function drawnAt(read: DrawnReadout | null, at: string): DrawnReadout | null {
  return read !== null && read.at === at ? read : null;
}
