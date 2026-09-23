import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG_WINDOW_STEP, loadMoreCount } from "../src/domain/catalogWindow.ts";

describe("the Load more button", () => {
  it("names the step, or what is left when that is less", () => {
    assert.equal(loadMoreCount(250), CATALOG_WINDOW_STEP);
    assert.equal(loadMoreCount(37), 37);
  });
});
