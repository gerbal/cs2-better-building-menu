/**
 * Estimates corrected from what was actually drawn.
 *
 * Character budgets (tileLabel.ts) and rem column widths (buildingLensLayout
 * .ts) are estimates of how much text a box holds. They were measured at one
 * size; above 1.33px per rem (1440p, ultrawide) text renders 2–3 % wider
 * relative to rem than at 1080p, and a budget that exactly fills its line at
 * 720p spills a few pixels there. No fixed margin fits both ends — twelve at
 * 100rem must stay twelve — so the estimate is corrected from the DOM once
 * the box is laid out, the way the group headings already are
 * (fitLabelToWidth). Both corrections only ever tighten, so measure → correct
 * → measure cannot spiral.
 */

/** The fewest characters a line can carry and still name something. */
const MIN_LINE_BUDGET = 4;

/**
 * A smaller character budget for a line that drew wider than its box.
 * Unchanged when it fits or when the box has not been laid out (0).
 */
export function reduceBudgetToFit(budget: number, availablePx: number, neededPx: number): number {
  if (availablePx <= 0 || neededPx <= 0 || neededPx <= availablePx) {
    return budget;
  }
  // In proportion to the overflow, and by at least one: an overflow of a
  // pixel still means the last character does not fit.
  const proportional = Math.floor(budget * (availablePx / neededPx));
  return Math.max(MIN_LINE_BUDGET, Math.min(budget - 1, proportional));
}

/**
 * The rem a column needs on top of its estimate, from the widest overflow
 * among its cells: whole rem, plus one of slack so the next pixel of
 * rendering variance does not clip again.
 */
export function columnExtraRem(overflowPx: number, remPx: number): number {
  if (overflowPx <= 0 || remPx <= 0) {
    return 0;
  }
  return Math.ceil(overflowPx / remPx) + 1;
}

/**
 * Extras cut down so the columns plus their extras stay within the room
 * beside a name of its minimum width — the same limit the text-scale ratio
 * observes. Shared out in the columns' order until the room runs out.
 */
export function capColumnExtras<K extends string>(
  extras: Readonly<Record<K, number>>,
  columnsRem: number,
  roomRem: number,
): Record<K, number> {
  let left = Math.max(0, roomRem - columnsRem);
  const capped = {} as Record<K, number>;
  for (const key of Object.keys(extras) as K[]) {
    const granted = Math.max(0, Math.min(extras[key], left));
    capped[key] = granted;
    left -= granted;
  }
  return capped;
}
