import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { CATALOG_WINDOW_STEP, loadMoreCount } from "../src/domain/catalogWindow.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("the Load more button", () => {
  it("steps by what the backend adds per request", () => {
    // BuildingCatalogLensState.LoadMoreTo grows the window by at most WindowStep;
    // a label naming the window's size would say "300 more" and load 100.
    const query = read("../../Domain/BuildingCatalogQuery.cs");
    const step = Number(/const int WindowStep = (\d+);/.exec(query)?.[1]);
    assert.equal(CATALOG_WINDOW_STEP, step);
  });

  it("names the step, or what is left when that is less", () => {
    assert.equal(loadMoreCount(250), CATALOG_WINDOW_STEP);
    assert.equal(loadMoreCount(37), 37);
  });
});
