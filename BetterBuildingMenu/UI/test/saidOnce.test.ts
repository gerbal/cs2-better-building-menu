import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatLotDimensions } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry, SharedValue } from "../src/domain/buildingCatalog";
import { oneLineNumber, plateNumbers } from "../src/domain/listPlate";
import { holdsBack, legendParts, shownKinds, statedValues, type LegendWords } from "../src/domain/saidOnce";

const row = (over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry => ({
  id: 1, name: "Four-Lane Road", category: "Networks", subCategory: "Networks_Roads", buildingType: "",
  constructionCost: 5_500, costIsPerDistance: true, speedLimit: 100.00000762939453, lotWidth: 0, lotDepth: 0, ...over,
} as BuildingCatalogEntry);
const speed: SharedValue = { kind: "speed", value: 100, depth: 0 };
const cost: SharedValue = { kind: "cost", value: 5_500, depth: 0 };
const words: LegendWords = {
  unlessShown: "{0} unless shown", others: "others {0}", workersUnit: "jobs",
  kinds: { speed: "Speed limit", capacity: "Capacity", workers: "Workers", lot: "Lot" },
};

describe("the kinds a body shows, which the readout may say once", () => {
  it("are the cost and the key number in a list, one number on a one-line plate or a tag, none in the cards", () => {
    assert.deepEqual(shownKinds("list", "plate2", null, "speed"), ["cost", "speed"]);
    assert.deepEqual(shownKinds("list", "plate1", null, "speed"), ["cost"]);
    assert.deepEqual(shownKinds("tiles", "plate2", null, "speed"), ["cost"]);
    assert.deepEqual(shownKinds("tiles", "plate2", "upkeep", "speed"), []);
    assert.deepEqual(shownKinds("cards", "plate2", null, "speed"), []);
    assert.deepEqual(shownKinds("list", "plate2", null, ""), ["cost"]);
  });

  it("follow the sort on a two-number plate, whose second number is then the value sorted by", () => {
    assert.deepEqual(shownKinds("list", "plate2", "workers", "speed"), ["cost"]);
    assert.deepEqual(shownKinds("list", "plateWhole", "upkeep", "capacity"), ["cost"]);
    assert.deepEqual(shownKinds("list", "plate2", "cost", "speed"), ["cost", "speed"]);
  });

  it("are both numbers on a grown small menu's big plate, which draws two at large text", () => {
    assert.deepEqual(shownKinds("list", "big", null, "capacity"), ["cost", "capacity"]);
    assert.deepEqual(shownKinds("list", "big", "workers", "capacity"), ["cost"]);
  });

  it("decide which shared values the readout may say", () => {
    const facts = { sharedValues: [speed, { kind: "workers" as const, value: 20, depth: 0 }, cost], keyKind: "speed" as const };

    assert.deepEqual(statedValues(facts, ["cost", "speed"]), [speed, cost]);
    assert.deepEqual(statedValues(facts, ["cost"]), [cost]);
  });
});

describe("a row's cell left blank", () => {
  it("is one whose value the readout said, a speed as the rows print it, a lot by both sides", () => {
    assert.ok(holdsBack(row(), [speed], "speed"));
    assert.ok(!holdsBack(row({ speedLimit: 80 }), [speed], "speed"));
    assert.ok(holdsBack(row({ lotWidth: 4, lotDepth: 4 }), [{ kind: "lot", value: 4, depth: 4 }], "lot"));
    assert.ok(!holdsBack(row({ lotWidth: 4, lotDepth: 6 }), [{ kind: "lot", value: 4, depth: 4 }], "lot"));
    assert.ok(!holdsBack(row(), [], "speed"));
  });

  it("leaves a plate's number out only where the readout said it, never a locked building's milestone", () => {
    assert.equal(plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0, "speed", [speed]).second, null);
    assert.equal(plateNumbers(row({ speedLimit: 80 }), null, FALLBACK_SEPARATORS, "Locked", 0, "speed", [speed]).second, "80");
    assert.equal(plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0, "speed", [cost]).first, "");
    assert.equal(plateNumbers(row({ isLocked: true, unlockMilestone: 3 }), null, FALLBACK_SEPARATORS, "Locked", 0, "speed", [cost]).first, "MS 3");
  });

  it("on a one-line plate gives the cost's place to the key number where the readout said the cost, and is blank only where it said both", () => {
    const one = (entry: BuildingCatalogEntry, said: readonly SharedValue[], sorted: "workers" | null = null) =>
      oneLineNumber(entry, plateNumbers(entry, sorted, FALLBACK_SEPARATORS, "Locked", 0, "speed", said), sorted, said);

    assert.deepEqual(one(row(), [cost]), { first: "100", second: null, glyph: "gauge", locked: false });
    assert.deepEqual(one(row(), [cost, speed]), { first: "", second: null, glyph: null, locked: false });
    // A cost the readout did not say prints, and nothing said prints the cost.
    assert.deepEqual(one(row({ constructionCost: 4_000 }), [cost]), { first: "¢32/c", second: null, glyph: null, locked: false });
    assert.equal(one(row(), []).first, "¢44/c");
    // A locked building still says why it waits; under a sort by a value, that value.
    assert.deepEqual(one(row({ isLocked: true, unlockMilestone: 3 }), [cost]), { first: "MS 3", second: null, glyph: null, locked: true });
    assert.match(one(row({ workers: 20 }), [cost], "workers").first, /^20/);
  });
});

describe("the readout's legend", () => {
  const window = [row(), row({ id: 2, speedLimit: 80 })];

  it("says each value once by its glyph, then in its short forms", () => {
    assert.deepEqual(legendParts([speed], "speed", ["cost", "speed"], window, FALLBACK_SEPARATORS, words, "full"), [{ glyph: "gauge", text: "100 km/h unless shown" }]);
    assert.deepEqual(legendParts([speed], "speed", ["cost", "speed"], window, FALLBACK_SEPARATORS, words, "short"), [{ glyph: "gauge", text: "others 100 km/h" }]);
    assert.deepEqual(legendParts([speed], "speed", ["cost", "speed"], window, FALLBACK_SEPARATORS, words, "bare"), [{ glyph: "gauge", text: "others 100" }]);
    assert.deepEqual(legendParts([speed], "speed", ["cost", "speed"], window, FALLBACK_SEPARATORS, words, "none"), []);
  });

  it("says a cost in the game's own template, a road's per cell, and a lot by its two sides", () => {
    assert.equal(legendParts([cost], "speed", ["cost"], window, FALLBACK_SEPARATORS, words, "full")[0].text, "¢44/c unless shown");
    assert.equal(legendParts([{ kind: "lot", value: 4, depth: 4 }], "lot", ["cost", "lot"], [], FALLBACK_SEPARATORS, words, "full")[0].text, `${formatLotDimensions(4, 4)} unless shown`);
  });

  it("names the key kind by its glyph where nothing is said once, and nothing where the body shows no key number", () => {
    assert.deepEqual(legendParts([], "speed", ["cost", "speed"], window, FALLBACK_SEPARATORS, words, "full"), [{ glyph: "gauge", text: "Speed limit" }]);
    assert.deepEqual(legendParts([], "speed", ["cost"], window, FALLBACK_SEPARATORS, words, "full"), []);
    assert.deepEqual(legendParts([], "", ["cost"], window, FALLBACK_SEPARATORS, words, "full"), []);
  });
});
