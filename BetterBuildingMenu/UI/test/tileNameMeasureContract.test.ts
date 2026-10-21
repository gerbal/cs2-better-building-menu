import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * A source contract, in the stylesheetContracts pattern: the rule exists
 * because the live game drew something wrong that no render test can see.
 *
 * A line whose text has just been swapped still reports the PREVIOUS text's
 * scrollWidth in the same tick, and a brand-new line reads 0. Measuring
 * synchronously after every re-render shrinks the budget to its floor.
 */
const grid = readFileSync(new URL("../src/mods/BuildingGrid/BuildingGrid.tsx", import.meta.url), "utf8");
const tileName = grid.slice(grid.indexOf("const TileName"), grid.indexOf("export const BuildingGrid"));
// The scheduler the tile name reads through, shared with the hover card's line.
const settled = readFileSync(new URL("../src/mods/useSettledMeasure.ts", import.meta.url), "utf8");

describe("the tile name measures what Cohtml has laid out", () => {
  it("never reads the lines in the same tick as the render that changed them", () => {
    for (const source of [tileName, settled]) {
      assert.doesNotMatch(source, /\n\s*measure\([^)]*\);/, "a bare measure() call reads the previous text's layout");
    }
  });

  it("defers every read a frame, observer callbacks included", () => {
    assert.match(tileName, /useSettledMeasure\(boxRef,/);
    // The observer's callback is the deferral, not the measurement.
    assert.match(settled, /new ResizeObserver\((?!measure\))/);
    assert.match(settled, /requestAnimationFrame/);
  });

  it("takes the budget from the shared reader", () => {
    assert.match(tileName, /lineBudgetFromDrawn\(/);
  });
});
