import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatCapacity, formatLotDimensions, UnitSystem } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { costText, keepsUnit, keyFigure, nameHoldsLot, sortedText } from "../src/domain/rowNumbers";

const row = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1, name: "Building", category: "ServiceBuildings", subCategory: "ServiceBuildings_Health", buildingType: "Hospital",
  constructionCost: 85_000, capacity: 400, workers: 20, lotWidth: 4, lotDepth: 6, costIsPerDistance: false, ...over,
} as BuildingCatalogEntry);
const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

describe("a row's cost", () => {
  it("says a building's none as the game's Free, and a network's 0 per cell", () => {
    assert.equal(costText(row({ constructionCost: 0 }), FALLBACK_SEPARATORS), "Free");
    assert.equal(costText(row({ constructionCost: 0, costIsPerDistance: true }), FALLBACK_SEPARATORS), "¢0/c");
  });
});

describe("a row's key number", () => {
  it("is a speed's digits in the player's unit by a gauge, the readout naming the unit", () => {
    assert.deepEqual(keyFigure(row({ speedLimit: 100.00000762939453 }), "speed", FALLBACK_SEPARATORS), { text: "100", glyph: "gauge" });
    assert.deepEqual(keyFigure(row({ speedLimit: 100 }), "speed", imperial), { text: "62", glyph: "gauge" });
  });

  it("is a capacity that counts by a person, and a measured one with its own unit and no glyph", () => {
    assert.deepEqual(keyFigure(row(), "capacity", FALLBACK_SEPARATORS), { text: "400", glyph: "person" });

    const plant = row({ subCategory: "ServiceBuildings_Electricity", buildingType: "PowerPlant", capacity: 245_000 });
    const pump = row({ subCategory: "ServiceBuildings_Water", buildingType: "WaterPumpingStation", capacity: 30_000 });
    assert.deepEqual(keyFigure(plant, "capacity", FALLBACK_SEPARATORS), { text: formatCapacity(245_000, plant.category, plant.subCategory, "PowerPlant"), glyph: null });
    assert.match(keyFigure(plant, "capacity", FALLBACK_SEPARATORS)?.text ?? "", /MW$/);
    assert.equal(keyFigure(pump, "capacity", FALLBACK_SEPARATORS)?.glyph, null);
  });

  it("is the workers by a case, and the lot by a grid unless the name already says it", () => {
    assert.deepEqual(keyFigure(row(), "workers", FALLBACK_SEPARATORS), { text: "20", glyph: "case" });
    assert.deepEqual(keyFigure(row(), "lot", FALLBACK_SEPARATORS), { text: formatLotDimensions(4, 6), glyph: "grid" });
    assert.equal(keyFigure(row({ name: "Small Underground Parking Lot 4x6", lotWidth: 4, lotDepth: 6 }), "lot", FALLBACK_SEPARATORS), null);
  });

  it("is nothing for a row without the kind's value, or a view whose rows show none", () => {
    assert.equal(keyFigure(row({ speedLimit: null }), "speed", FALLBACK_SEPARATORS), null);
    assert.equal(keyFigure(row({ capacity: 0 }), "capacity", FALLBACK_SEPARATORS), null);
    assert.equal(keyFigure(row({ lotWidth: 0 }), "lot", FALLBACK_SEPARATORS), null);
    assert.equal(keyFigure(row(), "", FALLBACK_SEPARATORS), null);
  });
});

describe("a name that says its lot", () => {
  it("says it as width x depth, either mark, any case, and never inside a longer number", () => {
    assert.ok(nameHoldsLot("Corner Parking Lot 1x3", 1, 3));
    assert.ok(nameHoldsLot("Plaza 2 × 2", 2, 2));
    assert.ok(nameHoldsLot("Lot 2X3 - Mirrored", 2, 3));
    assert.ok(!nameHoldsLot("Lot 12x3", 2, 3));
    assert.ok(!nameHoldsLot("Medical Clinic", 2, 3));
  });
});

describe("the value sorted by", () => {
  it("keeps its unit, which Sort names, and is the lot's two sides under a sort by lot", () => {
    assert.equal(sortedText(row(), "capacity", FALLBACK_SEPARATORS), "400 patients");
    assert.equal(sortedText(row(), "lot", FALLBACK_SEPARATORS), formatLotDimensions(4, 6));
    assert.equal(sortedText(row(), null, FALLBACK_SEPARATORS), null);
  });

  it("is a network's upkeep per cell, a cell's share to one decimal; the hover card keeps its kilometre", () => {
    assert.equal(sortedText(row({ upkeep: 4_612, costIsPerDistance: true }), "upkeep", FALLBACK_SEPARATORS), "¢36.9/c");
    assert.equal(sortedText(row({ upkeep: 500, costIsPerDistance: true }), "upkeep", FALLBACK_SEPARATORS), "¢4/c");
    assert.equal(sortedText(row({ upkeep: null, costIsPerDistance: true }), "upkeep", FALLBACK_SEPARATORS), null);
  });
});

describe("a unit that scales with its size", () => {
  it("is a plant's power and a dump's weight, kept wherever room is short", () => {
    assert.ok(keepsUnit(row({ buildingType: "PowerPlant" }), "capacity"));
    assert.ok(keepsUnit(row({ buildingType: "GarbageFacility" }), "capacity"));
    assert.ok(!keepsUnit(row(), "capacity"));
    assert.ok(!keepsUnit(row({ buildingType: "PowerPlant" }), "upkeep"));
  });
});
