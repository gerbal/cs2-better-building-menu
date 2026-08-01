import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_COMPARE_ENTRIES,
  MAX_CATALOG_PAGE_SIZE,
  locatePrefabCommand,
  nextSortState,
  normalizeCatalogOffset,
  pickerOptionCommand,
  removeCompareEntry,
  searchChangedCommand,
  setBuildingCapacityFloorCommand,
  setCatalogOffsetCommand,
  setCurrentCategoryCommand,
  setCurrentPrefabCommand,
  setCurrentSubCategoryCommand,
  setSortColumnCommand,
  setSortDescendingCommand,
  toggleCompareEntry,
} from "../src/domain/buildingCatalogContracts.ts";
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

  it("keeps the Education capacity-floor filter bounded and typed", () => {
    assert.deepEqual(setBuildingCapacityFloorCommand(500), { method: "SetBuildingCapacityFloor", args: [500] });
    assert.deepEqual(setBuildingCapacityFloorCommand(-10), { method: "SetBuildingCapacityFloor", args: [0] });
    assert.deepEqual(setBuildingCapacityFloorCommand(10001), { method: "SetBuildingCapacityFloor", args: [10000] });
    assert.deepEqual(setBuildingCapacityFloorCommand(Number.NaN), { method: "SetBuildingCapacityFloor", args: [0] });
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

  it("bounds compare state to three unique entries and allows removal", () => {
    const first = entry(1);
    const second = entry(2);
    const third = entry(3);
    const fourth = entry(4);
    let selected = toggleCompareEntry([], first);
    selected = toggleCompareEntry(selected, second);
    selected = toggleCompareEntry(selected, third);
    assert.equal(selected.length, MAX_COMPARE_ENTRIES);
    assert.deepEqual(toggleCompareEntry(selected, fourth), selected);
    assert.deepEqual(toggleCompareEntry(selected, second).map((item) => item.id), [1, 3]);
    assert.deepEqual(removeCompareEntry(selected, 1).map((item) => item.id), [2, 3]);
  });

  it("normalizes paging to page boundaries, a 500-item maximum, and the last page", () => {
    assert.equal(normalizeCatalogOffset(-10, 1200, 100), 0);
    assert.equal(normalizeCatalogOffset(250, 501, 100), 200);
    assert.equal(normalizeCatalogOffset(999, 501, 100), 500);
    assert.equal(normalizeCatalogOffset(999, 200, MAX_CATALOG_PAGE_SIZE + 1), 0);
    assert.equal(normalizeCatalogOffset(999, 0, 100), 0);
    assert.equal(normalizeCatalogOffset(Number.NaN, Number.NaN, Number.NaN), 0);
  });
});
