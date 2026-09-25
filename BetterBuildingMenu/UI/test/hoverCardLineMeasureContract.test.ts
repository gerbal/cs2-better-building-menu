import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * A source contract, as for the tile name: a render test draws nothing, so
 * what is held here is how the card line reads what Cohtml laid out. A line
 * whose text has just changed reports the PREVIOUS text's scrollWidth in the
 * same tick, and a brand-new line reads 0.
 */
const card = readFileSync(new URL("../src/mods/BuildingHoverCard/BuildingHoverCard.tsx", import.meta.url), "utf8");
const cardLine = card.slice(card.indexOf("const CardLine"), card.indexOf("const HoverCardContent"));

describe("a hover card line measures what Cohtml has laid out", () => {
  it("is its own component, measured from its own box", () => {
    assert.ok(cardLine.length > 0, "CardLine should come before HoverCardContent");
    assert.match(cardLine, /overflowsBox\(/);
    assert.match(cardLine, /styles\.cardLineWide/);
  });

  it("never reads the line in the same tick as the render that changed it", () => {
    assert.doesNotMatch(cardLine, /\n\s*measure\(\);/, "a bare measure() call reads the previous text's layout");
  });

  it("defers every read a frame, observer callbacks included", () => {
    assert.match(cardLine, /new ResizeObserver\((?!measure\))/);
    assert.match(cardLine, /requestAnimationFrame/);
  });

  it("measures new words afresh", () => {
    assert.match(cardLine, /setOverflowed\(false\);\s*\}, \[line\.label, line\.value\]\)/);
  });
});
