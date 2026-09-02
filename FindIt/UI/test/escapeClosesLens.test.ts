import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * When Escape should take the lens down.
 *
 * cm-z9lm. The bead says "Escape is consumed by the game's native input layer
 * and never reaches the DOM" and builds its design on that. It is false: a
 * real Escape arrives as keydown with keyCode 27 (e.key is empty — the usual
 * Cohtml quirk, so match on the code).
 *
 * The rule is one condition, and what is NOT here matters more than what is.
 * Matching vanilla — menu survives a tool cancel — needs to tell the press
 * that disarms from the press after it, and a DOM listener cannot: both
 * signals depend on whether the game's disarm notification has landed, and it
 * races the keypress. Measured across two attempts: 6/6 wrong one way, then
 * 2 right / 3 wrong / 1 no-op the other. So the tool is not consulted at all.
 */
describe("closing the lens with Escape", () => {
  it("closes it whenever the lens is open", async () => {
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: true }), true);
  });

  it("does nothing when the lens is not open", async () => {
    // Escape belongs to the game then — that press is the player reaching for
    // the pause menu, and they should get it.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: false }), false);
  });

  it("asks nothing about the tool", async () => {
    // The guard against re-introducing the race. Any future signal added here
    // has to survive the game telling us about a disarm AFTER we were asked;
    // two attempts to use one produced non-deterministic behaviour in game.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape.length, 1, "takes one argument object");
    const source = shouldClearOnEscape.toString();
    assert.ok(!/tool/i.test(source), `the rule must not consult the tool: ${source}`);
  });
});

describe("Escape while Find It's panel is up", () => {
  it("leaves the toolbar selection alone, so Escape closes their panel and not our menu", async () => {
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: true, findItPanelShown: true }), false);
    assert.equal(shouldClearOnEscape({ lensOpen: true, findItPanelShown: false }), true);
  });
});

