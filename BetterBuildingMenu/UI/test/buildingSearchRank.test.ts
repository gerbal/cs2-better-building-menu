import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enterDecision, isEnterForSearch, isPlainEnter } from "../src/domain/buildingSearchRank.ts";

// Scoring lives in BuildingCatalogRelevance.cs, and C# names the best match with
// the page. What is left here is the one rule the UI keeps: what Enter does.
const e = (id: number, name: string) => ({ id, name });
const page = (searchText: string, bestMatchId: number | null, items = [e(2, "Old Clinic"), e(1, "Clinic")]) =>
  ({ items, bestMatchId, searchText });

describe("what Enter does", () => {
  it("arms the named best match, wherever grouping put it", () => {
    // Grouped pages are ordered by group first, so the best match need not lead.
    assert.deepEqual(enterDecision(page("clinic", 1), "clinic"), { arm: e(1, "Clinic") });
  });

  it("waits for the page that answers the search in the box", () => {
    // The box echoes at once; the page follows a debounce later. Arming now would
    // place the previous search's match, or, from no search, nothing at all.
    assert.deepEqual(enterDecision(page("clinic", 1), "school"), { wait: "school" });
    assert.deepEqual(enterDecision(page("", null), "clinic"), { wait: "clinic" });
  });

  it("reads a trailing space in the box as the same search", () => {
    assert.deepEqual(enterDecision(page("clinic", 1), "clinic "), { arm: e(1, "Clinic") });
  });

  it("does nothing without a search", () => {
    // Without a query the grid is in browse order, and Enter placing whatever
    // happens to sort first would be a destructive surprise.
    assert.equal(enterDecision(page("", 1), ""), null);
    assert.equal(enterDecision(page("", 1), "   "), null);
  });

  it("does nothing when nothing on the page can be placed", () => {
    assert.equal(enterDecision(page("zzzz", null, []), "zzzz"), null);
    assert.equal(enterDecision(page("clinic", 7), "clinic"), null);
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
