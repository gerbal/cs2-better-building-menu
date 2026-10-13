import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fontSizeRatio } from "../src/domain/textScale.ts";

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
});
