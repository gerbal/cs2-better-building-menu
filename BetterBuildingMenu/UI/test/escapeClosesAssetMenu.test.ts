import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * How Escape takes the asset menu down.
 *
 * Escape is the game's Back action, then its Pause Menu action if nothing claimed Back. Vanilla's
 * asset menu claims Back while it is open, so its first Escape closes it and the second pauses.
 * Ours replaces that menu, so it claims Back itself when the game would claim nothing: on the
 * default tool with no game panel and no selection. Measured in game (2026-10-21): without the
 * claim, one Escape closed the menu AND opened the pause menu.
 *
 * Otherwise the game claims Back (dropping the tool, closing the panel or the selection) and the
 * keydown listener closes the menu on the same press, so a cancelled tool takes the menu with it.
 */
const base = { assetMenuOpen: true, defaultTool: true, gamePanelOpen: false, hasSelection: false };

describe("closing the asset menu with Escape", () => {
  it("claims Back on the default tool, so the press closes the menu and not into the pause menu", async () => {
    const { escapeRoute } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(escapeRoute(base), "claim-back");
  });

  it("leaves Back to the game while a tool is armed, and closes on the keydown", async () => {
    // The game's Back drops the tool; the menu goes with it, by design.
    const { escapeRoute } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(escapeRoute({ ...base, defaultTool: false }), "clear-on-keydown");
  });

  it("leaves Back to the game while one of its panels or a selection is open", async () => {
    const { escapeRoute } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(escapeRoute({ ...base, gamePanelOpen: true }), "clear-on-keydown");
    assert.equal(escapeRoute({ ...base, hasSelection: true }), "clear-on-keydown");
  });

  it("does nothing when the asset menu is not open", async () => {
    // Escape belongs to the game then — that press is the player reaching for
    // the pause menu, and they should get it.
    const { escapeRoute } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(escapeRoute({ ...base, assetMenuOpen: false }), "none");
    assert.equal(escapeRoute({ ...base, assetMenuOpen: false, defaultTool: false }), "none");
  });
});

describe("Escape while Find It's panel is up", () => {
  it("leaves the press alone, so Escape closes their panel and not our menu", async () => {
    // Find It 2.0 claims Back itself while its panel would close on it.
    const { escapeRoute } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(escapeRoute({ ...base, findItPanelShown: true }), "none");
    assert.equal(escapeRoute({ ...base, findItPanelShown: true, defaultTool: false }), "none");
  });
});
