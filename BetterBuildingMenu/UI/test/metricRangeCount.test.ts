import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countActiveMetricRanges,
  hasMetricRange,
  metricRangesFromState,
} from "../src/domain/buildingCatalogRanges.ts";

// One count for the rail's badge and the drawer's, in the unit the chips use:
// a range is one filter however many of its ends are set.
const count = (state: Record<string, unknown> | null | undefined) =>
  countActiveMetricRanges(metricRangesFromState(state as never));

describe("counting active metric ranges", () => {
  it("counts a range once, whichever of its ends are set", () => {
    assert.equal(count({ minCost: 10, maxCost: 20, hasSelection: true }), 1);
    assert.equal(count({ minCost: 10, maxCost: null, hasSelection: true }), 1);
    assert.equal(count({ minCost: 10, maxWorkers: 5, hasSelection: true }), 2);
  });

  it("treats zero as a real bound rather than an empty one", () => {
    // "at most 0 workers" is a legitimate filter.
    assert.equal(count({ maxWorkers: 0, hasSelection: true }), 1);
  });

  it("does not count the hasSelection flag that travels with the bounds", () => {
    assert.equal(count({ hasSelection: true }), 0);
    assert.equal(count({ hasSelection: false }), 0);
  });

  it("survives absent state", () => {
    assert.equal(count(null), 0);
    assert.equal(count(undefined), 0);
  });

  it("reads a missing range as unset", () => {
    assert.equal(hasMetricRange(undefined), false);
    assert.equal(hasMetricRange(null), false);
  });
});
