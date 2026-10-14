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
  /** The box's width as drawn, in rem: the span the notch stays in until the box's rectangle measures it. */
  boxWidth: number;
  /** The box's rectangle's width, in pixels: the span the notch stays in once it reads above zero. */
  boxWidthPx?: number;
  /** The page's height in pixels: a screen is 1,080 rem tall. */
  innerHeight: number;
}

/** The notch's left edge in the box, in rem, under the button's centre; null while a rectangle reads as unmeasured. */
export function notchLeft({ buttonLeftPx, buttonWidthPx, boxLeftPx, boxWidth, boxWidthPx, innerHeight }: NotchInput): number | null {
  const measured = [buttonLeftPx, buttonWidthPx, boxLeftPx, boxWidth, innerHeight].every(Number.isFinite);

  if (!measured || buttonWidthPx <= 0 || innerHeight <= 0) {
    return null;
  }

  const toRem = (pixels: number) => (pixels * LAYOUT_HEIGHT) / innerHeight;
  const span = boxWidthPx !== undefined && Number.isFinite(boxWidthPx) && boxWidthPx > 0 ? toRem(boxWidthPx) : boxWidth;
  const centre = toRem(buttonLeftPx + buttonWidthPx / 2 - boxLeftPx);

  return Math.min(Math.max(0, centre - NOTCH_TOP_WIDTH / 2), Math.max(0, span - NOTCH_TOP_WIDTH));
}
