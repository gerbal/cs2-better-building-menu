import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { textWidth } from "../src/domain/textWidth";

describe("a run of text's width", () => {
  it("adds each character's advance in the game's font at the size drawn", () => {
    // Overpass: "R" 0.665, "o" 0.558, "a" 0.526, "d" 0.562 of an em.
    assert.equal(Math.round(textWidth("Road", 14) * 1000) / 1000, Math.round((0.665 + 0.558 + 0.526 + 0.562) * 14 * 1000) / 1000);
    assert.equal(textWidth("", 14), 0);
  });

  it("takes the wider of the game's first two fonts where a figure must fit whatever draws it", () => {
    // "1" is 0.373 in Overpass and 0.551 in Noto Sans.
    assert.equal(Math.round(textWidth("1", 10, "wider") * 1000), 5510);
    assert.equal(Math.round(textWidth("1", 10) * 1000), 3730);
  });

  it("counts a character the table does not hold as wide, an ideograph as a whole em", () => {
    assert.equal(textWidth("中", 10), 10);
    assert.equal(textWidth("ŵ", 10), 6.5);
  });
});
