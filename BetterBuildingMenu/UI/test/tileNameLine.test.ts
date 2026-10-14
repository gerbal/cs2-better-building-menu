import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatLotDimensions, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { tileFacts } from "../src/domain/tileNameLine";

const row = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1, name: "Low Density Housing", category: "Buildings", subCategory: "Residential", capacity: null, upkeep: null,
  lotWidth: 2, lotDepth: 3, costIsPerDistance: false, buildingType: "", ...over,
} as BuildingCatalogEntry);

/** The game's own English money templates and separators, as its dictionary gives them. */
const GAME = {
  ...FALLBACK_SEPARATORS,
  group: ",",
  money: {
    plain: "{SIGN}¢{VALUE}",
    perMonth: "{SIGN}¢{VALUE} /mo.",
    perKilometre: "{SIGN}¢{VALUE} /km",
    perKilometrePerMonth: "{SIGN}¢{VALUE} /km/mo.",
    perMile: "{SIGN}¢{VALUE} /mi",
    perMilePerMonth: "{SIGN}¢{VALUE} /mi/mo.",
  },
};

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

  it("says a road's upkeep per cell with its month, in the game's spacing, and a building's monthly bill as before", () => {
    const road = row({ category: "Networks", subCategory: "Networks_Roads", upkeep: 487, lotWidth: 0, lotDepth: 0, costIsPerDistance: true });

    assert.equal(tileFacts(road, GAME), "¢3.9 /c/mo.");
    assert.equal(tileFacts(road, FALLBACK_SEPARATORS), "¢3.9/c/mo");
    assert.equal(tileFacts(row({ upkeep: 1_200 }), GAME), `¢1,200 /mo. · ${formatLotDimensions(2, 3)}`);
  });

  it("says nothing of a zero, nor of a lot a road does not have", () => {
    assert.equal(tileFacts(row({ capacity: 0, upkeep: 0, lotWidth: 0, lotDepth: 0 }), FALLBACK_SEPARATORS), "");
  });
});
