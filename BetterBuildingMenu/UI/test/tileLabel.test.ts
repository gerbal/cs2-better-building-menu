import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIST_NAME_MAX_CHARS, listLabel, shortenTileLabel } from "../src/domain/tileLabel.ts";

describe("drawn name shortening", () => {
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
    // At or under the budget, not exactly it: the ellipsis is charged
    // ELLIPSIS_CHARS because it draws nearly twice an average letter, so at a
    // budget of three there is room for the mark and one character of tail.
    assert.ok(shortened.length <= 3, `expected to fit the budget, got ${shortened}`);
    assert.ok(shortened.endsWith("2"), `expected the tail to survive, got ${shortened}`);
    assert.ok(shortened.includes("…"), `expected truncation to be marked, got ${shortened}`);
  });

  it("marks every truncation, so a cut name never reads as the whole name", () => {
    assert.ok(shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 20).includes("…"));
    assert.ok(!shortenTileLabel("Auto Center", 20).includes("…"));
  });

});

describe("list and card row names", () => {
  it("draws real names whole, the longest vanilla one included", () => {
    const longest = "Fishing And Open Water Fish Farming Area Hub";
    assert.equal(listLabel(longest), longest);
  });

  it("cuts a name an asset ships repeated, so one row cannot span the asset menu", () => {
    const repeated = "Oriental Pearl Radio & TV Tower".repeat(6);
    const drawn = listLabel(repeated);
    assert.ok(drawn.length <= LIST_NAME_MAX_CHARS, drawn);
    assert.ok(drawn.startsWith("Oriental Pearl"), drawn);
    assert.ok(drawn.includes("…"), drawn);
  });
});
