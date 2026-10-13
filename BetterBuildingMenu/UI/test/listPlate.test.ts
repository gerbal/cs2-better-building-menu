import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatBuildingMetric, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { oneNumber, plateNumbers } from "../src/domain/listPlate";

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
  it("say the cost over the capacity, its digits by the person glyph, as the readout names the kind", () => {
    const numbers = plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0);

    assert.ok(numbers.first.includes(groupDigits(85000, FALLBACK_SEPARATORS)), numbers.first);
    assert.equal(numbers.second, "400");
    assert.equal(numbers.glyph, "person");
    assert.equal(numbers.locked, false);
  });

  it("say the view's key number second: a road's speed by a gauge, workers by a case", () => {
    const road = row({ speedLimit: 100, capacity: null, costIsPerDistance: true });

    assert.deepEqual(
      [plateNumbers(road, null, FALLBACK_SEPARATORS, "Locked", 0, "speed").second, plateNumbers(road, null, FALLBACK_SEPARATORS, "Locked", 0, "speed").glyph],
      ["100", "gauge"],
    );
    assert.deepEqual(
      [plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0, "workers").second, plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0, "workers").glyph],
      ["20", "case"],
    );
    assert.equal(plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0, "").second, null);
  });

  it("say the value sorted by under a sort by a number, so the order reads down the column", () => {
    assert.ok((plateNumbers(row(), "upkeep", FALLBACK_SEPARATORS, "Locked", 0).second ?? "").includes(groupDigits(1200, FALLBACK_SEPARATORS)));
    assert.match(plateNumbers(row(), "workers", FALLBACK_SEPARATORS, "Locked", 0).second ?? "", /^20/);
    // With its unit, which Sort names, and no glyph.
    assert.equal(plateNumbers(row(), "capacity", FALLBACK_SEPARATORS, "Locked", 0).second, "400 patients");
    assert.equal(plateNumbers(row(), "capacity", FALLBACK_SEPARATORS, "Locked", 0).glyph, null);
  });

  it("say a road's upkeep per cell under a sort by upkeep, as its cost, a building's in its monthly template", () => {
    const road = row({ upkeep: 38, constructionCost: 5_500, costIsPerDistance: true, capacity: null });

    assert.deepEqual([plateNumbers(road, "upkeep", FALLBACK_SEPARATORS, "Locked", 0).first, plateNumbers(road, "upkeep", FALLBACK_SEPARATORS, "Locked", 0).second], ["¢44/c", "¢0.3/c"]);
    assert.equal(plateNumbers(row(), "upkeep", FALLBACK_SEPARATORS, "Locked", 0).second, formatBuildingMetric(1_200, "upkeep"));
  });

  it("keep the capacity under a sort by cost, which the first already says", () => {
    assert.match(plateNumbers(row(), "cost", FALLBACK_SEPARATORS, "Locked", 0).second ?? "", /^400\b/);
  });

  it("say nothing second for a building with no capacity, or a capacity of 0", () => {
    assert.equal(plateNumbers(row({ capacity: null }), null, FALLBACK_SEPARATORS, "Locked", 0).second, null);
    assert.equal(plateNumbers(row({ capacity: 0 }), null, FALLBACK_SEPARATORS, "Locked", 0).second, null);
  });

  it("say the milestone in the cost's place for a locked building", () => {
    const numbers = plateNumbers(row({ isLocked: true, unlockMilestone: 7 }), null, FALLBACK_SEPARATORS, "Locked", 0);

    assert.equal(numbers.first, "MS 7");
    assert.equal(numbers.locked, true);
  });

  it("say the locked word in the cost's place for a building whose milestone the city has reached", () => {
    // Only the development tree holds it back now.
    const numbers = plateNumbers(row({ isLocked: true, unlockMilestone: 4 }), null, FALLBACK_SEPARATORS, "Locked", 5);

    assert.equal(numbers.first, "Locked");
    assert.equal(numbers.locked, true);
  });

  it("say the locked word in the cost's place for a building no milestone holds back", () => {
    const numbers = plateNumbers(row({ isLocked: true, unlockMilestone: 0 }), null, FALLBACK_SEPARATORS, "Locked", 0);

    assert.equal(numbers.first, "Locked");
    assert.equal(numbers.locked, true);
  });

  it("say no cost for a building with none, rather than a dash", () => {
    assert.equal(plateNumbers(row({ constructionCost: null }), null, FALLBACK_SEPARATORS, "Locked", 0).first, "");
  });
});

describe("the one number, where there is room for one", () => {
  it("is the cost, or why a locked building waits, under no sort by a value", () => {
    assert.deepEqual(oneNumber(plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0), null), {
      first: plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0).first, second: null, glyph: null, locked: false,
    });
    assert.deepEqual(oneNumber(plateNumbers(row({ isLocked: true, unlockMilestone: 7 }), "cost", FALLBACK_SEPARATORS, "Locked", 0), "cost"), {
      first: "MS 7", second: null, glyph: null, locked: true,
    });
  });

  it("is the value sorted by under a sort by a value, in the plain ink, even on a locked building", () => {
    const locked = row({ isLocked: true, unlockMilestone: 7 });

    assert.deepEqual(oneNumber(plateNumbers(locked, "workers", FALLBACK_SEPARATORS, "Locked", 0), "workers"), {
      first: plateNumbers(locked, "workers", FALLBACK_SEPARATORS, "Locked", 0).second, second: null, glyph: null, locked: false,
    });
    assert.equal(oneNumber(plateNumbers(row({ workers: null }), "workers", FALLBACK_SEPARATORS, "Locked", 0), "workers").first, "");
  });
});
