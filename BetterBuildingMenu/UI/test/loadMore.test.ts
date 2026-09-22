import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  CATALOG_LOAD_MORE_RETRY_MS,
  CATALOG_WINDOW_STEP,
  canRequestMore,
  loadMoreCount,
} from "../src/domain/catalogWindow.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("the Load more button", () => {
  it("steps by what the backend adds per request", () => {
    // BuildingCatalogLensState.LoadMore grows the window by WindowStep; the
    // label promised the window's size, so it said "300 more" and loaded 100.
    const query = read("../../Domain/BuildingCatalogQuery.cs");
    const step = Number(/const int WindowStep = (\d+);/.exec(query)?.[1]);
    assert.equal(CATALOG_WINDOW_STEP, step);
  });

  it("names the step, or what is left when that is less", () => {
    assert.equal(loadMoreCount(250), CATALOG_WINDOW_STEP);
    assert.equal(loadMoreCount(37), 37);
  });
});

describe("one Load more request per published page", () => {
  const page = {};

  it("asks when nothing is pending", () => {
    assert.equal(canRequestMore(null, page, 0), true);
  });

  it("does not ask again for the page it already asked from", () => {
    // Each request adds a step in C#, so a double click, or the scroll poll
    // firing again before the answer lands, loaded two steps.
    assert.equal(canRequestMore({ page, at: 0 }, page, 10), false);
  });

  it("asks again once a new page has arrived", () => {
    assert.equal(canRequestMore({ page, at: 0 }, {}, 10), true);
  });

  it("asks again if the answer never came, so the list cannot stall", () => {
    assert.equal(canRequestMore({ page, at: 0 }, page, CATALOG_LOAD_MORE_RETRY_MS), true);
  });
});
