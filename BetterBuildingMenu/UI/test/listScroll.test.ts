import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planListScroll, type ListScrollInput } from "../src/domain/listScroll.ts";

describe("where the list goes when a page lands", () => {
  // A page for start 2 with Highways' road 150 at row 149, on a list last put in place for start 1.
  const page = (over: Partial<ListScrollInput> = {}): ListScrollInput => ({
    listStart: 2,
    positioned: 1,
    anchorId: 150,
    anchorIndex: 149,
    itemCount: 250,
    stored: null,
    settled: false,
    ...over,
  });

  it("puts the anchored row on line 1 at a new start", () => {
    assert.deepEqual(planListScroll(page()), { kind: "lineOne", start: 2, id: 150 });
  });

  it("starts at the top when the start has no anchor or the result does not hold it", () => {
    assert.deepEqual(planListScroll(page({ anchorId: 0, anchorIndex: -1 })), { kind: "top", start: 2 });
    assert.deepEqual(planListScroll(page({ anchorIndex: -1 })), { kind: "top", start: 2 });
  });

  it("starts at the top when the start names no row, whatever place the page gives it", () => {
    assert.deepEqual(planListScroll(page({ anchorId: 0 })), { kind: "top", start: 2 });
  });

  it("starts at the top when the anchored row is past the rows the window holds", () => {
    // Past the 2,000-row ceiling: the list says it stops, and starts at its first row.
    assert.deepEqual(planListScroll(page({ anchorIndex: 2499, itemCount: 2000 })), { kind: "top", start: 2 });
  });

  it("leaves the list alone for a page with no new start once this mount is in place", () => {
    // A search, a filter, a grouping or more rows: the player's place stays.
    assert.deepEqual(planListScroll(page({ positioned: 2, settled: true, stored: 150 })), { kind: "none" });
    assert.deepEqual(planListScroll(page({ positioned: 2 })), { kind: "none" });
  });

  it("brings the kept row back on a remount", () => {
    assert.deepEqual(planListScroll(page({ positioned: 2, stored: 77 })), { kind: "restore", id: 77 });
  });

  it("waits for rows before it moves anything", () => {
    // During a load the page holds nothing yet; the start is put in place once its rows arrive.
    assert.deepEqual(planListScroll(page({ itemCount: 0 })), { kind: "none" });
  });

  it("treats a page from before the starts as no start", () => {
    assert.deepEqual(planListScroll(page({ listStart: null, stored: 77 })), { kind: "restore", id: 77 });
    assert.deepEqual(planListScroll(page({ listStart: null })), { kind: "none" });
  });
});
