import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNumberSeparators, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { textWidth } from "../src/domain/textWidth";
import { hoverCardForm, pointerCardText, statusLine, type PointerCardWords } from "../src/domain/hoverCard";
import { hoverCardLabels } from "../src/domain/hoverCardLines";
import { keyFigure, type KeyKind, type UnitMarks } from "../src/domain/rowNumbers";

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

  it("draws no glyph by the key number in a look that writes units in words, its value the same", () => {
    const text = pointerCardText(building({}), "capacity", separators, words, 0, "word");

    assert.deepEqual(text.rows.map((row) => row.glyph), [null, null, null, null]);
    assert.equal(text.rows[2].value, lines(building({})).rows[2].value);
  });

  it("says the key number as a row in words says it, by the rows' word rule, a count the game gives no unit bare under its label", () => {
    const marks: UnitMarks = { mode: "word", workersUnit: words.labels.workersUnit, capacityUnit: "capacity" };
    const road = building({ name: "Four-Lane Road", category: "Networks", speedLimit: 80, capacity: null, lotWidth: 0, lotDepth: 0 });
    const crematorium = building({ subCategory: "ServiceBuildings_Deathcare", buildingType: "DeathcareFacility", capacity: 1_500 });
    const keyOf = (entry: BuildingCatalogEntry, kind: KeyKind) => lines(entry, kind).rows.find((row) => row.key === "key")?.value;

    for (const [entry, kind] of [[building({}), "capacity"], [road, "speed"], [building({ workers: 20 }), "workers"]] as const) {
      assert.equal(keyOf(entry, kind), keyFigure(entry, kind, separators, marks)?.text, kind);
    }
    assert.equal(keyOf(crematorium, "capacity"), groupDigits(1_500, separators));
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

describe("what Status line only says in the readout", () => {
  const fonts = { name: 11, line: 10, sep: 8 };
  const say = (entry: BuildingCatalogEntry, room: number, kind: Parameters<typeof pointerCardText>[1] = "capacity", achieved = 0) =>
    statusLine(entry, kind, separators, words, achieved, room, fonts);

  it("names the building, then its cost, upkeep, key number and lot, with their units in words", () => {
    const road = building({ name: "Four-Lane Road", category: "Networks", constructionCost: 5_500, upkeep: 120, costIsPerDistance: true, speedLimit: 100, capacity: null, lotWidth: 0, lotDepth: 0 });
    const line = say(road, 400, "speed");

    assert.equal(line.name, "Four-Lane Road");
    assert.equal(line.parts.length, 3);
    assert.match(line.parts[0], /\/km$/);
    assert.match(line.parts[2], /100 km\/h/);
    assert.deepEqual(say(building({}), 400).parts.map((part) => part.split(" ")[0]).slice(-1), ["Lot"]);
  });

  it("drops the lot first, then the upkeep, then the key number, then the cost, and keeps a locked building's milestone", () => {
    const school = building({ isLocked: true, unlockMilestone: 6 } as Partial<BuildingCatalogEntry>);
    const [milestone, cost, upkeep, key, lot] = say(school, 400).parts;

    assert.equal(milestone, "MS 6");
    assert.match(upkeep, /\/mo$/);
    assert.match(lot, /^Lot /);
    assert.deepEqual(say(school, 200).parts, [milestone, cost, key]);
    assert.deepEqual(say(school, 120).parts, [milestone, cost]);
    assert.deepEqual(say(school, 60).parts, [milestone]);
    assert.deepEqual(say(school, 20).parts, [milestone]);
  });

  it("cuts a name too long for the readout's room once", () => {
    assert.match(say(building({ name: "Wide Quay With Four-Lane Road Over A Canal" }), 90).name, /…/);
  });

  it("names a bare capacity by its word, since the readout has no glyph to say what the number counts", () => {
    const plain = building({ category: "Other", subCategory: "Other", buildingType: "Thing" });

    assert.equal(say(plain, 400).parts.find((part) => part.endsWith("400")), "Capacity 400");
    assert.ok(say(building({}), 400).parts.includes("400 students"));
  });

  it("shortens sooner at a larger text scale, the same figures in the same order", () => {
    const school = building({ isLocked: true, unlockMilestone: 6 } as Partial<BuildingCatalogEntry>);
    const big = { name: 16.5, line: 15, sep: 12 };
    const room = 150;

    assert.ok(statusLine(school, "capacity", separators, words, 0, room, big).parts.length < say(school, room).parts.length);
    assert.equal(statusLine(school, "capacity", separators, words, 0, room, big).parts[0], "MS 6");
  });

  describe("in one line, above 100% text", () => {
    const school = building({ isLocked: true, unlockMilestone: 6 } as Partial<BuildingCatalogEntry>);
    const one = (room: number, entry = school) => statusLine(entry, "capacity", separators, words, 0, room, fonts, true);
    const figures = say(school, 1_000).parts;
    const [milestone, cost, , key] = figures;
    const name = textWidth("Elementary School", fonts.name);
    const w = (text: string) => textWidth(text, fonts.line);
    // The name, then a "·" before each figure.
    const fits = (...parts: string[]) => name + parts.length * fonts.sep + parts.reduce((sum, part) => sum + w(part), 0);

    it("names the building first, then every figure that fits, a dot before each", () => {
      const line = one(fits(...figures) + 0.5);

      assert.equal(line.oneLine, true);
      assert.equal(line.name, "Elementary School");
      assert.deepEqual(line.parts, figures);
      assert.equal(say(school, 400).oneLine, false);
    });

    it("drops the figures by the same order, the milestone kept", () => {
      assert.deepEqual(one(fits(milestone, cost, key) + 0.5).parts, [milestone, cost, key]);
      assert.deepEqual(one(fits(milestone, cost, key) - 0.5).parts, [milestone, cost]);
      assert.deepEqual(one(fits(milestone, cost) - 0.5).parts, [milestone]);
      assert.equal(one(fits(milestone, cost) - 0.5).name, "Elementary School");
    });

    it("cuts the name once, leaving the milestone its room, when the name alone runs over", () => {
      const line = one(60);

      assert.match(line.name, /…/);
      assert.deepEqual(line.parts, [milestone]);
      assert.deepEqual(one(60, building({})).parts, []);
    });
  });
});
