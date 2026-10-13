import { useEffect, useState, type RefObject } from "react";
import { measuredSlotLeft } from "domain/widthSteps";

/** Frames to wait for the slot's first layout before the centred fallback stands for good. */
const SLOT_READ_MAX_FRAMES = 30;

const windowSize = (): [number, number] => (typeof window === "undefined" ? [0, 0] : [window.innerWidth, window.innerHeight]);

/**
 * Where the game's slot for its build menu starts, in rem, read off the element the row sits in:
 * the slot's rem width follows the pixel ratio, so no constant places the box on every screen.
 * Undefined until it reads. Read again when the screen or the text scale changes, which re-render
 * the menu, and only once two frames agree: the frame after a change can still hold the last layout.
 * See docs/design-notes.md, "The box at its Width step, and the control pane".
 */
export function useGameSlotLeft(rowRef: RefObject<HTMLElement>, textScale: number): number | undefined {
  const [slotLeft, setSlotLeft] = useState<number | undefined>(undefined);
  const [width, height] = windowSize();

  useEffect(() => {
    let frame = 0;
    let handle = 0;
    let cancelled = false;
    let last: number | null = null;

    const read = () => {
      const row = rowRef.current;

      if (cancelled || !row) {
        return;
      }

      const reading = measuredSlotLeft(row.parentElement?.getBoundingClientRect?.(), windowSize()[1]);

      if (reading !== null && reading === last) {
        setSlotLeft(reading);
        return;
      }

      last = reading;

      if (frame++ < SLOT_READ_MAX_FRAMES) {
        handle = requestAnimationFrame(read);
      }
    };

    read();

    return () => {
      cancelled = true;
      if (handle) cancelAnimationFrame(handle);
    };
  }, [rowRef, width, height, textScale]);

  return slotLeft;
}
