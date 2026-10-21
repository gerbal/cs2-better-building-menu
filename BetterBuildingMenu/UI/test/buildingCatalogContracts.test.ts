import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSortState } from "../src/domain/buildingCatalogContracts.ts";
import {
  clearBuildingCatalogMetricRangesCommand,
  searchChangedCommand,
  setBuildingCatalogMetricRangeCommand,
  loadMoreCatalogCommand,
  setSortColumnCommand,
  setSortDescendingCommand,
} from "../src/domain/commands.ts";
import {
  BOUND_KEYS,
  METRIC_RANGE_DEFINITIONS,
  countActiveMetricRanges,
  describeRange,
  didSwapMetricBounds,
  getInvalidMetricBounds,
  hasMetricRange,
} from "../src/domain/buildingCatalogRanges.ts";
import { FALLBACK_SEPARATORS } from "../src/domain/assetMenuMetricFormat.ts";

// A comma-decimal locale that groups with a full stop, as German does.
const german = { ...FALLBACK_SEPARATORS, group: ".", decimal: "," };
const english = { ...FALLBACK_SEPARATORS, group: ",", decimal: "." };

describe("BetterBuildingMenu UI binding contracts", () => {
  it("names the window command after its trigger", () => {
    // The limit wanted, so a repeat is harmless; the backend clamps it to one step
    // and the ceiling. The name must match the CreateTrigger in BuildingMenuUISystem.OnCreate.
    assert.deepEqual(loadMoreCatalogCommand(200), { method: "LoadMoreBuildingCatalog", args: [200] });
  });

  it("keeps the search payload aligned with the C# binding", () => {
    assert.deepEqual(searchChangedCommand("road"), { method: "SearchChanged", args: ["road"] });
  });

  it("resets direction for a new sort column and toggles repeated clicks", () => {
    assert.deepEqual(nextSortState({ column: "Name", descending: true }, "ConstructionCost"), {
      column: "ConstructionCost",
      descending: false,
    });
    assert.deepEqual(nextSortState({ column: "ConstructionCost", descending: false }, "ConstructionCost"), {
      column: "ConstructionCost",
      descending: true,
    });
    assert.deepEqual(setSortColumnCommand("Workers"), { method: "SetBuildingCatalogSortColumn", args: ["Workers"] });
    assert.deepEqual(setSortDescendingCommand(true), { method: "SetBuildingCatalogSortDescending", args: [true] });
  });

  it("judges a swap on the bounds as clamped and rounded, not as typed", () => {
    // Lot sizes are whole cells: 3.8 and 1.2 are 4 and 1, and 1.6 and 1.5 are
    // both 2, so only the first pair was reversed.
    assert.equal(didSwapMetricBounds("lotWidth", { minText: "3.8", maxText: "1.2" }), true);
    assert.equal(didSwapMetricBounds("lotWidth", { minText: "1.6", maxText: "1.5" }), false);
    // Two decimals elsewhere: both of these are 12.35.
    assert.equal(didSwapMetricBounds("capacity", { minText: "12.349", maxText: "12.346" }), false);
    // Clamped to the metric's range: both are 0, and both are the ceiling.
    assert.equal(didSwapMetricBounds("upkeep", { minText: "-10", maxText: "-20" }), false);
    assert.equal(didSwapMetricBounds("capacity", { minText: "9000000000", maxText: "2000000000" }), false);
    assert.equal(didSwapMetricBounds("workers", { minText: "", maxText: "not-a-number" }), false);
  });

  it("keeps metric range definitions bounded and reports active selections", () => {
    assert.deepEqual(METRIC_RANGE_DEFINITIONS.map((definition) => definition.id), [
      "cost",
      "upkeep",
      "workers",
      "capacity",
      "lotWidth",
      "lotDepth",
    ]);
    assert.equal(hasMetricRange({ min: null, max: null }), false);
    assert.equal(hasMetricRange({ min: 0, max: null }), true);
    assert.equal(hasMetricRange({ min: null, max: 20 }), true);
    assert.equal(
      countActiveMetricRanges({
        cost: { min: 0, max: null },
        upkeep: { min: null, max: null },
        workers: { min: null, max: 20 },
        capacity: { min: null, max: null },
        lotWidth: { min: null, max: null },
        lotDepth: { min: null, max: null },
      }),
      2,
    );
  });

  it("lists every bound the range state carries, a minimum then a maximum per metric", () => {
    // The drawer keys its effects on these and builds its empty state from them:
    // a key missing here is a bound the drawer would never re-seed from.
    assert.deepEqual(BOUND_KEYS, [
      "minCost", "maxCost",
      "minUpkeep", "maxUpkeep",
      "minWorkers", "maxWorkers",
      "minCapacity", "maxCapacity",
      "minLotWidth", "maxLotWidth",
      "minLotDepth", "maxLotDepth",
    ]);
  });

  it("describes a range in the player's own number marks", () => {
    assert.equal(describeRange(1234.5, 98765, german), "1.234,5–98.765");
    assert.equal(describeRange(1234.5, null, german), "≥ 1.234,5");
    assert.equal(describeRange(null, 0.25, german), "≤ 0,25");
  });

  it("describes a range in the marks English players get from the game", () => {
    assert.equal(describeRange(1000, 5000, english), "1,000–5,000");
    assert.equal(describeRange(1234.5, 98765, english), "1,234.5–98,765");
    assert.equal(describeRange(1234.5, null, english), "≥ 1,234.5");
    assert.equal(describeRange(null, 0.25, english), "≤ 0.25");
  });

  it("groups by hand with the fallback marks when the game has given none", () => {
    // A no-break space, as every figure the menu draws without the game's dictionary.
    assert.equal(describeRange(1000, 5000), "1\u00a0000–5\u00a0000");
    assert.equal(describeRange(3.8, null), "≥ 3.8");
  });

  it("describes nothing when neither bound is set", () => {
    assert.equal(describeRange(null, null), "");
  });

  it("builds metric range set and clear payloads", () => {
    assert.deepEqual(setBuildingCatalogMetricRangeCommand("capacity", "100", "500"), {
      method: "SetBuildingCatalogMetricRange",
      args: ["capacity", "100", "500"],
    });
    assert.deepEqual(clearBuildingCatalogMetricRangesCommand(), {
      method: "ClearBuildingCatalogMetricRanges",
      args: [],
    });
  });
  it("flags typed text that will never become a bound", () => {
    // Dropped silently while left on screen, a typo is indistinguishable from
    // an applied filter.
    assert.deepEqual(getInvalidMetricBounds("cost", { minText: "abc", maxText: "500" }), { min: true, max: false });
    assert.deepEqual(getInvalidMetricBounds("cost", { minText: "", maxText: "" }), { min: false, max: false });
    assert.deepEqual(getInvalidMetricBounds("cost", { minText: "100", maxText: "20 000" }), { min: false, max: true });
  });

  it("reports when reversed bounds were silently swapped", () => {
    assert.equal(didSwapMetricBounds("cost", { minText: "500", maxText: "100" }), true);
    assert.equal(didSwapMetricBounds("cost", { minText: "100", maxText: "500" }), false);
    assert.equal(didSwapMetricBounds("cost", { minText: "", maxText: "500" }), false);
  });
});
