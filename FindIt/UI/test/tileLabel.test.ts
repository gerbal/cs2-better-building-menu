import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shortenTileLabel,
  stripRedundantNamePrefix,
  tileLabelCharBudget,
  tileLabelLineBudget,
  wrapTileLabel,
} from "../src/domain/tileLabel.ts";

const COMMERCIAL = { category: "Buildings", subCategory: "Commercial", theme: "European" };

describe("redundant name prefixes", () => {
  it("drops the theme and category the tile's own context already states", () => {
    assert.equal(
      stripRedundantNamePrefix("EU Commercial Gas Station 01 - L1 2x2", COMMERCIAL),
      "Gas Station 01 - L1 2x2"
    );
  });

  it("keeps buildings distinguishable that a middle elision would have merged", () => {
    const budget = tileLabelCharBudget(88);
    const gas = shortenTileLabel(
      stripRedundantNamePrefix("EU Commercial Gas Station 01 - L1 2x2", COMMERCIAL),
      budget
    );
    const high = shortenTileLabel(
      stripRedundantNamePrefix("EU Commercial High 01 - L1 2x2", COMMERCIAL),
      budget
    );
    assert.notEqual(gas, high);
  });

  it("leaves a name that does not start with its own category alone", () => {
    assert.equal(stripRedundantNamePrefix("Auto Center", COMMERCIAL), "Auto Center");
    assert.equal(stripRedundantNamePrefix("Activity Plaza", COMMERCIAL), "Activity Plaza");
  });

  it("strips a theme prefix even without theme context", () => {
    assert.equal(stripRedundantNamePrefix("NA Commercial Low 01", { subCategory: "Commercial" }), "Low 01");
  });

  it("never strips a name down to nothing or to a bare number", () => {
    assert.equal(stripRedundantNamePrefix("EU Commercial", COMMERCIAL), "Commercial");
    assert.equal(stripRedundantNamePrefix("EU Commercial 01", COMMERCIAL), "EU Commercial 01");
  });

  it("survives missing context, stripping only what it can still be sure of", () => {
    assert.equal(stripRedundantNamePrefix("Auto Center"), "Auto Center");
    // "EU" is a known theme prefix so it goes; "Commercial" stays, because with
    // no category context there is nothing saying it is redundant.
    assert.equal(stripRedundantNamePrefix("EU Commercial Gas Station", {}), "Commercial Gas Station");
  });
});

describe("grid tile label shortening", () => {
  it("leaves a name that already fits alone", () => {
    assert.equal(shortenTileLabel("Auto Center", 20), "Auto Center");
  });

  it("keeps the distinguishing tail, which is what clipping from the right destroyed", () => {
    const budget = 20;
    const a = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", budget);
    const b = shortenTileLabel("EU Commercial Gas Station 01 - L1 3x2", budget);

    assert.notEqual(a, b, "tiles that differ only in their tail must still differ once shortened");
    assert.ok(a.endsWith("2x2"), `expected the lot size to survive, got ${a}`);
    assert.ok(b.endsWith("3x2"), `expected the lot size to survive, got ${b}`);
  });

  it("separates levels of the same building", () => {
    const budget = 20;
    const l1 = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", budget);
    const l5 = shortenTileLabel("EU Commercial Gas Station 01 - L5 2x2", budget);
    assert.notEqual(l1, l5);
  });

  it("never exceeds its budget", () => {
    const budget = 20;
    for (const name of [
      "EU Commercial Gas Station 01 - L1 2x2",
      "Canopy-Covered Parklet With A Very Long Name Indeed",
      "A",
      "",
    ]) {
      assert.ok(
        shortenTileLabel(name, budget).length <= budget,
        `"${name}" shortened past its budget`
      );
    }
  });

  it("keeps some of the head so the family is still recognisable", () => {
    const shortened = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 20);
    assert.ok(shortened.startsWith("EU"), `expected a recognisable head, got ${shortened}`);
  });

  it("still keeps the tail at a budget too small to be useful", () => {
    const shortened = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 3);
    assert.equal(shortened.length, 3);
    assert.ok(shortened.endsWith("2"), `expected the tail to survive, got ${shortened}`);
    assert.ok(shortened.includes("…"), `expected truncation to be marked, got ${shortened}`);
  });

  it("marks every truncation, so a cut name never reads as the whole name", () => {
    assert.ok(shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 20).includes("…"));
    assert.ok(!shortenTileLabel("Auto Center", 20).includes("…"));
  });

  it("scales the budget with the configured tile size", () => {
    assert.equal(tileLabelLineBudget(88), 11);
    assert.ok(tileLabelCharBudget(132) > tileLabelCharBudget(88));
    assert.ok(tileLabelCharBudget(60) < tileLabelCharBudget(88));
  });

  it("keeps a usable budget for nonsense tile sizes", () => {
    // Falls back to DEFAULT_TILE_SIZE (100rem), which budgets 13 per line.
    assert.equal(tileLabelLineBudget(Number.NaN), 13);
    assert.equal(tileLabelLineBudget(0), 13);
    assert.ok(tileLabelLineBudget(1) >= 4);
  });
});

