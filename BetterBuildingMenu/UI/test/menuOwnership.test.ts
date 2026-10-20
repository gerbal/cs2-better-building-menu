import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextClaim,
  ownedMenuName,
  ownsSelectedMenu,
  shouldJoinSlot,
  type MenuClaim,
  type OwnedAssetMenu,
} from "../src/domain/menuOwnership.ts";

const owned: OwnedAssetMenu[] = [
  { index: 11, name: "Roads" },
  { index: 12, name: "Landscaping" },
];

describe("whether the asset menu stands in for the toolbar's open menu", () => {
  // C# publishes the menus it would take over, so the slot can replace vanilla's menu in
  // the frame the game opens it rather than a round trip later, when OwnsCurrentMenu says so.

  // A selection made after the UI first looked, as every click is.
  const claimed = (selectedIndex: number | null): MenuClaim => nextClaim(nextClaim(null, null, owned), selectedIndex, owned);
  const state = (selectedIndex: number | null, over: Partial<Parameters<typeof ownsSelectedMenu>[0]> = {}) =>
    ({ replaceEnabled: true, ownsCurrentMenu: false, selectedIndex, owned, claim: claimed(selectedIndex), ...over });

  it("owns a menu C# lists, before C# has heard it was opened", () => {
    assert.equal(ownsSelectedMenu(state(11)), true);
  });

  it("does not own a menu C# leaves to vanilla", () => {
    assert.equal(ownsSelectedMenu(state(99)), false);
  });

  it("owns nothing while the replace option is off, whatever the list still says", () => {
    assert.equal(ownsSelectedMenu(state(11, { replaceEnabled: false })), false);
  });

  it("owns nothing with no menu open", () => {
    assert.equal(ownsSelectedMenu(state(null)), false);
  });

  it("still owns whatever C# says it owns", () => {
    // C# stays the authority: the list only lets the UI act a frame earlier.
    assert.equal(ownsSelectedMenu(state(99, { ownsCurrentMenu: true, owned: [] })), true);
  });

  it("lets a menu go when C# drops it from the list", () => {
    // C# yielded after all: the slot goes back to vanilla on the next render.
    assert.equal(ownsSelectedMenu(state(11, { owned: [{ index: 12, name: "Landscaping" }] })), false);
  });

  it("claims a menu only when it is selected while C# lists it", () => {
    // C# hears a selection only when it changes. A menu already open on vanilla's grid
    // that joins the list later (the index came ready, a toolbar filter changed, the mod
    // was subscribed mid-session) would be claimed with no page coming: it stays vanilla's.
    const opened = nextClaim(null, 11, []);
    const listedLater = nextClaim(opened, 11, owned);

    assert.equal(listedLater.claimable, false);
    assert.equal(ownsSelectedMenu({ replaceEnabled: true, ownsCurrentMenu: false, selectedIndex: 11, owned, claim: listedLater }), false);
  });

  it("never claims the menu already open when the UI first looks", () => {
    // Subscribed mid-session with a menu open: the watcher ignores its first look too, so C#
    // would never hear this menu was opened.
    assert.equal(nextClaim(null, 11, owned).claimable, false);
  });

  it("claims a fresh selection of a listed menu, and keeps the claim while it stays open", () => {
    const opened = nextClaim(nextClaim(null, null, owned), 11, owned);

    assert.deepEqual(opened, { index: 11, claimable: true });
    assert.equal(nextClaim(opened, 11, owned), opened);
    assert.deepEqual(nextClaim(opened, 12, owned), { index: 12, claimable: true });
  });

  it("names the open menu when C# lists it", () => {
    assert.equal(ownedMenuName(12, owned), "Landscaping");
    assert.equal(ownedMenuName(99, owned), null);
    assert.equal(ownedMenuName(null, owned), null);
  });
});

describe("when the kept menu joins the slot", () => {
  const base = { slotMenu: "Roads", pageMenu: "Roads", answered: false };

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
    assert.equal(shouldJoinSlot({ ...base, pageMenu: "", answered: true }), true);
  });

  it("joins after the wait runs out, so a page that never comes cannot leave the slot empty", () => {
    // The same flag: KeptAssetMenu marks the slot answered when its wait runs out, and
    // when the slot replaced a joined one (the player switched menus with the menu up).
    assert.equal(shouldJoinSlot({ ...base, pageMenu: "Landscaping", answered: true }), true);
  });

  it("waits when the slot does not know its menu, until C# answers", () => {
    // OwnsCurrentMenu alone put the slot up: no menu name came with it.
    assert.equal(shouldJoinSlot({ ...base, slotMenu: null }), false);
    assert.equal(shouldJoinSlot({ ...base, slotMenu: null, answered: true }), true);
  });

  it("never joins a page with no menu on the strength of names alone", () => {
    assert.equal(shouldJoinSlot({ ...base, slotMenu: "", pageMenu: "" }), false);
  });
});
