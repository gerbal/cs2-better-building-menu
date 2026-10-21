import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shownMenu, type KeptMenus } from "../src/domain/keptMenus.ts";

// One built panel per toolbar menu, each holding the page it last drew. Which one is
// in the slot decides whether an open is instant and whether it is correct: a panel
// may stand in for its own menu, never for another's.

const built = (entries: Record<string, string>) => new Map(Object.entries(entries));
const state = (over: Partial<KeptMenus>): KeptMenus => ({ opened: "Roads", answered: false, built: built({}), stale: new Set(), held: null, ...over });

describe("which kept menu the slot shows", () => {
  it("shows nothing with no menu open", () => {
    assert.equal(shownMenu(state({ opened: null, built: built({ Roads: "Roads" }) })), null);
  });

  it("shows a menu's own panel at once when it last drew that menu's opening view", () => {
    // A reopen, or a switch to a menu opened before: the click frame.
    assert.equal(shownMenu(state({ built: built({ Roads: "Roads", Zones: "Zones" }) })), "Roads");
  });

  it("waits for C# when the menu's panel was left on a category or a search", () => {
    // Its page answered a narrower query; the menu opens on its opening view.
    assert.equal(shownMenu(state({ built: built({ Roads: "" }) })), null);
    assert.equal(shownMenu(state({ built: built({ Roads: "" }), answered: true })), "Roads");
  });

  it("waits for C# when the menu's panel was drawn in another view or grouping", () => {
    // The player changed the view while this menu was hidden: shown now, its catalog
    // would be rebuilt in the new view on screen, a blank frame. The menu already up
    // stays meanwhile, as on a switch to a menu not yet built.
    const drawnInGrid = state({ built: built({ Roads: "Roads", Zones: "Zones" }), stale: new Set(["Roads"]) });

    assert.equal(shownMenu(drawnInGrid), null);
    assert.equal(shownMenu({ ...drawnInGrid, held: "Zones" }), "Zones");
    assert.equal(shownMenu({ ...drawnInGrid, answered: true }), "Roads");
  });

  it("waits for C# when the menu has no panel yet", () => {
    assert.equal(shownMenu(state({ built: built({ Zones: "Zones" }) })), null);
  });

  it("shows the opened menu once C# has answered", () => {
    // The caller builds a first-visit panel in the same render.
    assert.equal(shownMenu(state({ answered: true, built: built({ Roads: "Zones" }) })), "Roads");
  });

  it("keeps the panel that was up through a switch to a menu that cannot show yet", () => {
    // A switch with the menu up: the old menu stays, as it always has, rather than
    // the slot going empty for the round trip.
    assert.equal(shownMenu(state({ built: built({ Zones: "Zones" }), held: "Zones" })), "Zones");
    assert.equal(shownMenu(state({ built: built({ Roads: "", Zones: "Zones" }), held: "Zones" })), "Zones");
  });

  it("lets the opened menu replace the held one as soon as it can show", () => {
    assert.equal(shownMenu(state({ built: built({ Roads: "Roads", Zones: "Zones" }), held: "Zones" })), "Roads");
  });

  it("never stands one menu's panel in for a menu opened without a name", () => {
    // Only OwnsCurrentMenu put the slot up: its panel waits for C# like any first open.
    assert.equal(shownMenu(state({ opened: "", built: built({ "": "" }) })), null);
    assert.equal(shownMenu(state({ opened: "", built: built({ "": "" }), answered: true })), "");
  });
});
