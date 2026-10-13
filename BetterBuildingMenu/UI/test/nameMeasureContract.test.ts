import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * A source contract, in the stylesheetContracts pattern: the rule exists
 * because the live game drew something wrong that no render test can see.
 *
 * A line whose text has just been swapped still reports the PREVIOUS text's
 * scrollWidth in the same tick, and a brand-new line reads 0. Measuring
 * synchronously after every re-render narrows the room for nothing.
 */
const tileName = readFileSync(new URL("../src/mods/Bodies/PlannedName.tsx", import.meta.url), "utf8");

describe("a planned name measures what Cohtml has laid out", () => {
  it("never reads the lines in the same tick as the render that changed them", () => {
    assert.doesNotMatch(tileName, /\n\s*measure\(\);/, "a bare measure() call reads the previous text's layout");
  });

  it("defers every read a frame, observer callbacks included", () => {
    // The observer's callback is the deferral, not the measurement.
    assert.match(tileName, /new ResizeObserver\((?!measure\))/);
    assert.match(tileName, /requestAnimationFrame/);
  });

  it("takes the room from the shared reader", () => {
    assert.match(tileName, /drawnRoom\(/);
  });

  it("reads no room from a box that hugs its line, which would narrow it every frame", () => {
    // The tiles' name line is as wide as its text: planned again in that width, a name drawn narrower
    // than its estimate is cut, its box narrows, and so on down to its shortest cut.
    const tiles = readFileSync(new URL("../src/mods/Bodies/TilesBody.tsx", import.meta.url), "utf8");
    const lineName = /<PlannedName\s+className=\{styles\.lineName\}[^>]*\/>/.exec(tiles)?.[0] ?? "";

    assert.match(lineName, /\shugs\s/);
    assert.match(tileName, /drawnRoom\(drawn, hugs \? NO_BOX : box,/);
    assert.match(tileName, /const NO_BOX = \{ clientWidth: 0 \};/);
  });
});
