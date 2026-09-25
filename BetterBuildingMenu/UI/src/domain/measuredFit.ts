/**
 * Estimates corrected from what was actually drawn: a character budget holds
 * at one text size and not at another, and no fixed margin fits both ends. The
 * correction only ever tightens, so correcting cannot spiral.
 */

/** The fewest characters a line can carry and still name something. */
const MIN_LINE_BUDGET = 4;

/**
 * Overflow of a pixel is rounding noise — a fractional rem width lands on a
 * whole pixel either side — and acting on it ratchets a budget to its floor.
 */
const ROUNDING_NOISE_PX = 1;

/**
 * A smaller character budget for a line that drew wider than its box.
 * Unchanged when it fits, or when the box has not been laid out.
 */
export function reduceBudgetToFit(budget: number, availablePx: number, neededPx: number): number {
  if (availablePx <= 0 || neededPx <= 0 || neededPx - availablePx <= ROUNDING_NOISE_PX) {
    return budget;
  }
  // In proportion to the overflow, and by at least one: an overflow of a
  // pixel still means the last character does not fit.
  const proportional = Math.floor(budget * (availablePx / neededPx));
  return Math.max(MIN_LINE_BUDGET, Math.min(budget - 1, proportional));
}

/**
 * The pixels of content drawn past an element's box. Cohtml's scrollWidth
 * matches offsetWidth when nothing overflows and a browser's matches
 * clientWidth, so only content past the LARGER of the two is overflow in both.
 */
export function contentOverflowPx(clientWidth: number, offsetWidth: number, scrollWidth: number): number {
  return Math.max(0, scrollWidth - Math.max(clientWidth, offsetWidth));
}

/** The three widths a drawn line reports; see contentOverflowPx. */
export type DrawnLine = { clientWidth: number; offsetWidth: number; scrollWidth: number };

/** Whether a drawn line's content runs past its box by more than rounding. */
export function overflowsBox(line: DrawnLine): boolean {
  return contentOverflowPx(line.clientWidth, line.offsetWidth, line.scrollWidth) > ROUNDING_NOISE_PX;
}

/**
 * The budget a set of drawn lines allows: the tightest correction any of them
 * asks for. Call it a frame AFTER the render — in the same tick an element
 * reports its PREVIOUS text's width, ratcheting the budget to its floor.
 */
export function lineBudgetFromDrawn(budget: number, lines: readonly DrawnLine[]): number {
  let next = budget;
  for (const line of lines) {
    const box = Math.max(line.clientWidth, line.offsetWidth);
    const needed = box + contentOverflowPx(line.clientWidth, line.offsetWidth, line.scrollWidth);
    next = Math.min(next, reduceBudgetToFit(budget, box, needed));
  }
  return next;
}
