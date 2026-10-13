import { useValue } from "cs2/api";
import { useEffect, useState, type RefObject } from "react";

import { notchLeft } from "domain/notch";
import { useTextScale } from "domain/textScaleSetting";
import { SelectedAssetMenu$ } from "mods/bindings";
import { findLitToolbarButton } from "mods/BuildingMenu/vanillaLayout";
import styles from "./notch.module.scss";

/** How many frames the notch reads the bar after a change: the bar relights its button a frame or two after the binding moves. */
const NOTCH_FRAMES = 10;

export interface NotchProps {
  /** The box, which the notch hangs from. */
  boxRef: RefObject<HTMLElement>;
  /** The box's width as drawn, in rem. */
  boxWidth: number;
  /** The box's offset from the game's slot, which moves it along the bar. */
  offset: number;
}

/**
 * The notch: a small trapezoid under the box, centred on the lit bar button and held inside the
 * box, so the box says whose menu it is. It draws once a frame has found the button, and not at all
 * without one. See docs/design-notes.md, "The notch".
 */
export const Notch = ({ boxRef, boxWidth, offset }: NotchProps) => {
  const selected = useValue(SelectedAssetMenu$);
  const textScale = useTextScale();
  // A resize moves the bar's buttons, whichever side of the screen changes.
  const width = typeof window === "undefined" ? 0 : window.innerWidth;
  const height = typeof window === "undefined" ? 0 : window.innerHeight;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    let handle = 0;
    let cancelled = false;
    let found = false;

    const read = (): number | null => {
      const box = boxRef.current;
      const button = typeof document === "undefined" ? null : findLitToolbarButton(document);

      if (!box || !button) {
        return null;
      }

      const boxRect = box.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      return notchLeft({
        buttonLeftPx: buttonRect.left,
        buttonWidthPx: buttonRect.width,
        boxLeftPx: boxRect.left,
        boxWidth,
        boxWidthPx: boxRect.width,
        innerHeight: height,
      });
    };

    // A few frames, keeping the last good reading: rectangles read zero before layout.
    const step = () => {
      if (cancelled) {
        return;
      }

      const reading = read();

      if (reading !== null) {
        found = true;
        setLeft(reading);
      }

      if (++frame >= NOTCH_FRAMES) {
        if (!found) setLeft(null);
        return;
      }

      handle = requestAnimationFrame(step);
    };

    handle = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [boxRef, boxWidth, offset, selected, textScale, width, height]);

  return left === null ? null : <div className={styles.notch} style={{ left: `${left}rem` }} aria-hidden="true" />;
};
