import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VIEW_MODE_KINDS, chooseViewMode } from "../src/domain/viewModeChoice.ts";
import { DEFAULT_VIEW_MODE, VIEW_MODES } from "../src/mods/GroupedResults/ViewModeBar.tsx";

describe("which view the build menu draws", () => {
  it("draws the session's pick over the stored view", () => {
    assert.equal(chooseViewMode("table", "list", DEFAULT_VIEW_MODE), "table");
  });

  it("draws the stored view while nothing has been picked this session", () => {
    assert.equal(chooseViewMode("", "list", DEFAULT_VIEW_MODE), "list");
  });

  it("draws Cards with neither", () => {
    assert.equal(chooseViewMode("", "", DEFAULT_VIEW_MODE), "cards");
  });

  it("draws Cards for a stored value it does not know", () => {
    for (const stored of ["tiles", "Grid", null, undefined]) {
      assert.equal(chooseViewMode("", stored, DEFAULT_VIEW_MODE), "cards", String(stored));
    }
  });

  it("knows the kinds the view bar offers, and no others", () => {
    assert.deepEqual([...VIEW_MODE_KINDS].sort(), VIEW_MODES.map((option) => option.id).sort());
  });
});
