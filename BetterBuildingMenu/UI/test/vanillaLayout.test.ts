import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstClassToken, setInlineStyle } from "../src/mods/BuildingMenu/vanillaLayoutPure.ts";

const fake = (initial: Record<string, string> = {}) => {
  const removed: string[] = [];
  const style: Record<string, unknown> = {
    ...initial,
    removeProperty: (name: string) => {
      removed.push(name);
    },
  };

  return { el: { style } as never, style, removed };
};

describe("patching one of vanilla's inline styles", () => {
  it("assigns the value and hands back a restore", () => {
    const { el, style } = fake();
    const restore = setInlineStyle(el, "justifyContent", "flex-start");

    assert.equal(style.justifyContent, "flex-start");
    assert.equal(typeof restore, "function");
  });

  it("removes the property on restore when the game had set none inline", () => {
    // Cohtml rejects "" as a value and logs "Trying to set justifyContent
    // property to invalid value!" on every menu close; a browser reads "" as
    // unset. removeProperty is what both accept.
    const { el, style, removed } = fake();
    setInlineStyle(el, "zIndex", "-1")();

    assert.deepEqual(removed, ["z-index"]);
    assert.equal(style.zIndex, "-1", "the property is removed, never reassigned as an empty string");
  });

  it("puts a previous inline value back rather than removing it", () => {
    const { el, style, removed } = fake({ justifyContent: "center" });
    setInlineStyle(el, "justifyContent", "flex-start")();

    assert.equal(style.justifyContent, "center");
    assert.deepEqual(removed, []);
  });
});

describe("a class from the game's stylesheet module", () => {
  it("takes the first token, because gameMainScreen carries a transition class too", () => {
    assert.equal(firstClassToken("game-main-screen_TRK child-opacity-transition_nkS"), "game-main-screen_TRK");
    assert.equal(firstClassToken("toolbar_QYu"), "toolbar_QYu");
  });

  it("is null for anything but a non-empty string, so the patch becomes a no-op", () => {
    assert.equal(firstClassToken(undefined), null);
    assert.equal(firstClassToken(""), null);
    assert.equal(firstClassToken("   "), null);
    assert.equal(firstClassToken(42), null);
  });
});
