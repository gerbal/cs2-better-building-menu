import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fontSizeRatio } from "../src/domain/textScale.ts";
import { tileLabelLineBudget, tableLabelCharBudget } from "../src/domain/tileLabel.ts";
import { BUILDING_LENS_MAX_WIDTH } from "../src/domain/sharedContracts.generated.ts";
import { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_PANEL_CHROME_WIDTH, BUILDING_LENS_CONTROL_PANE_TOTAL, BUILDING_LENS_IDENTITY_MIN, BUILDING_LENS_TABLE_ROW_FURNITURE } from "../src/domain/buildingLensLayout.ts";

// The game's Interface › Text scale setting (100–150 %) reaches the page as
// --fontScale and --fontScaleChange, and every --fontSize* is a calc() of the
// two — so a character budget that assumes 100 % overruns its line above it.
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
    // A 144rem tile budgets seventeen at 100 %, which already fills its line,
    // so a scaled budget has no margin to round into and floors instead.
    assert.equal(tileLabelLineBudget(144, 1.25), 11);
  });

  it("shrinks the table's name budget with the S size", () => {
    assert.ok(tableLabelCharBudget(276, 1.25) < tableLabelCharBudget(276));
    assert.equal(tableLabelCharBudget(276, 1.25), Math.max(8, Math.round(276 / 100 * 12 / fontSizeRatio("s", 1.25))));
  });

  it("widens the table's metric columns with the S size", () => {
    // Wide enough that the room beside the name never caps the ratio.
    const base = getBuildingLensColumnWidths(3000);
    const scaled = getBuildingLensColumnWidths(3000, 1.25);

    assert.deepEqual(base, BUILDING_LENS_COLUMN_MAX);
    assert.equal(scaled.upkeep, Math.round(BUILDING_LENS_COLUMN_MAX.upkeep * fontSizeRatio("s", 1.25)));
  });
});

describe("the table's columns at a large text scale and a narrow panel", () => {
  // Scaling the columns by the full ratio at the narrowest panel pushes the
  // name cell below its own minimum. The columns scale as far as the panel
  // allows and no further; what does not fit clips inside its cell.
  it("never squeezes the name below its minimum", () => {
    // The assembly plus its chrome — the figure the catalog passes.
    const outer = BUILDING_LENS_MAX_WIDTH + BUILDING_LENS_PANEL_CHROME_WIDTH;
    for (const scale of [1.25, 1.5]) {
      const widths = getBuildingLensColumnWidths(outer, scale);
      const columns = Object.values(widths).reduce((a, b) => a + b, 0);
      const name = outer - BUILDING_LENS_PANEL_CHROME_WIDTH - BUILDING_LENS_CONTROL_PANE_TOTAL - columns - BUILDING_LENS_TABLE_ROW_FURNITURE;

      assert.ok(name >= BUILDING_LENS_IDENTITY_MIN - 1, `at ${scale}: name would get ${name}rem of ${BUILDING_LENS_IDENTITY_MIN}`);
    }
  });

  it("still scales fully where there is room", () => {
    const scaled = getBuildingLensColumnWidths(3000, 1.25);
    assert.equal(scaled.upkeep, Math.round(BUILDING_LENS_COLUMN_MAX.upkeep * fontSizeRatio("s", 1.25)));
  });
});
