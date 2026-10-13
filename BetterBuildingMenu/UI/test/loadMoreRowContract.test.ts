import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

// The load-more row holds Load more, or at the ceiling the cap's hint. A button
// as wide as the whole row would reach past the build menu by its padding, so
// the button takes what the row leaves.
describe("the load-more row", () => {
  const button = declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", ".loadMore");

  it("gives the button the row's room, not a width of its own", () => {
    assert.notEqual(button.width, "100%");
    assert.equal(button.flex, "1 1 auto");
    assert.equal(button["min-width"], "0");
  });
});
