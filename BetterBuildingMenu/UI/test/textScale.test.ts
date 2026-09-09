import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fontSizeRatio } from "../src/domain/textScale.ts";
import { tileLabelLineBudget, tableLabelCharBudget } from "../src/domain/tileLabel.ts";
import { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_MAX_WIDTH } from "../src/domain/buildingLensLayout.ts";

// The game's Interface › Text scale setting (100–150 %) reaches the page as
// --fontScale = textScale and --fontScaleChange = textScale − 1, and every
// --fontSize* is a calc() of the two (read off the shipped bundle):
//   XS = 12·s + (s−1)·1.15·12      S = 14·s + (s−1)·1.1·14
//   M  = 14·s + 2 + (s−1)·1.05·14
// Measured live at 125 %: grid tile names overran their line by 10–40px and
// the Table's Cost and Upkeep cells by 15–20px, because every character
// budget and column width assumed 100 %.
describe("the game's text scale", () => {
  it("is a ratio of one at 100 %", () => {
    for (const kind of ["xs", "s", "m"] as const) assert.equal(fontSizeRatio(kind, 1), 1);
  });

  it("grows each size by vanilla's own calc at 125 %", () => {
    assert.ok(Math.abs(fontSizeRatio("m", 1.25) - 23.175 / 16) < 1e-9);
    assert.ok(Math.abs(fontSizeRatio("s", 1.25) - 21.35 / 14) < 1e-9);
    assert.ok(Math.abs(fontSizeRatio("xs", 1.25) - 18.45 / 12) < 1e-9);
  });

  it("shrinks the tile's character budget with the M size, and floors it", () => {
    // Twelve at 100 %; the M size is ×1.448 at 125 %, so eight.
    assert.equal(tileLabelLineBudget(100, 1.25), 8);
    assert.equal(tileLabelLineBudget(100), 12);
    // A 144rem tile budgets seventeen at 100 % and that already fills its
    // line; 17.28 / 1.448 is 11.93, and rounding it up kept "One-Way Road" on
    // one 99px line in a 93px box at 125 %. A scaled budget has no margin to
    // round into, so it floors.
    assert.equal(tileLabelLineBudget(144, 1.25), 11);
  });

  it("shrinks the table's name budget with the S size", () => {
    assert.ok(tableLabelCharBudget(276, 1.25) < tableLabelCharBudget(276));
    assert.equal(tableLabelCharBudget(276, 1.25), Math.max(8, Math.round(276 / 100 * 13 / fontSizeRatio("s", 1.25))));
  });

  it("widens the table's metric columns with the S size", () => {
    const base = getBuildingLensColumnWidths(BUILDING_LENS_MAX_WIDTH);
    const scaled = getBuildingLensColumnWidths(BUILDING_LENS_MAX_WIDTH, 1.25);

    assert.deepEqual(base, BUILDING_LENS_COLUMN_MAX);
    assert.equal(scaled.upkeep, Math.round(BUILDING_LENS_COLUMN_MAX.upkeep * fontSizeRatio("s", 1.25)));
  });
});
