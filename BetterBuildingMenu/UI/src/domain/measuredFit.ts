/**
 * Estimates corrected from what was actually drawn.
 *
 * Character budgets (tileLabel.ts) are estimates of how much text a box
 * holds. They were measured at one
 * size; above 1.33px per rem (1440p, ultrawide) text renders 2–3 % wider
 * relative to rem than at 1080p, and a budget that exactly fills its line at
 * 720p spills a few pixels there. No fixed margin fits both ends — twelve at
 * 100rem must stay twelve — so the estimate is corrected from the DOM once
 * the box is laid out, the way the group headings already are
 * (fitLabelToWidth). The correction only ever tightens, so measure → correct
 * → measure cannot spiral. (The table's columns were given the same
 * treatment and it was withdrawn — see BuildingCatalog.tsx.)
 */

/** The fewest characters a line can carry and still name something. */
const MIN_LINE_BUDGET = 4;

/**
 * A smaller character budget for a line that drew wider than its box.
 * Unchanged when it fits or when the box has not been laid out (0).
 */
/**
 * Overflow of a pixel is rounding noise — a fractional rem width lands on a
 * whole pixel either side — and is not acted on. Counted, it grew the
 * table's first column by two rem a cycle until it had eaten the whole
 * room (measured live at 1440p, 2026-09-09).
 */
const ROUNDING_NOISE_PX = 1;

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
 * The pixels of content drawn past an element's box.
 *
 * Cohtml's scrollWidth equals offsetWidth when nothing overflows and
 * clientWidth excludes the border, so scrollWidth − clientWidth is never zero
 * on a bordered cell: every table cell at 1440p reported its 2px border as
 * overflow and the measuring effect kept "fixing" it. A browser keeps
 * scrollWidth at clientWidth when nothing overflows. Both agree that content
 * past the larger of the two widths is overflow.
 */
export function contentOverflowPx(clientWidth: number, offsetWidth: number, scrollWidth: number): number {
  return Math.max(0, scrollWidth - Math.max(clientWidth, offsetWidth));
}

/** The three widths a drawn line reports; see contentOverflowPx. */
export type DrawnLine = { clientWidth: number; offsetWidth: number; scrollWidth: number };

/**
 * The budget a set of drawn lines allows: the tightest correction any line
 * asks for, or the budget itself when every line fits. A line with no box
 * has not been laid out and says nothing.
 *
 * Read only what Cohtml has laid out. An element whose text just changed
 * reports the PREVIOUS text's scrollWidth in the same tick (measured
 * 2026-09-09: 171px for a name already replaced by one that draws at 64px),
 * so a caller that reads in the tick of the render sees the old overflow
 * again and again, and this function will keep saying "shrink" until the
 * floor. Read a frame after the render, not in it.
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
