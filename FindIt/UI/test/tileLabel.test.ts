import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shortenTileLabel,
  stripRedundantNamePrefix,
  tileLabelCharBudget,
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
    assert.equal(tileLabelCharBudget(88), 20);
    assert.ok(tileLabelCharBudget(132) > tileLabelCharBudget(88));
    assert.ok(tileLabelCharBudget(60) < tileLabelCharBudget(88));
  });

  it("keeps a usable budget for nonsense tile sizes", () => {
    assert.equal(tileLabelCharBudget(Number.NaN), 20);
    assert.equal(tileLabelCharBudget(0), 20);
    assert.ok(tileLabelCharBudget(1) >= 8);
  });
});
