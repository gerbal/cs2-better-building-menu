import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatBuildingMetric, formatCapacity, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { tagFits, tileTag } from "../src/domain/tileTag";

const row = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1, name: "Hospital", category: "ServiceBuildings", subCategory: "ServiceBuildings_Health", buildingType: "Hospital",
  constructionCost: 125_000, upkeep: 1_200, capacity: 400, lotWidth: 4, lotDepth: 4, costIsPerDistance: false, ...over,
} as BuildingCatalogEntry);
/** The tag on the smallest tile Tile size allows. */
const tag = (entry: BuildingCatalogEntry, textScale = 1, sorted: Parameters<typeof tileTag>[1] = null) =>
  tileTag(entry, sorted, FALLBACK_SEPARATORS, "Locked", 0, 64, textScale);

describe("a tile's tag", () => {
  it("says a figure that fits whole, at every text scale", () => {
    for (const scale of [1, 1.1, 1.3]) {
      assert.deepEqual(tag(row({ constructionCost: 48_000 }), scale), { text: formatBuildingMetric(48_000, "cost"), locked: false });
    }
    assert.equal(tag(row(), 1.1).text, formatBuildingMetric(125_000, "cost"));
    assert.equal(tag(row({ constructionCost: 1_200_000 })).text, formatBuildingMetric(1_200_000, "cost"));
  });

  it("says ¢12,500,000 in millions at 100% text, which then fits the tile", () => {
    const whole = formatBuildingMetric(12_500_000, "cost");
    const text = tag(row({ constructionCost: 12_500_000 })).text;

    assert.ok(!tagFits(whole, 64, 1), whole);
    assert.equal(text, "¢12.5M");
    assert.ok(tagFits(text, 64, 1));
  });

  it("says ¢1,200,000 in millions at 110% and 130% text", () => {
    for (const scale of [1.1, 1.3]) {
      const text = tag(row({ constructionCost: 1_200_000 }), scale).text;

      assert.equal(text, "¢1.2M", `${scale}`);
      assert.ok(tagFits(text, 64, scale), `${scale}`);
    }
  });

  it("says a road's rate in thousands at 110% text, a rate still", () => {
    const text = tag(row({ constructionCost: 4_800, costIsPerDistance: true }), 1.1).text;

    assert.ok(!tagFits(formatBuildingMetric(4_800, "cost", FALLBACK_SEPARATORS, true), 64, 1.1));
    assert.equal(text, "¢4.8k/km");
    assert.ok(tagFits(text, 64, 1.1));
  });

  it("shortens a road's rate before the tag would cut it: no decimal at 130% text, no rate at 150%", () => {
    const road = (cost: number) => row({ constructionCost: cost, costIsPerDistance: true });

    assert.equal(tag(road(5_500), 1.3).text, "¢6k/km");
    assert.equal(tag(road(16_500), 1.5).text, "¢16.5k");
    assert.equal(tag(road(14_500), 1.5).text, "¢14.5k");
  });

  it("fits the tag at 130% and 150% text with every cost, a building's or a road's, so none is cut", () => {
    for (const scale of [1.3, 1.5]) {
      for (const perDistance of [false, true]) {
        for (const cost of [950, 5_500, 16_500, 125_000, 999_600, 1_250_000, 12_500_000, 125_000_000]) {
          const text = tag(row({ constructionCost: cost, costIsPerDistance: perDistance }), scale).text;

          assert.ok(tagFits(text, 64, scale), `${cost}${perDistance ? "/km" : ""} at ${scale}: ${text}`);
        }
      }
    }
  });

  it("says a locked building's milestone, in the locked ink, and never a short form of it", () => {
    assert.deepEqual(tag(row({ isLocked: true, unlockMilestone: 4, constructionCost: 12_500_000 } as Partial<BuildingCatalogEntry>)), { text: "MS 4", locked: true });
  });

  it("says the value sorted by under a sort by a value, as 0.2.x's Grid did, and the cost under any other", () => {
    // "400 patients" does not fit a 64 tile, so the number stands alone.
    const capacity = "400";

    assert.deepEqual(tag(row(), 1, "capacity"), { text: capacity, locked: false });
    assert.equal(tag(row(), 1, "upkeep").text, formatBuildingMetric(1_200, "upkeep"));
    assert.equal(tag(row(), 1, "cost").text, formatBuildingMetric(125_000, "cost"));
    assert.equal(tag(row(), 1, "lot").text, formatBuildingMetric(125_000, "cost"));
    // A locked building's value, not its milestone: the padlock still says it waits.
    assert.deepEqual(tag(row({ isLocked: true, unlockMilestone: 4 } as Partial<BuildingCatalogEntry>), 1, "capacity"), { text: capacity, locked: false });
  });

  it("says a sorted upkeep too wide for the tag in millions, to no decimal where one does not fit", () => {
    assert.equal(tag(row({ upkeep: 1_500_000 }), 1.1, "upkeep").text, "¢1.5M/mo");
    assert.equal(tag(row({ upkeep: 1_500_000 }), 1.3, "upkeep").text, "¢2M/mo");
  });

  it("keeps a sorted capacity's whole number and drops its unit where both do not fit, at 100% and 130% text", () => {
    const school = row({ subCategory: "ServiceBuildings_Education", buildingType: "School", capacity: 1_000 });
    const whole = formatCapacity(1_000, "ServiceBuildings", "ServiceBuildings_Education", "School", FALLBACK_SEPARATORS);

    for (const scale of [1, 1.3]) {
      assert.ok(!tagFits(whole, 64, scale), `${whole} at ${scale}`);
      assert.equal(tag(school, scale, "capacity").text, groupDigits(1_000, FALLBACK_SEPARATORS), `${scale}`);
    }
    assert.equal(tag(row({ capacity: 123_456_789 }), 1.3, "capacity").text, groupDigits(123_456_789, FALLBACK_SEPARATORS));
  });

  it("keeps a sorted value's unit where it fits", () => {
    const plant = row({ subCategory: "ServiceBuildings_Electricity", buildingType: "PowerPlant", capacity: 400_000 });
    const whole = formatCapacity(400_000, "ServiceBuildings", "ServiceBuildings_Electricity", "PowerPlant", FALLBACK_SEPARATORS);

    assert.match(whole, /[A-Za-z]/);
    assert.equal(tag(plant, 1, "capacity").text, whole);
  });

  it("says nothing for a building with no cost", () => {
    assert.deepEqual(tag(row({ constructionCost: null } as Partial<BuildingCatalogEntry>)), { text: "", locked: false });
  });
});
