/**
 * Where the notch under the box sits: centred on the lit bar button, held inside the box's ends.
 * Pure, so the rule is a test; reading the two rectangles is the Notch's. See docs/design-notes.md,
 * "The notch".
 */
import { NOTCH_TOP_WIDTH } from "./assetMenuLayout";
import { LAYOUT_HEIGHT } from "./sharedContracts.generated";

export interface NotchInput {
  /** The lit bar button's left edge and width, in pixels. */
  buttonLeftPx: number;
  buttonWidthPx: number;
  /** The box's left edge, in pixels. */
  boxLeftPx: number;
  /** The box's width as drawn, in rem. */
  boxWidth: number;
  /** The page's height in pixels: a screen is 1,080 rem tall. */
  innerHeight: number;
}

/** The notch's left edge in the box, in rem, under the button's centre; null while a rectangle reads as unmeasured. */
export function notchLeft({ buttonLeftPx, buttonWidthPx, boxLeftPx, boxWidth, innerHeight }: NotchInput): number | null {
  const measured = [buttonLeftPx, buttonWidthPx, boxLeftPx, boxWidth, innerHeight].every(Number.isFinite);

  if (!measured || buttonWidthPx <= 0 || innerHeight <= 0) {
    return null;
  }

  const centre = ((buttonLeftPx + buttonWidthPx / 2 - boxLeftPx) * LAYOUT_HEIGHT) / innerHeight;

  return Math.min(Math.max(0, centre - NOTCH_TOP_WIDTH / 2), Math.max(0, boxWidth - NOTCH_TOP_WIDTH));
}
