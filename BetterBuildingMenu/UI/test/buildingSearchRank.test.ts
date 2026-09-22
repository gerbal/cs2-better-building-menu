import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enterTarget } from "../src/domain/buildingSearchRank.ts";

// Scoring lives in BuildingCatalogRelevance.cs, and C# names the best match with
// the page. What is left here is the one rule the UI keeps: what Enter arms.
const e = (id: number, name: string) => ({ id, name });

describe("Enter arms the backend's best match", () => {
  it("arms the named best match, wherever grouping put it", () => {
    // Grouped pages are ordered by group first, so the best match need not lead.
    const page = [e(2, "Old Clinic"), e(1, "Clinic")];
    assert.equal(enterTarget(page, 1, "clinic")!.name, "Clinic");
  });

  it("refuses to arm anything when no search is active", () => {
    // Without a query the grid is in browse order, and Enter placing whatever
    // happens to sort first would be a destructive surprise.
    assert.equal(enterTarget([e(1, "Anything")], 1, ""), null);
    assert.equal(enterTarget([e(1, "Anything")], 1, "   "), null);
  });

  it("refuses when the search matched nothing", () => {
    assert.equal(enterTarget([], null, "zzzz"), null);
    assert.equal(enterTarget([e(1, "Anything")], undefined, "zzzz"), null);
  });

  it("refuses a best match that is not on the page", () => {
    // A stale id from the previous page must not arm a building nobody can see.
    assert.equal(enterTarget([e(1, "Clinic")], 7, "clinic"), null);
  });
});
