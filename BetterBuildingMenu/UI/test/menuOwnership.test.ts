import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ownedMenuName,
  ownsSelectedMenu,
  shouldJoinSlot,
  type OwnedAssetMenu,
} from "../src/domain/menuOwnership.ts";

const owned: OwnedAssetMenu[] = [
  { index: 11, name: "Roads" },
  { index: 12, name: "Landscaping" },
];

describe("whether the asset menu stands in for the toolbar's open menu", () => {
  // C# publishes the menus it would take over, so the slot can replace vanilla's menu in
  // the frame the game opens it rather than a round trip later, when OwnsCurrentMenu says so.

  it("owns a menu C# lists, before C# has heard it was opened", () => {
    assert.equal(ownsSelectedMenu({ replaceEnabled: true, ownsCurrentMenu: false, selectedIndex: 11, owned }), true);
  });

  it("does not own a menu C# leaves to vanilla", () => {
    assert.equal(ownsSelectedMenu({ replaceEnabled: true, ownsCurrentMenu: false, selectedIndex: 99, owned }), false);
  });

  it("owns nothing while the replace option is off, whatever the list still says", () => {
    assert.equal(ownsSelectedMenu({ replaceEnabled: false, ownsCurrentMenu: false, selectedIndex: 11, owned }), false);
  });

  it("owns nothing with no menu open", () => {
    assert.equal(ownsSelectedMenu({ replaceEnabled: true, ownsCurrentMenu: false, selectedIndex: null, owned }), false);
  });

  it("still owns whatever C# says it owns", () => {
    // C# stays the authority: the list only lets the UI act a frame earlier.
    assert.equal(ownsSelectedMenu({ replaceEnabled: true, ownsCurrentMenu: true, selectedIndex: 99, owned: [] }), true);
  });

  it("names the open menu when C# lists it", () => {
    assert.equal(ownedMenuName(12, owned), "Landscaping");
    assert.equal(ownedMenuName(99, owned), null);
    assert.equal(ownedMenuName(null, owned), null);
  });
});

describe("when the kept menu joins the slot", () => {
  const base = { slotMenu: "Roads", pageMenu: "Roads", pageSinceOpen: false, waitedOut: false };

  it("joins at once when the page it holds is the opened menu's", () => {
    // A reopen: the menu is already built with this page, so it shows in the click frame.
    assert.equal(shouldJoinSlot(base), true);
  });

  it("waits while the page it holds is another menu's", () => {
    // A switch: drawing the other menu's header and cards, even for a frame, is worse than
    // drawing nothing for one.
    assert.equal(shouldJoinSlot({ ...base, pageMenu: "Landscaping" }), false);
  });

  it("joins once any page arrives after the slot opened", () => {
    // C#'s answer to the open, whatever it names: an unscoped query, a first open.
    assert.equal(shouldJoinSlot({ ...base, pageMenu: "", pageSinceOpen: true }), true);
  });

  it("joins after the wait runs out, so a page that never comes cannot leave the slot empty", () => {
    assert.equal(shouldJoinSlot({ ...base, pageMenu: "Landscaping", waitedOut: true }), true);
  });

  it("waits when the slot does not know its menu, until C# answers", () => {
    // OwnsCurrentMenu alone put the slot up: no menu name came with it.
    assert.equal(shouldJoinSlot({ ...base, slotMenu: null }), false);
    assert.equal(shouldJoinSlot({ ...base, slotMenu: null, pageSinceOpen: true }), true);
  });

  it("never joins a page with no menu on the strength of names alone", () => {
    assert.equal(shouldJoinSlot({ ...base, slotMenu: "", pageMenu: "" }), false);
  });
});
