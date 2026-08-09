import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isScopedToMenu,
  lensScopeChipsFor,
  type LensScopeState,
} from "../src/domain/lensScopeChips.ts";

const state = (over: Partial<LensScopeState> = {}): LensScopeState => ({
  menu: "",
  menuCategory: "",
  menuCategoryCount: 0,
  showZoning: false,
  subCategoryCount: 3,
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
  it("shows section and type only when nothing else is scoping the query", () => {
    const chips = lensScopeChipsFor(state());

    assert.deepEqual(chips, { menu: true, menuCategory: false, section: true, subCategory: true });
  });

  it("always offers the menu chip, so a menu can be picked without the toolbar", () => {
    // A bottom-bar icon is a shortcut to a menu. If the menu is a facet then it
    // has to be reachable from the filters too, or Zones is a view only the
    // toolbar can produce.
    assert.equal(lensScopeChipsFor(state()).menu, true);
    assert.equal(lensScopeChipsFor(state({ menu: "Roads" })).menu, true);
    assert.equal(lensScopeChipsFor(state({ showZoning: true })).menu, true);
    assert.equal(lensScopeChipsFor(null).menu, true);
  });

  it("drops section and type the moment a menu is scoped", () => {
    // This is the whole point of the module. A menu-scoped query skips
    // MatchesBuildMenu (BuildingCatalogQueryEngine.cs:95), so these two chips
    // took clicks, restyled themselves, and were discarded by the query.
    const chips = lensScopeChipsFor(state({ menu: "GarbageManagement", menuCategoryCount: 3 }));

    assert.equal(chips.section, false);
    assert.equal(chips.subCategory, false);
  });

  it("offers the category chip only where there is a choice to make", () => {
    // Same threshold as the tab strip: Water & Sewage has one category, and a
    // control whose only value is the one already set is not a control.
    assert.equal(lensScopeChipsFor(state({ menu: "WaterSewage", menuCategoryCount: 1 })).menuCategory, false);
    assert.equal(lensScopeChipsFor(state({ menu: "Transportation", menuCategoryCount: 6 })).menuCategory, true);
  });

  it("draws no catalog chips over the zoning view", () => {
    // Zoning renders the zone catalog, so "Networks" there would name
    // something that is not on screen.
    const chips = lensScopeChipsFor(state({ showZoning: true }));

    assert.equal(chips.section, false);
    assert.equal(chips.subCategory, false);
  });

  it("hides the type chip when the section offers no types", () => {
    assert.equal(lensScopeChipsFor(state({ subCategoryCount: 0 })).subCategory, false);
  });

  it("survives a null state before the first publish", () => {
    assert.deepEqual(lensScopeChipsFor(null), {
      menu: true,
      menuCategory: false,
      section: true,
      subCategory: false,
    });
  });
});
