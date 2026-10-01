import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

// The load-more row holds "Showing X of Y" and the button side by side. A button
// as wide as the whole row overflowed the build menu by the text's width (~55 px
// at every width, measured in game), so the button takes what the text leaves.
describe("the load-more row", () => {
  const button = declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", ".loadMore");

  it("gives the button the room beside the count, not the whole row", () => {
    assert.notEqual(button.width, "100%");
    assert.equal(button.flex, "1 1 auto");
    assert.equal(button["min-width"], "0");
  });
});
