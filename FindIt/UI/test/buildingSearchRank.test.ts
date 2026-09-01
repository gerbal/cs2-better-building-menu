import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { topSearchResult } from "../src/domain/buildingSearchRank.ts";

// Scoring and ranking moved to BuildingCatalogRelevance.cs (cm-jjlv.8); the
// page arrives ordered. What is left here is the one rule the UI keeps: what
// Enter arms.
const e = (id: number, name: string) => ({ id, name });

describe("Enter arms the top result", () => {
  it("names the entry Enter should place", () => {
    // The first entry of a searched page is the backend's best match.
    assert.equal(topSearchResult([e(2, "Medical Clinic"), e(1, "Additional Clinic Center")], "clinic")!.name, "Medical Clinic");
  });

  it("refuses to arm anything when no search is active", () => {
    // Without a query the grid is in browse order, and Enter placing whatever
    // happens to sort first would be a destructive surprise.
    assert.equal(topSearchResult([e(1, "Anything")], ""), null);
    assert.equal(topSearchResult([e(1, "Anything")], "   "), null);
  });

  it("refuses when the search matched nothing", () => {
    assert.equal(topSearchResult([], "zzzz"), null);
  });
});
