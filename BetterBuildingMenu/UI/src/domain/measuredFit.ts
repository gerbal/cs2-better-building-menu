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
 * The rem a column needs on top of its estimate, from the widest overflow
 * among its cells: whole rem, plus one of slack so the next pixel of
 * rendering variance does not clip again.
 */
export function columnExtraRem(overflowPx: number, remPx: number): number {
  if (overflowPx <= ROUNDING_NOISE_PX || remPx <= 0) {
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

/**
 * The extras after one measurement, or null when nothing would change.
 *
 * Null matters: the measuring effect sets state from this, and setting an
 * equal-but-new object re-renders, re-measures and sets again without end —
 * the first version of it blocked the UI thread and froze the game. Only a
 * column that overflowed grows, by columnExtraRem on top of what it had, and
 * the whole is capped at the room beside the name; if the cap gives back
 * exactly what was there, that is no change.
 */
export function mergeColumnExtras<K extends string>(
  current: Readonly<Partial<Record<K, number>>>,
  overflowPx: Readonly<Partial<Record<K, number>>>,
  remPx: number,
  columnsRem: number,
  roomRem: number,
): Record<K, number> | null {
  const wanted = { ...current } as Record<K, number>;
  let grew = false;
  for (const key of Object.keys(overflowPx) as K[]) {
    const extra = (current[key] ?? 0) + columnExtraRem(overflowPx[key] ?? 0, remPx);
    if (extra > (current[key] ?? 0)) {
      wanted[key] = extra;
      grew = true;
    }
  }
  if (!grew) return null;
  const capped = capColumnExtras(wanted, columnsRem, roomRem);
  const changed = (Object.keys(capped) as K[]).some((key) => capped[key] !== (current[key] ?? 0));
  return changed ? capped : null;
}