describe("Tile label budget at the tile's actual width", () => {
  it("budgets the thirteen characters measured on the running game", () => {
    // 100rem tile draws a 64px label box at 10.67px Overpass, where the game's
    // own names measure ~4.9px per character. The 11 this used to claim was a
    // chars-per-rem estimate carried forward from an older estimate.
    assert.equal(tileLabelLineBudget(100), 13);
  });

  it("budgets two lines, because one could not hold the names", () => {
    assert.equal(tileLabelCharBudget(100), 26);
  });

  it("scales with a larger tile", () => {
    assert.equal(tileLabelLineBudget(144), 19);
  });

  it("never budgets below four characters", () => {
    assert.equal(tileLabelLineBudget(1), 4);
  });
});

describe("Wrapping a name over the tile's lines", () => {
  const LINE = tileLabelLineBudget(100);

  it("breaks at a word rather than mid-word", () => {
    // The case that made this necessary: at one line these read "Bus…lter" and
    // "Sma…epot", which named the family twice and the building never.
    assert.deepEqual(wrapTileLabel("Bus Stop Shelter", LINE), ["Bus Stop", "Shelter"]);
    assert.deepEqual(wrapTileLabel("Small Taxi Depot", LINE), ["Small Taxi", "Depot"]);
  });

  it("uses one line when the name fits on one", () => {
    assert.deepEqual(wrapTileLabel("Bus Stop Sign", LINE), ["Bus Stop Sign"]);
    assert.deepEqual(wrapTileLabel("Taxi Stand", LINE), ["Taxi Stand"]);
  });

  it("keeps two names apart that one line merged", () => {
    const shelter = wrapTileLabel("Bus Stop Shelter", LINE).join(" ");
    const sign = wrapTileLabel("Bus Stop Sign", LINE).join(" ");
    const taxi = wrapTileLabel("Taxi Shelter", LINE).join(" ");

    assert.notEqual(shelter, sign);
    assert.notEqual(shelter, taxi);
  });

  it("elides only the last line, and only when the name overruns both", () => {
    const lines = wrapTileLabel("Bus Stop Shelter with Bicycle Stands", LINE);

    assert.equal(lines.length, 2);
    assert.ok(!lines[0].includes("…"), `the first line should be whole words, got ${lines[0]}`);
    assert.ok(lines[1].includes("…"), `the overrun should be marked, got ${lines[1]}`);
  });

  it("never draws more lines than it was given, or a line past its budget", () => {
    for (const name of [
      "Bus Stop Shelter with Bicycle Stands",
      "EU Commercial Gas Station 01 - L1 2x2",
      "Canopy-Covered Parklet With A Very Long Name Indeed",
      "Antidisestablishmentarianism Hall",
      "A",
      "",
    ]) {
      const lines = wrapTileLabel(name, LINE);
      assert.ok(lines.length <= 2, `"${name}" drew ${lines.length} lines`);
      for (const line of lines) {
        assert.ok(line.length <= LINE, `"${name}" drew "${line}", past ${LINE}`);
      }
    }
  });

  it("gives a word longer than a line a line of its own rather than swallowing the rest", () => {
    const lines = wrapTileLabel("Antidisestablishmentarianism Hall", LINE);

    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes("…"));
    assert.equal(lines[1], "Hall");
  });

  it("still keeps the distinguishing tail across the wrap", () => {
    const a = wrapTileLabel("Gas Station 01 - L1 2x2", LINE).join(" ");
    const b = wrapTileLabel("Gas Station 01 - L1 3x2", LINE).join(" ");

    assert.notEqual(a, b);
    assert.ok(a.endsWith("2x2"), `expected the lot size to survive, got ${a}`);
    assert.ok(b.endsWith("3x2"), `expected the lot size to survive, got ${b}`);
  });

  it("drops a whole word before it cuts one", () => {
    // "One-Way Public Transport Lane" is the case: the last line cut to
    // "Public…t Lane", and "t Lane" is a fragment where "…Lane" is a gap.
    assert.deepEqual(wrapTileLabel("One-Way Public Transport Lane", LINE), [
      "One-Way",
      "Public…Lane",
    ]);
  });

  it("cuts a word only when no whole-word fit is left", () => {
    const lines = wrapTileLabel("Bus Stop Shelter with Bicycle Stands", LINE);

    // "Shelter…Stands" is 14 against a 13-character line, so there is no pair
    // of whole words that fits and the character cut is the honest answer.
    assert.equal(lines[1], "Shelte…Stands");
  });

  it("draws nothing for an empty name", () => {
    assert.deepEqual(wrapTileLabel("", LINE), []);
    assert.deepEqual(wrapTileLabel("   ", LINE), []);
  });
});
