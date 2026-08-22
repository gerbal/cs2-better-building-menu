import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { allTabTotal } from "../src/domain/vanillaMenuCategories.ts";

/**
 * cm-2xvs.23: the strip's "All" chip must be the size of the result set.
 *
 * Measured in the 105-pack scale run: unscoped the page held 10,528 assets,
 * the development axis had tabs for 716 of them, and the chip — built by
 * summing those tabs — said 716.
 */
describe("The All chip's total", () => {
  it("takes the category table, not the tabs beside it", () => {
    // The real shape of the bug: an axis that covers part of the scope, and a
    // category table that covers all of it.
    const counts = [
      { id: "", count: 9812 },
      { id: "TransportationRoad", count: 400 },
      { id: "PropsNature", count: 316 },
    ];
    const branchTabs = [{ count: 400 }, { count: 316 }];

    assert.equal(allTabTotal(counts, branchTabs), 10528);
    // And not the number the tabs add up to.
    assert.notEqual(allTabTotal(counts, branchTabs), 716);
  });

  it("falls back to the tabs only until the counts arrive", () => {
    // One frame, on the way in. A stale-but-close number beats a blank.
    assert.equal(allTabTotal([], [{ count: 12 }, { count: 30 }]), 42);
    assert.equal(allTabTotal(null, [{ count: 7 }]), 7);
  });

  it("is zero rather than NaN when there is nothing at all", () => {
    assert.equal(allTabTotal([], []), 0);
    assert.equal(allTabTotal(null, null), 0);
  });

  it("counts the unnamed remainder like any other row", () => {
    // The row for assets answering to no category. It draws no tab — the strip
    // iterates the menu's category list — but it is most of the catalogue
    // unscoped, and All has to include it.
    assert.equal(allTabTotal([{ id: "", count: 5 }], []), 5);
  });
});
