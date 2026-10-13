import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatLotDimensions, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { tileFacts } from "../src/domain/tileNameLine";

const row = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1, name: "Low Density Housing", category: "Buildings", subCategory: "Residential", capacity: null, upkeep: null,
  lotWidth: 2, lotDepth: 3, costIsPerDistance: false, buildingType: "", ...over,
} as BuildingCatalogEntry);

describe("the Tiles view's name line", () => {
  it("names the lot of a tile with nothing else to say", () => {
    assert.equal(tileFacts(row(), FALLBACK_SEPARATORS), formatLotDimensions(2, 3));
  });

  it("says the capacity, then the upkeep, then the lot, a dot between", () => {
    const facts = tileFacts(row({ category: "ServiceBuildings", subCategory: "ServiceBuildings_Health", buildingType: "Hospital", capacity: 400, upkeep: 1200 }), FALLBACK_SEPARATORS);

    assert.equal(facts.split(" · ").length, 3);
    assert.match(facts, /^400 patients · /);
    assert.ok(facts.includes(groupDigits(1200, FALLBACK_SEPARATORS)), facts);
    assert.ok(facts.endsWith(` · ${formatLotDimensions(2, 3)}`), facts);
  });

  it("says nothing of a zero, nor of a lot a road does not have", () => {
    assert.equal(tileFacts(row({ capacity: 0, upkeep: 0, lotWidth: 0, lotDepth: 0 }), FALLBACK_SEPARATORS), "");
  });
});
