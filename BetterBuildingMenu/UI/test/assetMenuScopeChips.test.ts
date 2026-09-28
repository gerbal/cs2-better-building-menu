import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isScopedToMenu,
  assetMenuScopeChipsFor,
  type AssetMenuScopeState,
} from "../src/domain/assetMenuScopeChips.ts";

const state = (over: Partial<AssetMenuScopeState> = {}): AssetMenuScopeState => ({
  menu: "",
  menuCategory: "",
  menuCategoryCount: 0,
  ...over,
});

describe("menu scope", () => {
  it("treats empty and whitespace as unscoped", () => {
    assert.equal(isScopedToMenu(""), false);
    assert.equal(isScopedToMenu("   "), false);
    assert.equal(isScopedToMenu(null), false);
    assert.equal(isScopedToMenu(undefined), false);
    assert.equal(isScopedToMenu("GarbageManagement"), true);
  });
});

describe("which navigation chips get drawn", () => {
  it("always offers the menu chip, so a menu can be picked without the toolbar", () => {
    // A bottom-bar icon is a shortcut to a menu. If the menu is a facet then it
    // has to be reachable from the filters too, or Zones is a view only the
    // toolbar can produce.
    assert.equal(assetMenuScopeChipsFor(state()).menu, true);
    assert.equal(assetMenuScopeChipsFor(state({ menu: "Roads" })).menu, true);
    assert.equal(assetMenuScopeChipsFor(null).menu, true);
  });

  it("offers the category chip only where there is a choice to make", () => {
    // Same threshold as the tab strip: Water & Sewage has one category, and a
    // control whose only value is the one already set is not a control.
    assert.equal(assetMenuScopeChipsFor(state({ menu: "WaterSewage", menuCategoryCount: 1 })).menuCategory, false);
    assert.equal(assetMenuScopeChipsFor(state({ menu: "Transportation", menuCategoryCount: 6 })).menuCategory, true);
  });

  it("offers no category chip outside a menu", () => {
    // The categories are a menu's; "All menus" has none of its own.
    assert.equal(assetMenuScopeChipsFor(state({ menuCategoryCount: 6 })).menuCategory, false);
  });

  it("draws exactly two kinds of chip", () => {
    // Only the menu's own scope, not the mod's former Section/Type taxonomy.
    assert.deepEqual(Object.keys(assetMenuScopeChipsFor(state())).sort(), ["menu", "menuCategory"]);
  });

  it("survives a null state before the first publish", () => {
    assert.deepEqual(assetMenuScopeChipsFor(null), { menu: true, menuCategory: false });
  });
});
