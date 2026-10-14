/**
 * Estimates corrected from what was actually drawn: an advance table holds for
 * one font and not quite for another, and no fixed margin fits both ends. The
 * correction only narrows, and only on a line the estimate said fits: a line
 * the estimate already says overruns is no evidence about the box.
 */

/**
 * Overflow of a pixel is rounding noise — a fractional rem width lands on a
 * whole pixel either side — and acting on it narrows a room for nothing.
 */
const ROUNDING_NOISE_PX = 1;

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

/** What a drawn name's lines may take: its box as drawn, in rem, and the share of it the lines fit in. */
export interface DrawnRoom {
  /** The box's width as drawn; null before it has been laid out. */
  box: number | null;
  /** The share of the box the lines fit in: 1, narrowed by the most a line ran past its box. */
  fit: number;
}

/** A drawn box's width; see contentOverflowPx. */
type DrawnBox = { clientWidth: number };

/** A box width read again, within a hundredth of a rem, is the same width: no new plan for rounding. */
const SAME_WIDTH = 0.01;

/**
 * The room a drawn name's lines may take now: its box as drawn, `remPerPx` rem a pixel, and its fit,
 * narrowed by the most any line ran past its box, in proportion, and never widened; narrowed only
 * where the plan `fitted` its room by the estimate. A box drawn narrower than `widest`, the widest line
 * drawn by the estimate, in rem, is one sized to its lines, which says nothing of the room: the room
 * stays. The same room, the very object, where nothing moved. Call it a frame AFTER the render: in the
 * same tick an element reports its PREVIOUS text's width.
 */
export function drawnRoom(current: DrawnRoom, box: DrawnBox, lines: readonly DrawnLine[], remPerPx: number, fitted = true, widest = 0): DrawnRoom {
  // A rem of no size or of none at all (deviceRem's 0 for an unknown screen) says no width: the estimate stays.
  const drawn = box.clientWidth > 0 && remPerPx > 0 && Number.isFinite(remPerPx) ? box.clientWidth * remPerPx : null;
  const width = drawn !== null && drawn >= widest ? drawn : current.box;
  let fit = current.fit;
  for (const line of fitted ? lines : []) {
    const own = Math.max(line.clientWidth, line.offsetWidth);
    const over = contentOverflowPx(line.clientWidth, line.offsetWidth, line.scrollWidth);
    if (own > 0 && over > ROUNDING_NOISE_PX) fit = Math.min(fit, current.fit * (own / (own + over)));
  }

  const moved = width !== current.box && (width === null || current.box === null || Math.abs(width - current.box) > SAME_WIDTH);
  return moved || fit < current.fit ? { box: width, fit } : current;
}
