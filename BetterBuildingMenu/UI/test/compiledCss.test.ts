import assert from "node:assert/strict";
import { describe, it } from "node:test";
import postcss from "postcss";
import { declarationsIn, sides } from "./harness/compiledCss.ts";

const read = (css: string, selector = ".x") => declarationsIn(postcss.parse(css), selector);

/**
 * The contract tests read a rule's padding and margin as four sides. They are
 * only as good as that reading: it has to be what the engine draws, whichever
 * way round the stylesheet spells it.
 */
describe("compiled declarations", () => {
  it("apply a longhand written after its shorthand to that side", () => {
    // The case that passed every contract test before: the header's reserve
    // stated in the shorthand, and a later longhand drawing something else.
    const x = read(".x { padding: 5rem 37rem 3rem 8rem; padding-right: 60rem; }");
    assert.equal(sides(x?.padding)[1], "60rem");
    assert.equal(x?.["padding-right"], "60rem");
  });

  it("apply a shorthand written after a longhand to every side, the longhand included", () => {
    const x = read(".x { margin-left: 3rem; margin: 0 1rem; }");
    assert.deepEqual(sides(x?.margin), ["0", "1rem", "0", "1rem"]);
    assert.equal(x?.["margin-left"], "1rem");
  });

  it("resolve across every rule naming the selector, in source order", () => {
    const x = read(".x { padding: 4rem 12rem; } .y { padding: 1rem; } .x { padding-bottom: 0; }");
    assert.deepEqual(sides(x?.padding), ["4rem", "12rem", "0", "12rem"]);
  });

  it("leave a shorthand's own spelling alone when nothing overrides it", () => {
    assert.equal(read(".x { padding: 4rem 12rem; }")?.padding, "4rem 12rem");
  });

  it("not invent longhands a rule never wrote", () => {
    assert.equal(read(".x { margin: 0; }")?.["margin-left"], undefined);
  });

  it("keep an !important value over a later plain one, either way round", () => {
    const shorthandWins = read(".x { padding: 2rem !important; padding-right: 9rem; }");
    assert.equal(shorthandWins?.padding, "2rem !important");
    assert.equal(sides(shorthandWins?.padding.replace(" !important", ""))[1], "2rem");

    const longhandWins = read(".x { padding-right: 9rem !important; padding: 2rem; }");
    assert.equal(longhandWins?.["padding-right"], "9rem !important");
  });

  it("report no declarations for a selector no rule names", () => {
    assert.equal(read(".y { padding: 0; }"), undefined);
  });
});
