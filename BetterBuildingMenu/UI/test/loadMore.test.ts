import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG_WINDOW_STEP, loadMoreCount } from "../src/domain/catalogWindow.ts";

describe("the Load more button", () => {
  it("names the step, or what is left when that is less", () => {
    assert.equal(loadMoreCount(250), CATALOG_WINDOW_STEP);
    assert.equal(loadMoreCount(37), 37);
  });

  it("names a screen of rows while the page still has undrawn ones", () => {
    // The table draws a screen at a time from the page before asking C# for more.
    assert.equal(loadMoreCount(197, 7), 7);
    assert.equal(loadMoreCount(3, 7), 3);
  });
});
