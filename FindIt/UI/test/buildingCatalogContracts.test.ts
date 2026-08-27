import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCatalogWindowSummary,
  clearBuildingCatalogMetricRangesCommand,
  locatePrefabCommand,
  nextSortState,
  pickerOptionCommand,
  searchChangedCommand,
  setBuildingCatalogMetricRangeCommand,
  loadMoreCatalogCommand,
  setCurrentCategoryCommand,
  setCurrentPrefabCommand,
  setCurrentSubCategoryCommand,
  setSortColumnCommand,
  setSortDescendingCommand,
} from "../src/domain/buildingCatalogContracts.ts";
import {
  METRIC_RANGE_DEFINITIONS,
  countActiveMetricRanges,
  didSwapMetricBounds,
  getInvalidMetricBounds,
  hasMetricRange,
  normalizeMetricRange,
} from "../src/domain/buildingCatalogRanges.ts";
import { FALLBACK_SEPARATORS, groupDigits } from "../src/domain/buildingLensMetricFormat.ts";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog.ts";

function entry(id: number): BuildingCatalogEntry {
  return {
    id,
    prefabName: `Prefab${id}`,
    name: `Building ${id}`,
    category: "Buildings",
    subCategory: "Industrial",
    thumbnail: "",
    lotWidth: 4,
    lotDepth: 4,
    buildingLevel: 1,
    zoneType: 0,
    hasParking: id % 2 === 0,
    isVanilla: true,
    isFavorited: false,
    pdxModsId: "",
    constructionCost: 100,
    upkeep: 10,
    workers: 5,
    capacity: 20,
    electricityConsumption: null,
    waterConsumption: null,
    garbageAccumulation: null,
    waterCapacity: null,
    sewageCapacity: null,
    groundPollution: null,
    airPollution: null,
    noisePollution: null,
  };
}

describe("FindItBuildingMenu UI binding contracts", () => {
  it("keeps catalog helpers semantic while naming the window command", () => {
    assert.deepEqual(setCurrentPrefabCommand(17), { type: "activatePrefab", prefabId: 17 });
    // No argument: the backend owns the window's size, its step and its
    // ceiling, so a client naming the next size would be a second opinion on
    // all three. The name must match the CreateTrigger in FindItUISystem.Setup.
    assert.deepEqual(loadMoreCatalogCommand(), { method: "LoadMoreBuildingCatalog", args: [] });
    assert.deepEqual(locatePrefabCommand(17), { type: "locatePrefab", prefabId: 17 });
    assert.deepEqual(pickerOptionCommand(1.5, -2, 3), { type: "pickerOption", sectionId: 1.5, optionId: -2, value: 3 });
  });

  it("keeps search and category/subcategory payloads aligned with the C# bindings", () => {
    assert.deepEqual(searchChangedCommand("road"), { method: "SearchChanged", args: ["road"] });
    assert.deepEqual(setCurrentCategoryCommand(4), { method: "SetCurrentCategory", args: [4] });
    assert.deepEqual(setCurrentSubCategoryCommand(12), { method: "SetCurrentSubCategory", args: [12] });
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

  it("normalizes analytical metric ranges and swaps reversed bounds", () => {
    assert.deepEqual(normalizeMetricRange("cost", { minText: "500", maxText: "100" }), { min: 100, max: 500 });
    assert.deepEqual(normalizeMetricRange("capacity", { minText: "12.345", maxText: "9000000000" }), {
      min: 12.35,
      max: 1_000_000_000,
    });
    assert.deepEqual(normalizeMetricRange("lotWidth", { minText: "3.8", maxText: "1.2" }), { min: 1, max: 4 });
    assert.deepEqual(normalizeMetricRange("workers", { minText: "", maxText: "not-a-number" }), { min: null, max: null });
    assert.deepEqual(normalizeMetricRange("upkeep", { minText: "-10", maxText: "2" }), { min: 0, max: 2 });
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
    // The old behaviour dropped this silently while leaving it on screen, so a
    // typo was indistinguishable from an applied filter.
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

describe("how much of the match set is on screen", () => {
  const summarize = (rendered: number, total: number) =>
    getCatalogWindowSummary(rendered, total, FALLBACK_SEPARATORS);

  it("states the rendered count against the whole match set", () => {
    assert.equal(summarize(100, 3677), "Showing 100 of 3\u00a0677");
    assert.equal(summarize(3677, 3677), "Showing 3\u00a0677 of 3\u00a0677");
    assert.equal(summarize(0, 0), "Showing 0 of 0");
  });

  it("groups digits exactly as the metric cells do", () => {
    // This module cannot import groupDigits — see the note on groupCount — so
    // the agreement it would have guaranteed is asserted instead.
    for (const count of [999, 1000, 4206, 12345, 1234567]) {
      assert.equal(
        summarize(count, count),
        `Showing ${groupDigits(count, FALLBACK_SEPARATORS)} of ${groupDigits(count, FALLBACK_SEPARATORS)}`,
      );
    }
  });

  it("groups digits itself instead of calling toLocaleString", () => {
    // toLocaleString groups in Node and does nothing in Cohtml, so the page
    // summary this replaces passed its test while the game rendered "4206".
    const summary = summarize(1200, 4206);

    assert.equal(summary.includes("4206"), false);
    assert.equal(summary.includes("1200"), false);
  });

  it("uses the separator the rest of the screen is using", () => {
    assert.equal(getCatalogWindowSummary(1200, 4206, { group: ",", decimal: "." }), "Showing 1,200 of 4,206");
    assert.equal(getCatalogWindowSummary(1200, 4206, { group: ".", decimal: "," }), "Showing 1.200 of 4.206");
  });

  it("never claims to show more than exists", () => {
    // The rendered rows and the total arrive in the same page, but a narrowed
    // predicate can shrink the total while the old rows are still mounted.
    assert.equal(summarize(500, 120), "Showing 120 of 120");
  });

  it("survives nonsense counts", () => {
    assert.equal(summarize(Number.NaN, Number.NaN), "Showing 0 of 0");
    assert.equal(summarize(-5, 100), "Showing 0 of 100");
    assert.equal(summarize(100.7, 3677.2), "Showing 100 of 3\u00a0677");
  });
});

describe("the count badge in the header", () => {
  it("stays short enough for a fixed-width pill", async () => {
    const { getCatalogWindowBadge } = await import("../src/domain/buildingCatalogContracts.ts");
    const separators = { group: ",", decimal: "." };

    // The pill is flex: 0 0 auto with nowrap, between the title and the search
    // context. A sentence in it shoved both sideways.
    assert.equal(getCatalogWindowBadge(100, 401, separators), "100 / 401");
    assert.equal(getCatalogWindowBadge(1200, 4206, separators), "1,200 / 4,206");
  });

  it("drops to one figure once the window covers everything", async () => {
    const { getCatalogWindowBadge } = await import("../src/domain/buildingCatalogContracts.ts");
    const separators = { group: ",", decimal: "." };

    // "401 / 401" asks the reader to compare two numbers to learn they match.
    assert.equal(getCatalogWindowBadge(401, 401, separators), "401");
    assert.equal(getCatalogWindowBadge(0, 0, separators), "0");
  });
});
