import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNumberSeparators } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { hoverCardForm, pointerCardText, type PointerCardWords } from "../src/domain/hoverCard";
import { hoverCardLabels } from "../src/domain/hoverCardLines";

const english = (_key: string, fallback?: string | null) => fallback ?? null;
const separators = getNumberSeparators(english);
const words: PointerCardWords = { labels: hoverCardLabels(english), unlocksAt: "Unlocks at milestone {0}", lockedWord: "Locked" };
const building = (over: Partial<BuildingCatalogEntry>): BuildingCatalogEntry => ({
  id: 1, name: "Elementary School", prefabName: "School", category: "ServiceBuildings", subCategory: "ServiceBuildings_Education", buildingType: "School",
  constructionCost: 300_000, upkeep: 2_500, capacity: 400, lotWidth: 5, lotDepth: 4, isLocked: false, unlockMilestone: 0, costIsPerDistance: false,
  ...over,
} as BuildingCatalogEntry);
const lines = (entry: BuildingCatalogEntry, kind: Parameters<typeof pointerCardText>[1] = "capacity", achieved = 0) =>
  pointerCardText(entry, kind, separators, words, achieved);

describe("what the hover card beside the pointer says", () => {
  it("lists the cost, the upkeep, the view's key number by its glyph and the lot, each under the card's word", () => {
    const text = lines(building({}));

    assert.deepEqual(text.rows.map((row) => [row.label, row.glyph]), [["Cost", null], ["Upkeep", null], ["Capacity", "person"], ["Lot", null]]);
    assert.match(text.rows[2].value, /^400 /);
    assert.equal(text.unlock, null);
  });

  it("reads a road's money per kilometre, as the game's own panels state it, and its speed in a view keyed by speed", () => {
    const road = building({ name: "Four-Lane Road", category: "Networks", constructionCost: 5_500, upkeep: 120, costIsPerDistance: true, speedLimit: 100, capacity: null, lotWidth: 0, lotDepth: 0 });
    const text = lines(road, "speed");

    assert.match(text.rows[0].value, /\/km$/);
    assert.deepEqual(text.rows.map((row) => row.label), ["Cost", "Upkeep", "Speed limit"]);
    assert.equal(text.rows[2].glyph, "gauge");
  });

  it("leaves the lot out where the name says it, and says a home's households where the view keys none", () => {
    assert.deepEqual(lines(building({ name: "Small Parking Lot 5x4" })).rows.map((row) => row.key), ["cost", "upkeep", "key"]);
    assert.deepEqual(lines(building({ capacity: null, households: 12 }), "").rows.find((row) => row.key === "key")?.label, "Households");
  });

  it("reads the lot off the name the card draws, the prefab's where the building has no name", () => {
    assert.deepEqual(lines(building({ name: "", prefabName: "Parking Lot 5x4" })).rows.map((row) => row.key), ["cost", "upkeep", "key"]);
  });

  it("says the milestone a locked building waits for, and the locked word once the city has reached it", () => {
    assert.equal(lines(building({ isLocked: true, unlockMilestone: 6 } as Partial<BuildingCatalogEntry>)).unlock, "Unlocks at milestone 6");
    assert.equal(lines(building({ isLocked: true, unlockMilestone: 6 } as Partial<BuildingCatalogEntry>), "capacity", 6).unlock, "Locked");
  });

  it("reads the Hover card row's form, anything else beside the pointer", () => {
    assert.deepEqual(["pointer", "slot", "status", "", "Slot", undefined].map((value) => hoverCardForm(value)), ["pointer", "slot", "status", "pointer", "pointer", "pointer"]);
  });
});
