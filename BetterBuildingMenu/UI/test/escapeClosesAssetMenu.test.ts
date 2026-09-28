import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * When Escape should take the asset menu down.
 *
 * A real Escape arrives as keydown with keyCode 27 (e.key is empty — the usual
 * Cohtml quirk, so match on the code).
 *
 * The rule is one condition, and what is NOT here matters more. Telling the
 * press that disarms from the press after it needs the game's disarm
 * notification, which races the keypress — so the tool is not consulted.
 */
describe("closing the asset menu with Escape", () => {
  it("closes it whenever the asset menu is open", async () => {
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ assetMenuOpen: true }), true);
  });

  it("does nothing when the asset menu is not open", async () => {
    // Escape belongs to the game then — that press is the player reaching for
    // the pause menu, and they should get it.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ assetMenuOpen: false }), false);
  });

  it("asks nothing about the tool", async () => {
    // The guard against re-introducing the race. Any future signal added here
    // has to survive the game reporting a disarm AFTER we were asked.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape.length, 1, "takes one argument object");
    const source = shouldClearOnEscape.toString();
    assert.ok(!/tool/i.test(source), `the rule must not consult the tool: ${source}`);
  });
});

describe("Escape while Find It's panel is up", () => {
  it("leaves the toolbar selection alone, so Escape closes their panel and not our menu", async () => {
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ assetMenuOpen: true, findItPanelShown: true }), false);
    assert.equal(shouldClearOnEscape({ assetMenuOpen: true, findItPanelShown: false }), true);
  });
});

