import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_COMPARE_ENTRIES,
  MAX_CATALOG_PAGE_SIZE,
  getCatalogPageSummary,
  hasCatalogScroll,
  isCatalogPaged,
  clearBuildingCatalogMetricRangesCommand,
  clearCompareEntriesCommand,
  locatePrefabCommand,
  nextSortState,
  normalizeCatalogOffset,
  pickerOptionCommand,
  searchChangedCommand,
  setBuildingCatalogMetricRangeCommand,
  setCatalogOffsetCommand,
  setCurrentCategoryCommand,
  setCurrentPrefabCommand,
  setCurrentSubCategoryCommand,
  setSortColumnCommand,
  setSortDescendingCommand,
  toggleCompareEntryCommand,
} from "../src/domain/buildingCatalogContracts.ts";
import {
  METRIC_RANGE_DEFINITIONS,
  countActiveMetricRanges,
  didSwapMetricBounds,
  getInvalidMetricBounds,
  hasMetricRange,
  normalizeMetricRange,
} from "../src/domain/buildingCatalogRanges.ts";
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
    isUniqueMesh: false,
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
  it("keeps catalog helpers semantic while retaining paging commands", () => {
    assert.deepEqual(setCurrentPrefabCommand(17), { type: "activatePrefab", prefabId: 17 });
    assert.deepEqual(setCatalogOffsetCommand(200), { method: "SetBuildingCatalogOffset", args: [200] });
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

  it("addresses the backend-owned compare tray by id", () => {
    // The tray is backend state so it survives the panel unmounting on place;
    // the client sends intent rather than a projected entry.
    assert.deepEqual(toggleCompareEntryCommand(42), { method: "ToggleBuildingCatalogCompare", args: [42] });
    assert.deepEqual(clearCompareEntriesCommand(), { method: "ClearBuildingCatalogCompare", args: [] });
  });

  it("normalizes paging to page boundaries, a 500-item maximum, and the last page", () => {
    assert.equal(normalizeCatalogOffset(-10, 1200, 100), 0);
    assert.equal(normalizeCatalogOffset(250, 501, 100), 200);
    assert.equal(normalizeCatalogOffset(999, 501, 100), 500);
    assert.equal(normalizeCatalogOffset(999, 200, MAX_CATALOG_PAGE_SIZE + 1), 0);
    assert.equal(normalizeCatalogOffset(999, 0, 100), 0);
    assert.equal(normalizeCatalogOffset(Number.NaN, Number.NaN, Number.NaN), 0);
  });

  it("explains the bounded row range and page count", () => {
    assert.equal(getCatalogPageSummary(0, 4206, 100), "Rows 1–100 of 4,206 · Page 1 of 43");
    assert.equal(getCatalogPageSummary(4000, 4206, 100), "Rows 4,001–4,100 of 4,206 · Page 41 of 43");
    assert.equal(getCatalogPageSummary(4200, 4206, 100), "Rows 4,201–4,206 of 4,206 · Page 43 of 43");
    assert.equal(getCatalogPageSummary(0, 0, 100), "Rows 0–0 of 0 · Page 1 of 1");
  });

  it("only advertises a row scrollbar when the page is bounded", () => {
    assert.equal(hasCatalogScroll(4206, 100), true);
    assert.equal(hasCatalogScroll(100, 100), false);
    assert.equal(hasCatalogScroll(0, 0), false);
    assert.equal(hasCatalogScroll(1, 0), true);
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

describe("whether the result is paged at all", () => {
  it("is not paged when everything fits on one page", () => {
    // Every vanilla menu now asks for the 500-row ceiling, and the largest —
    // Landscaping at 366 — fits inside it. A pager there could only report
    // that it has nothing to do, from below a scroll.
    assert.equal(isCatalogPaged(366, 500), false);
    assert.equal(isCatalogPaged(157, 500), false);
    assert.equal(isCatalogPaged(0, 100), false);
    assert.equal(isCatalogPaged(100, 100), false);
  });

  it("is paged the moment one row does not fit", () => {
    assert.equal(isCatalogPaged(101, 100), true);
    // The unscoped catalog, which no page size makes into one thing.
    assert.equal(isCatalogPaged(3667, 100), true);
  });

  it("survives nonsense totals and limits", () => {
    assert.equal(isCatalogPaged(Number.NaN, 100), false);
    assert.equal(isCatalogPaged(-5, 100), false);
    assert.equal(isCatalogPaged(50, Number.NaN), false);
  });
});
