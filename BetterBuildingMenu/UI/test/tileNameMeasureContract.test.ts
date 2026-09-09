import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * A source contract, in the stylesheetContracts pattern: the rule exists
 * because the live game drew something wrong that no render test can see.
 *
 * Measured 2026-09-09 (main prefix, 1280x720, Roads in Grid at the default
 * tile size): 77 of 100 tiles carried an ellipsis and twelve had collapsed
 * to "…e…d" — two characters a line. In the page, a line whose text had just
 * been swapped from a long name to a short one still reported the long
 * text's scrollWidth (171px in a 64px box) in the same tick, and only read
 * 64px a frame later; a brand-new line read 0. The tile name's fit loop
 * measured synchronously after every re-render, so each pass saw the
 * previous text's overflow and shrank the budget again, to the floor.
 */
const grid = readFileSync(new URL("../src/mods/BuildingGrid/BuildingGrid.tsx", import.meta.url), "utf8");
const tileName = grid.slice(grid.indexOf("const TileName"), grid.indexOf("export const BuildingGrid"));

describe("the tile name measures what Cohtml has laid out", () => {
  it("never reads the lines in the same tick as the render that changed them", () => {
    assert.doesNotMatch(tileName, /\n\s*measure\(\);/, "a bare measure() call reads the previous text's layout");
  });

  it("defers every read a frame, observer callbacks included", () => {
    // The observer's callback is the deferral, not the measurement.
    assert.match(tileName, /new ResizeObserver\((?!measure\))/);
    assert.match(tileName, /requestAnimationFrame/);
  });

  it("takes the budget from the shared reader", () => {
    assert.match(tileName, /lineBudgetFromDrawn\(/);
  });
});
