import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * When Escape should take the lens down.
 *
 * cm-z9lm. The bead this comes from says "Escape is consumed by the game's
 * native input layer and never reaches the DOM", and builds its whole design
 * on that. It is false: a real Escape arrives as keydown with keyCode 27
 * (e.key is empty — the usual Cohtml quirk, so match on the code).
 *
 * The rule below is not a tool-state check, and that is the whole subtlety.
 * The GAME processes Escape before this listener runs, so by the time we are
 * asked, a tool that was armed a moment ago has ALREADY fallen back to
 * default. Asking "is a tool armed" therefore answers "no" on the very press
 * that cancelled one, and the lens closes a press too early. What separates
 * the two presses is how RECENTLY the tool changed.
 *
 * Measured shipped behaviour, Roads menu, before any of this:
 *
 *                 Esc #1                         Esc #2
 *   never armed   nothing at all                 pause menu, lens stays
 *   tool armed    disarms, lens stays            pause menu, lens stays
 *
 * So Escape could never close the lens at all.
 */
describe("closing the lens with Escape", () => {
  it("closes it when nothing was just cancelled", async () => {
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: true, msSinceToolDisarmed: 5_000 }), true);
  });

  it("holds when this very press cancelled a tool", async () => {
    // Vanilla's own behaviour: cancelling a tool leaves the menu open, ready
    // for the next pick. Closing here would be one press too eager.
    const { shouldClearOnEscape, TOOL_CANCEL_WINDOW_MS } = await import(
      "../src/domain/vanillaMenuWatch.ts"
    );

    assert.equal(shouldClearOnEscape({ lensOpen: true, msSinceToolDisarmed: 0 }), false);
    assert.equal(
      shouldClearOnEscape({ lensOpen: true, msSinceToolDisarmed: TOOL_CANCEL_WINDOW_MS - 1 }),
      false,
    );
    assert.equal(
      shouldClearOnEscape({ lensOpen: true, msSinceToolDisarmed: TOOL_CANCEL_WINDOW_MS }),
      true,
    );
  });

  it("does nothing when the lens is not open", async () => {
    // Escape belongs to the game when the lens is not on screen — that press
    // is the player reaching for the pause menu.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: false, msSinceToolDisarmed: 5_000 }), false);
    assert.equal(shouldClearOnEscape({ lensOpen: false, msSinceToolDisarmed: 0 }), false);
  });

  it("treats a tool that has never been armed as long ago", async () => {
    // No disarm has happened, so the first Escape over an open lens closes it.
    // Infinity rather than a sentinel the caller has to remember to check.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: true, msSinceToolDisarmed: Infinity }), true);
  });

  it("holds rather than guesses when the elapsed time is not a number", async () => {
    // A NaN would sail past a `>=` comparison written the other way round and
    // close the lens on a cancel.
    const { shouldClearOnEscape } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldClearOnEscape({ lensOpen: true, msSinceToolDisarmed: Number.NaN }), false);
  });

  it("keeps the window long enough to cover a frame or two, and short enough to feel instant", async () => {
    const { TOOL_CANCEL_WINDOW_MS } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.ok(TOOL_CANCEL_WINDOW_MS >= 100, "shorter than this races the binding update");
    assert.ok(TOOL_CANCEL_WINDOW_MS <= 500, "longer than this swallows a deliberate second press");
  });
});
