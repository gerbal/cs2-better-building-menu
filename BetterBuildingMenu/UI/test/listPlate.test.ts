import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_SEPARATORS, formatBuildingMetric, groupDigits } from "../src/domain/assetMenuMetricFormat";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { bodyGrid } from "../src/domain/bodyGeometry";
import { NAME_FONT, oneNumber, plateNameRoom, plateNumbers } from "../src/domain/listPlate";
import { textWidth } from "../src/domain/textWidth";
import { declarationsOf, rem, sides } from "./harness/compiledCss";

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

  it("say every row's upkeep without the month Sort names under a sort by upkeep, a road's per cell as its cost", () => {
    const road = row({ upkeep: 38, constructionCost: 5_500, costIsPerDistance: true, capacity: null });

    assert.deepEqual([plateNumbers(road, "upkeep", FALLBACK_SEPARATORS, "Locked", 0).first, plateNumbers(road, "upkeep", FALLBACK_SEPARATORS, "Locked", 0).second], ["¢44/c", "¢0.3/c"]);
    assert.equal(plateNumbers(row(), "upkeep", FALLBACK_SEPARATORS, "Locked", 0).second, formatBuildingMetric(1_200, "cost"));
    assert.equal(plateNumbers(row({ upkeep: 0 }), "upkeep", FALLBACK_SEPARATORS, "Locked", 0).second, "¢0");
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

describe("a list plate's numbers in words", () => {
  it("say the key number with its unit and no glyph, a lot its name holds included", () => {
    const words = { mode: "word", workersUnit: "jobs", capacityUnit: "capacity" } as const;
    const road = row({ speedLimit: 80, capacity: null, costIsPerDistance: true });
    const lot = row({ name: "Parking Lot 4x6", lotWidth: 4, lotDepth: 6 });

    assert.deepEqual([plateNumbers(road, null, FALLBACK_SEPARATORS, "Locked", 0, "speed", [], words).second, plateNumbers(road, null, FALLBACK_SEPARATORS, "Locked", 0, "speed", [], words).glyph], ["80 km/h", null]);
    assert.deepEqual([plateNumbers(row(), null, FALLBACK_SEPARATORS, "Locked", 0, "workers", [], words).second], ["20 jobs"]);
    // The lot the name says, printed where the readout states another, keeps no glyph in words.
    assert.equal(plateNumbers(lot, null, FALLBACK_SEPARATORS, "Locked", 0, "lot", [{ kind: "lot", value: 2, depth: 2 }], words).glyph, null);
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

describe("a list plate's name room", () => {
  const LIST_BODY = "mods/Bodies/listBody.module.scss";
  const sheet = (selector: string) => declarationsOf(LIST_BODY, selector);
  /** The N of a calc(N rem * var(--fontScale)) the stylesheet scales with the text. */
  const scaled = (value: string | undefined) => rem(/^calc\(([\d.]+rem) \* var\(--fontScale\)\)$/.exec(value ?? "")?.[1]);
  const grid = (textScale: number, menuRows?: number) => bodyGrid({
    body: "list", boxWidth: 706, bodyHeight: 144.25, textScale, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, menuRows, smallMenusGrow: menuRows !== undefined,
  });

  it("is the plate less its padding, picture and gaps and its number column, as the stylesheet draws them", () => {
    const [, right, , left] = sides(sheet(".plate").padding).map(rem);
    const gap = rem(sheet(".plate").gap);
    const font = scaled(sheet(".numbers")["font-size"]);
    const glyph = scaled(sheet(".unitGlyph").width);
    const mark = scaled(sheet(".enterMark").width);
    const markGap = rem(sheet(".firstLine").gap);
    const numbers = { first: "¢85,000", second: "400", glyph: "person" as const, locked: false };
    const plate2 = grid(1);

    assert.equal(scaled(sheet(".name")["font-size"]), NAME_FONT);
    assert.ok(Math.abs(plateNameRoom(plate2, numbers, true, 1)
      - (plate2.cellWidth - left - right - rem(sheet(".artwork").width) - 2 * gap - Math.max(mark + markGap + textWidth(numbers.first, font), glyph + markGap + textWidth("400", font)))) < 1e-9);

    // Above 100% text the picture is 24, and a glyph and a mark grow with the text, their gap does not.
    const plate1 = grid(1.3);
    const key = { first: "400", second: null, glyph: "person" as const, locked: false };
    assert.equal(plate1.form, "plate1");
    assert.ok(Math.abs(plateNameRoom(plate1, key, false, 1.3)
      - (plate1.cellWidth - left - right - rem(sheet(".largeText .artwork").width) - 2 * gap - (glyph * 1.3 + markGap + textWidth("400", font * 1.3)))) < 1e-9);
  });

  it("is a big plate's room beside its picture, its name over its numbers", () => {
    const big = grid(1, 3);
    const [, right, , left] = sides(sheet(".big").padding).map(rem);

    assert.equal(big.form, "big");
    assert.ok(Math.abs(plateNameRoom(big, { first: "¢85,000", second: "400", glyph: "person", locked: false }, false, 1)
      - (big.cellWidth - left - right - big.picture - rem(sheet(".big").gap))) < 1e-9);
  });
});
