import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatCapacity, formatCostPerCell, formatLotDimensions } from "../src/domain/assetMenuMetricFormat";
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

  it("says a dash where a row has no value of a kind the readout states, so a blank only ever means the stated value", () => {
    const numbers = (entry: BuildingCatalogEntry, said: readonly SharedValue[], keyKind: "speed" | "lot" = "speed") =>
      plateNumbers(entry, null, FALLBACK_SEPARATORS, "Locked", 0, keyKind, said);

    assert.deepEqual([numbers(row({ speedLimit: null }), [speed]).second, numbers(row({ speedLimit: null }), [speed]).glyph], ["–", null]);
    assert.equal(numbers(row({ constructionCost: null }), [cost]).first, "–");
    // Nothing stated, nothing marked: the cell is blank as ever.
    assert.equal(numbers(row({ speedLimit: null }), []).second, null);
    assert.equal(numbers(row({ constructionCost: null }), [speed]).first, "");
    // A lot the name already says prints where it differs from the one stated.
    const parking = row({ name: "Parking Lot 4x6", lotWidth: 4, lotDepth: 6 });
    assert.deepEqual([numbers(parking, [{ kind: "lot", value: 4, depth: 4 }], "lot").second, numbers(parking, [{ kind: "lot", value: 4, depth: 4 }], "lot").glyph], [formatLotDimensions(4, 6), "grid"]);
    // On a one-line plate too.
    assert.equal(oneLineNumber(row({ constructionCost: null }), numbers(row({ constructionCost: null }), [cost]), null, [cost]).first, "–");
    assert.equal(oneLineNumber(row({ speedLimit: null }), numbers(row({ speedLimit: null }), [cost, speed]), null, [cost, speed]).first, "–");
  });

  it("on a one-line plate gives the cost's place to the key number where the readout said the cost, and is blank only where it said both", () => {
    const one = (entry: BuildingCatalogEntry, said: readonly SharedValue[], sorted: "workers" | null = null) =>
      oneLineNumber(entry, plateNumbers(entry, sorted, FALLBACK_SEPARATORS, "Locked", 0, "speed", said), sorted, said);

    assert.deepEqual(one(row(), [cost]), { first: "100", second: null, glyph: "gauge", locked: false, firstIsKey: true });
    assert.deepEqual(one(row(), [cost, speed]), { first: "", second: null, glyph: null, locked: false, firstIsKey: true });
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

  it("says a value no loaded row holds in the unit its rows print it in, from the basis and unit C# sends", () => {
    const roadCost: SharedValue = { kind: "cost", value: 5_500, depth: 0, perCell: true, unit: "" };
    const plantOutput: SharedValue = { kind: "capacity", value: 4_500, depth: 0, perCell: false, unit: "PowerPlant" };

    assert.deepEqual(legendParts([roadCost], "speed", ["cost"], [], FALLBACK_SEPARATORS, words, "full"), [{ glyph: null, text: "¢44/c unless shown" }]);
    const output = legendParts([plantOutput], "capacity", ["cost", "capacity"], [], FALLBACK_SEPARATORS, words, "full")[0];
    assert.deepEqual(output, { glyph: null, text: `${formatCapacity(4_500, "", "", "PowerPlant")} unless shown` });
  });

  it("leaves blank only a row whose figure has the stated basis and unit", () => {
    const roadCost: SharedValue = { kind: "cost", value: 5_500, depth: 0, perCell: true, unit: "" };

    assert.ok(holdsBack(row(), [roadCost], "cost"));
    assert.ok(!holdsBack(row({ costIsPerDistance: false }), [roadCost], "cost"));
    assert.ok(!holdsBack(row({ capacity: 300, buildingType: "Hospital" }), [{ kind: "capacity", value: 300, depth: 0, perCell: false, unit: "School" }], "capacity"));
    assert.ok(holdsBack(row({ capacity: 300, buildingType: "School" }), [{ kind: "capacity", value: 300, depth: 0, perCell: false, unit: "School" }], "capacity"));
  });

  it("leaves blank a network whose cost prints as the said figure a cell, rounded half up as C# counts it", () => {
    const roadCost: SharedValue = { kind: "cost", value: 5_500, depth: 0, perCell: true, unit: "" };

    // ¢44/c from 5,560 and 5,480 a kilometre: the same figure beside "¢44/c unless shown" is the said one.
    assert.ok(holdsBack(row({ constructionCost: 5_560 }), [roadCost], "cost"));
    assert.ok(holdsBack(row({ constructionCost: 5_480 }), [roadCost], "cost"));
    assert.ok(!holdsBack(row({ constructionCost: 5_625 }), [roadCost], "cost"));
    // 5,562.5 a kilometre is ¢45/c, as C#'s ViewFactsTests count it: the value it sends is 45 cells' worth.
    assert.equal(formatCostPerCell(5_562.5), "¢45/c");
    assert.ok(holdsBack(row({ constructionCost: 5_562.5 }), [{ ...roadCost, value: 45 * 125 }], "cost"));
    // A building's cost is whole: only the same figure is the said one.
    assert.ok(!holdsBack(row({ constructionCost: 5_560, costIsPerDistance: false }), [{ ...roadCost, perCell: false }], "cost"));
  });

  it("leaves blank a capacity that prints as the said one: the same table as C#'s ViewFactsTests", () => {
    const table = [
      ["PowerPlant", 245_000, 245_040, true], ["PowerPlant", 245_000, 245_100, false],
      ["PowerPlant", 5_000, 5_000.4, true], ["PowerPlant", 5_000, 5_004, false],
      ["Battery", 100_000, 100_400, true], ["Battery", 100_000, 101_000, false],
      ["TelecomFacility", 12, 12.04, true], ["TelecomFacility", 12, 12.1, false],
      ["GarbageFacility", 250_000, 250_004, true], ["GarbageFacility", 250_000, 250_010, false],
      ["WaterPumpingStation", 30_000, 30_000.4, true], ["WaterPumpingStation", 30_000, 30_001, false],
      ["School", 400, 400.04, true], ["School", 400, 401, false],
      // Midpoints in decimal that a double holds just below: toFixed prints them down, and so does C#.
      ["PowerPlant", 10_450, 10_400, true], ["PowerPlant", 10_450, 10_500, false],
      ["Battery", 1_500, 1_000, true], ["Battery", 1_500, 2_000, false],
      ["GarbageFacility", 105, 100, true], ["GarbageFacility", 105, 110, false],
      ["GarbageFacility", 1_105_000, 1_100_000, true], ["GarbageFacility", 1_105_000, 1_110_000, false],
    ] as const;

    for (const [role, one, other, alike] of table) {
      const said: SharedValue = { kind: "capacity", value: one, depth: 0, perCell: false, unit: role };
      const printed = (value: number) => formatCapacity(value, "Services", "Services", role);

      assert.equal(printed(one) === printed(other), alike, `${role} ${one} ${other}: ${printed(one)} ${printed(other)}`);
      assert.equal(holdsBack(row({ capacity: other, buildingType: role, category: "Services", subCategory: "Services" }), [said], "capacity"), alike, `${role} ${one} ${other}`);
    }
  });

  it("names the key kind by its glyph where nothing is said once, and nothing where the body shows no key number", () => {
    assert.deepEqual(legendParts([], "speed", ["cost", "speed"], window, FALLBACK_SEPARATORS, words, "full"), [{ glyph: "gauge", text: "Speed limit" }]);
    assert.deepEqual(legendParts([], "speed", ["cost"], window, FALLBACK_SEPARATORS, words, "full"), []);
    assert.deepEqual(legendParts([], "", ["cost"], window, FALLBACK_SEPARATORS, words, "full"), []);
  });
});
