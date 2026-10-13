import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { plateNumbers } from "../src/domain/listPlate";

const row = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1,
  name: "Medical Clinic",
  category: "ServiceBuildings",
  subCategory: "ServiceBuildings_Health",
  constructionCost: 85000,
  capacity: 400,
  upkeep: 1200,
  workers: 20,
  isLocked: false,
  unlockMilestone: 0,
  costIsPerDistance: false,
  buildingType: "Hospital",
  ...over,
} as BuildingCatalogEntry);

describe("a list plate's numbers", () => {
  it("say the cost over the capacity", () => {
    const numbers = plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked");

    assert.ok(numbers.first.includes(groupDigits(85000, FALLBACK_SEPARATORS)), numbers.first);
    assert.equal(numbers.second, "400 patients");
    assert.equal(numbers.locked, false);
  });

  it("say the value sorted by under a sort by a number, so the order reads down the column", () => {
    assert.ok((plateNumbers(row(), "upkeep", FALLBACK_SEPARATORS, "Locked").second ?? "").includes(groupDigits(1200, FALLBACK_SEPARATORS)));
    assert.match(plateNumbers(row(), "workers", FALLBACK_SEPARATORS, "Locked").second ?? "", /^20/);
  });

  it("keep the capacity under a sort by cost, which the first already says", () => {
    assert.match(plateNumbers(row(), "cost", FALLBACK_SEPARATORS, "Locked").second ?? "", /^400\b/);
  });

  it("say nothing second for a building with no capacity, or a capacity of 0", () => {
    assert.equal(plateNumbers(row({ capacity: null }), null, FALLBACK_SEPARATORS, "Locked").second, null);
    assert.equal(plateNumbers(row({ capacity: 0 }), null, FALLBACK_SEPARATORS, "Locked").second, null);
  });

  it("say the milestone in the cost's place for a locked building", () => {
    const numbers = plateNumbers(row({ isLocked: true, unlockMilestone: 7 }), null, FALLBACK_SEPARATORS, "Locked");

    assert.equal(numbers.first, "MS 7");
    assert.equal(numbers.locked, true);
  });

  it("say the locked word in the cost's place for a building no milestone holds back", () => {
    const numbers = plateNumbers(row({ isLocked: true, unlockMilestone: 0 }), null, FALLBACK_SEPARATORS, "Locked");

    assert.equal(numbers.first, "Locked");
    assert.equal(numbers.locked, true);
  });

  it("say no cost for a building with none, rather than a dash", () => {
    assert.equal(plateNumbers(row({ constructionCost: null }), null, FALLBACK_SEPARATORS, "Locked").first, "");
  });
});
