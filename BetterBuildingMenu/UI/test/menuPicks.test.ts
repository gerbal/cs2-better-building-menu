import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { menuPickOf } from "../src/domain/menuPicks";

describe("a menu's own pick", () => {
  const picks = [{ menu: "Roads", value: "tiles" }, { menu: "Parks & Recreation", value: "list" }];

  it("is read by the menu's exact name", () => {
    assert.equal(menuPickOf(picks, "Parks & Recreation"), "list");
    assert.equal(menuPickOf(picks, "roads"), "");
  });

  it("is none while C# has said nothing or no menu is open", () => {
    assert.equal(menuPickOf(null, "Roads"), "");
    assert.equal(menuPickOf(undefined, "Roads"), "");
    assert.equal(menuPickOf(picks, ""), "");
  });
});
