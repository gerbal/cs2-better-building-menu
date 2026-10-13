/**
 * Where the catalog's list goes when a page lands. Pure, so every rule is a test; the frame loop that
 * carries a move out is useScrollAnchor's. See docs/design-notes.md, "Opening on the building's tab".
 */

/** A move: the list to its top, a row onto line 1, a row brought back into view, or nothing. */
export type ListScroll =
  | { kind: "none" }
  | { kind: "top"; start: number }
  | { kind: "lineOne"; start: number; id: number }
  | { kind: "restore"; id: number };

/** A start's move: the list to its top or a row onto line 1. */
export type StartMove = Extract<ListScroll, { kind: "top" | "lineOne" }>;

export interface ListScrollInput {
  /** Which start of the list the page answers, or null before C# sends one. */
  listStart: number | null;
  /** The start the list was last put in place for, kept across a remount. */
  positioned: number | null;
  /** The row the list starts at, as an entry id, or 0 for none. */
  anchorId: number;
  /** That row's place in the result, or -1 when the result does not hold it. */
  anchorIndex: number;
  /** How many rows the page holds, from the first. */
  itemCount: number;
  /** The row last armed or put on line 1 in this list, kept across a remount. */
  stored: number | null;
  /** Whether this mount has put the list in place already. */
  settled: boolean;
  /** The start's move still running when the page lands, or null. */
  underWay: StartMove | null;
}

const NONE: ListScroll = { kind: "none" };

/**
 * Whether the page answers a start the list has not been put in place for yet: its move is still to
 * come or under way, and the scroll the list reads is the last start's.
 */
export function isNewStart(listStart: number | null, positioned: number | null): boolean {
  return listStart !== null && listStart !== positioned;
}

/**
 * A new start (an open, a tab pick, a sort) puts the anchored row on line 1 when the window holds it,
 * and the list at its top otherwise; a remount brings the kept row back once; anything else (a
 * search, a filter, more rows) leaves the list where the player has it. The start's first page with
 * rows decides its move: a later page of that start, whose anchor a search or a filter cleared,
 * carries the move under way on.
 */
export function planListScroll(input: ListScrollInput): ListScroll {
  if (input.itemCount <= 0) {
    return NONE;
  }

  if (input.listStart !== null && isNewStart(input.listStart, input.positioned)) {
    if (input.underWay?.start === input.listStart) {
      return input.underWay;
    }

    const held = input.anchorId > 0 && input.anchorIndex >= 0 && input.anchorIndex < input.itemCount;

    return held ? { kind: "lineOne", start: input.listStart, id: input.anchorId } : { kind: "top", start: input.listStart };
  }

  return !input.settled && input.stored !== null ? { kind: "restore", id: input.stored } : NONE;
}
