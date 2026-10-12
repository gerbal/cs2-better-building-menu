import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enterDecision, isEnterForSearch, isPlainEnter } from "../src/domain/buildingSearchRank.ts";

// Scoring lives in BuildingCatalogRelevance.cs, and C# names the best match with
// the page, chosen from the whole result. What is left here is what Enter does.
const page = (searchText: string, bestMatchId: number | null) => ({ bestMatchId, searchText });

describe("what Enter does", () => {
  it("arms the named best match, wherever grouping or sorting put it", () => {
    assert.deepEqual(enterDecision(page("clinic", 1), "clinic"), { arm: 1 });
  });

  it("arms the best match by id, though its row is not among those loaded", () => {
    // C# chooses it from every match, so it can sit past the window the page holds.
    assert.deepEqual(enterDecision(page("parking", 240), "parking"), { arm: 240 });
  });

  it("waits for the page that answers the search in the box", () => {
    // The box echoes at once; the page follows a debounce later. Arming now would
    // place the previous search's match, or, from no search, nothing at all.
    assert.deepEqual(enterDecision(page("clinic", 1), "school"), { wait: "school" });
    assert.deepEqual(enterDecision(page("", null), "clinic"), { wait: "clinic" });
  });

  it("reads a trailing space in the box as the same search", () => {
    assert.deepEqual(enterDecision(page("clinic", 1), "clinic "), { arm: 1 });
  });

  it("does nothing without a search", () => {
    // Without a query the list is in browse order, and Enter placing whatever
    // happens to sort first would be a destructive surprise.
    assert.equal(enterDecision(page("", 1), ""), null);
    assert.equal(enterDecision(page("", 1), "   "), null);
  });

  it("does nothing when no match can be placed", () => {
    // Nothing matched, or every match is locked or built: C# names no target.
    assert.equal(enterDecision(page("zzzz", null), "zzzz"), null);
  });
});

describe("which keys are Enter", () => {
  it("takes either spelling", () => {
    assert.equal(isPlainEnter({ key: "Enter" }), true);
    // Cohtml can leave `key` empty and fill only `keyCode`.
    assert.equal(isPlainEnter({ key: "", keyCode: 13 }), true);
    assert.equal(isPlainEnter({ key: "a", keyCode: 65 }), false);
  });

  it("leaves an input method's Enter to the composition", () => {
    // Confirming a Japanese candidate must not place a building.
    assert.equal(isPlainEnter({ key: "Enter", keyCode: 13, isComposing: true }), false);
    assert.equal(isPlainEnter({ key: "Process", keyCode: 229 }), false);
  });
});

describe("whose Enter it is", () => {
  const field = (tagName: string) => ({ tagName });

  it("takes Enter from the search box", () => {
    assert.equal(isEnterForSearch(field("TEXTAREA"), true), true);
  });

  it("takes Enter from nowhere in particular", () => {
    assert.equal(isEnterForSearch(null, false), true);
    assert.equal(isEnterForSearch(field("DIV"), false), true);
  });

  it("leaves Enter in any other text field to that field", () => {
    // A metric bound or a filter's option search commits on Enter; placing a
    // building there would throw the edit away.
    assert.equal(isEnterForSearch(field("INPUT"), false), false);
    assert.equal(isEnterForSearch(field("textarea"), false), false);
    assert.equal(isEnterForSearch({ tagName: "DIV", isContentEditable: true }, false), false);
  });
});
