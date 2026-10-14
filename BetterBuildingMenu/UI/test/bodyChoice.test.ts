import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoBody, chooseBody, ICONS_ABOVE, ICONS_NAMED, menuView, namesIcons, type MenuShare } from "../src/domain/bodyChoice";

// The shares of the 2026-10-06 capture's menus: rows, then how many carry a cost or a capacity, a capacity, a lock.
const share = (menu: string, rows: number, costOrCapacity: number, capacity: number, locked = 0): MenuShare =>
  ({ menu, rows, costOrCapacity, capacity, locked });
const CAPTURE: Record<string, MenuShare> = {
  roads: share("Roads", 779, 602, 1, 173),
  parks: share("Parks & Recreation", 165, 162, 0, 67),
  transportation: share("Transportation", 272, 236, 4, 219),
  education: share("Education & Research", 70, 70, 65, 21),
  landscaping: share("Landscaping", 1806, 175, 0, 9),
  signatures: share("Signatures", 460, 15, 0, 276),
  extraAssets: share("ExtraAssetsMenu", 251, 0, 0),
  zones: share("Zones", 96, 0, 0, 14),
  areas: share("Areas", 3, 0, 0),
};
const auto = (menu: MenuShare | null, over: Partial<Parameters<typeof autoBody>[0]> = {}) =>
  autoBody({ share: menu, textScale: 1, step: 1, knobs: {}, ...over });

describe("Standard's Auto", () => {
  it("draws Roads, Parks, Transportation and the service menus as the list", () => {
    for (const menu of [CAPTURE.roads, CAPTURE.parks, CAPTURE.transportation, CAPTURE.education]) {
      assert.equal(auto(menu), "list", menu.menu);
    }
  });

  it("draws Landscaping, Signatures and Extra Assets as icons", () => {
    for (const menu of [CAPTURE.landscaping, CAPTURE.signatures, CAPTURE.extraAssets]) {
      assert.equal(auto(menu), "icons", menu.menu);
    }
  });

  it("draws Zones and Areas as tiles", () => {
    assert.equal(auto(CAPTURE.zones), "tiles");
    assert.equal(auto(CAPTURE.areas), "tiles");
  });

  it("never draws Cards, at any step, as it ships", () => {
    for (const menu of Object.values(CAPTURE)) {
      for (const step of [1, 2, 3, 4, 5]) {
        assert.notEqual(auto(menu, { step }), "cards", `${menu.menu} at step ${step}`);
      }
    }
  });

  it("draws Cards from the step the Cards from width knob names", () => {
    assert.equal(auto(CAPTURE.roads, { step: 2, knobs: { cardsFrom: 3 } }), "list");
    assert.equal(auto(CAPTURE.roads, { step: 3, knobs: { cardsFrom: 3 } }), "cards");
  });

  it("counts a capacity only under the What counts knob, which turns Roads to tiles", () => {
    assert.equal(auto(CAPTURE.roads, { knobs: { whatCounts: "capacityOnly" } }), "tiles");
    assert.equal(auto(CAPTURE.education, { knobs: { whatCounts: "capacityOnly" } }), "list");
  });

  it("draws a list from the share the List share knob sets", () => {
    // Roads' 602 of 779 is 77%: a list up to that share, icons above.
    assert.equal(auto(CAPTURE.roads, { knobs: { listShare: 77 } }), "list");
    assert.equal(auto(CAPTURE.roads, { knobs: { listShare: 80 } }), "icons");
  });

  it("forces Roads and Parks above 100% text by the Auto at large text knob, and only them", () => {
    assert.equal(auto(CAPTURE.roads, { textScale: 1.1, knobs: { autoLargeText: "tiles" } }), "tiles");
    assert.equal(auto(CAPTURE.parks, { textScale: 1.3, knobs: { autoLargeText: "tiles" } }), "tiles");
    assert.equal(auto(CAPTURE.roads, { textScale: 1, knobs: { autoLargeText: "tiles" } }), "list");
    assert.equal(auto(CAPTURE.education, { textScale: 1.3, knobs: { autoLargeText: "tiles" } }), "list");
    assert.equal(auto(CAPTURE.roads, { textScale: 1.3, knobs: { autoLargeText: "lookOwn" } }), "list");
  });

  it("forces the list too, where the look's own would draw the tiles", () => {
    const knobs = { whatCounts: "capacityOnly", autoLargeText: "list" };

    assert.equal(auto(CAPTURE.roads, { textScale: 1, knobs }), "tiles");
    assert.equal(auto(CAPTURE.roads, { textScale: 1.1, knobs }), "list");
  });

  it("draws icons only for a menu over 200 rows, tiles at 200 and below", () => {
    assert.equal(auto(share("Props", ICONS_ABOVE + 1, 0, 0)), "icons");
    assert.equal(auto(share("Props", ICONS_ABOVE, 0, 0)), "tiles");
    assert.equal(auto(share("Small", 50, 0, 0)), "tiles");
  });

  it("draws icons from the row count the Icons above knob sets", () => {
    assert.equal(auto(share("Props", 150, 0, 0), { knobs: { iconsAbove: 100 } }), "icons");
    assert.equal(auto(CAPTURE.extraAssets, { knobs: { iconsAbove: 300 } }), "tiles");
  });

  it("draws the list for a menu C# has not counted yet, or one with nothing in it", () => {
    assert.equal(auto(null), "list");
    assert.equal(auto(share("Empty", 0, 0, 0)), "list");
  });
});

describe("what a menu draws", () => {
  it("is its own pick, over Default view and Auto", () => {
    assert.equal(chooseBody({ searching: false, menuPick: "cards", defaultView: "tiles", auto: "list" }), "cards");
  });

  it("is Default view's body for a menu with no pick, unless Default view is Auto", () => {
    assert.equal(chooseBody({ searching: false, menuPick: "", defaultView: "tiles", auto: "list" }), "tiles");
    assert.equal(chooseBody({ searching: false, menuPick: "", defaultView: "auto", auto: "icons" }), "icons");
  });

  it("reads a stored value it does not know as no pick", () => {
    assert.equal(chooseBody({ searching: false, menuPick: "grid", defaultView: "table", auto: "tiles" }), "tiles");
  });

  it("is the list while a query is typed, kept as Cards where the menu's view is Cards", () => {
    assert.equal(chooseBody({ searching: true, menuPick: "tiles", defaultView: "auto", auto: "list" }), "list");
    assert.equal(chooseBody({ searching: true, menuPick: "", defaultView: "auto", auto: "icons" }), "list");
    assert.equal(chooseBody({ searching: true, menuPick: "cards", defaultView: "auto", auto: "list" }), "cards");
    assert.equal(chooseBody({ searching: true, menuPick: "", defaultView: "cards", auto: "list" }), "cards");
  });

  it("names the menu's view unsearched, for VIEW's Default view row", () => {
    assert.equal(menuView({ menuPick: "", defaultView: "auto", auto: "tiles" }), "tiles");
  });

  it("draws the icons for the icons with names, which name their pictures until a query is typed", () => {
    assert.equal(chooseBody({ searching: false, menuPick: ICONS_NAMED, defaultView: "list", auto: "list" }), "icons");
    assert.equal(chooseBody({ searching: true, menuPick: ICONS_NAMED, defaultView: "list", auto: "list" }), "list");
    assert.equal(namesIcons(ICONS_NAMED, "icons"), true);
    assert.equal(namesIcons(ICONS_NAMED, "list"), false);
    assert.equal(namesIcons("icons", "icons"), false);
  });
});
