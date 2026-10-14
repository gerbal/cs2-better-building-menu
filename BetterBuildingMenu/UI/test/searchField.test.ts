import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { blurSearchField } from "../src/mods/TopRow/searchField.ts";
import { fakeField, fakeSearchField, keysPage } from "./harness/fakeKeys.ts";

const globals = globalThis as unknown as Record<string, unknown>;

describe("giving the keys back", () => {
  const saved = globals.document;

  afterEach(() => {
    globals.document = saved;
  });

  it("blurs the search field when it has focus", () => {
    const field = fakeSearchField();
    globals.document = keysPage(field).document;

    blurSearchField();

    assert.equal(field.blurred, 1);
  });

  it("leaves any other focused field alone, and does nothing without a page", () => {
    const range = fakeField("rangeInput");
    globals.document = keysPage(range).document;

    blurSearchField();
    assert.equal(range.blurred, 0, "a metric bound keeps its keys");

    globals.document = undefined;
    assert.doesNotThrow(() => blurSearchField());
  });
});
