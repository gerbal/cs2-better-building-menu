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
// The reader CardLine hands the scheduler, made once for every line.
const flagOverflow = card.slice(card.indexOf("\nconst flagOverflow = "), card.indexOf("const CardLine"));
// The scheduler the line reads through, shared with the tile name.
const settled = readFileSync(new URL("../src/mods/useSettledMeasure.ts", import.meta.url), "utf8");

describe("a hover card line measures what Cohtml has laid out", () => {
  it("is its own component, measured from its own box", () => {
    assert.ok(cardLine.length > 0, "CardLine should come before HoverCardContent");
    assert.match(flagOverflow, /overflowsBox\(/);
    assert.match(cardLine, /styles\.cardLineWide/);
  });

  it("never reads the line in the same tick as the render that changed it", () => {
    for (const source of [cardLine, settled]) {
      assert.doesNotMatch(source, /\n\s*measure\([^)]*\);/, "a bare measure() call reads the previous text's layout");
    }
  });

  it("defers every read a frame, observer callbacks included", () => {
    assert.match(cardLine, /useSettledMeasure\(lineRef,/);
    assert.match(settled, /new ResizeObserver\((?!measure\))/);
    assert.match(settled, /requestAnimationFrame/);
  });

  it("hands the scheduler one reader for every line, not one built per render", () => {
    // A card line renders per line of every card shown; stacked or overflowed, it reads nothing.
    assert.ok(flagOverflow.length > 0, "flagOverflow is a module-level const ahead of CardLine");
    assert.match(cardLine, /useSettledMeasure\(lineRef, stacked \|\| overflowed \? null : flagOverflow, \[/);
  });

  it("measures new words afresh", () => {
    assert.match(cardLine, /setOverflowed\(false\);\s*\}, \[line\.label, line\.value\]\)/);
  });
});
