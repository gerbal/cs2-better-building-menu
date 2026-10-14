import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeAction } from "../src/domain/vanillaMenuWatch.ts";

/**
 * What an Escape does, in BBM's half of it. A real Escape arrives as keydown with keyCode 27 (e.key
 * is empty — the usual Cohtml quirk, so match on the code).
 *
 * Away from the search field the rule is one condition, and what is NOT there matters more: telling
 * the press that disarms from the press after it needs the game's disarm notification, which races
 * the keypress, so the tool is not consulted. From the field the game's own input waits, so the press
 * is BBM's alone and goes through an order.
 */
describe("closing the asset menu with Escape", () => {
  it("closes it whenever the asset menu is open and the search field does not have the keys", () => {
    assert.equal(escapeAction({ assetMenuOpen: true }), "closeMenu");
  });

  it("does nothing when the asset menu is not open", () => {
    // Escape belongs to the game then — that press is the player reaching for
    // the pause menu, and they should get it.
    assert.equal(escapeAction({ assetMenuOpen: false }), "none");
    assert.equal(escapeAction({ assetMenuOpen: false, fieldFocused: true, listOpen: true }), "none");
  });

  it("asks nothing about the tool", () => {
    // The guard against re-introducing the race. Any future signal added here
    // has to survive the game reporting a disarm AFTER we were asked.
    assert.equal(escapeAction.length, 1, "takes one argument object");
    const source = escapeAction.toString();
    assert.ok(!/tool/i.test(source), `the rule must not consult the tool: ${source}`);
  });

  it("closes the menu, an open list with it, when the search field does not have the keys", () => {
    // The game's own Escape acts at the same time, so a list closed alone would leave the menu up
    // under a cancelled tool.
    assert.equal(escapeAction({ assetMenuOpen: true, listOpen: true, queryTyped: true }), "closeMenu");
  });
});

describe("Escape from the search field", () => {
  it("closes an open list first, in the top row or over the pane", () => {
    assert.equal(escapeAction({ assetMenuOpen: true, fieldFocused: true, listOpen: true, queryTyped: true }), "closeList");
  });

  it("then clears a typed query", () => {
    assert.equal(escapeAction({ assetMenuOpen: true, fieldFocused: true, queryTyped: true }), "clearQuery");
  });

  it("then closes the menu", () => {
    assert.equal(escapeAction({ assetMenuOpen: true, fieldFocused: true }), "closeMenu");
  });
});

describe("Escape while Find It's panel is up", () => {
  it("leaves the toolbar selection alone, so Escape closes their panel and not our menu", () => {
    assert.equal(escapeAction({ assetMenuOpen: true, findItPanelShown: true }), "none");
    assert.equal(escapeAction({ assetMenuOpen: true, findItPanelShown: true, fieldFocused: true, queryTyped: true }), "none");
    assert.equal(escapeAction({ assetMenuOpen: true, findItPanelShown: false }), "closeMenu");
  });
});
