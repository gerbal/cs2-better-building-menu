import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * A source contract, in the stylesheetContracts pattern.
 *
 * The characters U+2304 (⌄) and U+2303 (⌃) draw as a missing-glyph box: the
 * game's UI face, Noto Sans, does not carry them. The game ships arrow glyphs
 * as SVG under Media/Glyphs, and those are what its own dropdowns draw.
 */
const row = readFileSync(new URL("../src/mods/BuildingCatalog/TableRow.tsx", import.meta.url), "utf8");

describe("the table row's expand control draws a glyph the game's font can show", () => {
  it("does not use the arrowhead characters Noto Sans lacks", () => {
    assert.doesNotMatch(row, /[⌃⌄‸∧∨]/, "U+2303/U+2304 draw as a box in the game");
  });

  it("draws the game's own stroke arrow glyphs", () => {
    assert.match(row, /Media\/Glyphs\/StrokeArrowDown\.svg/);
    assert.match(row, /Media\/Glyphs\/StrokeArrowUp\.svg/);
  });
});
