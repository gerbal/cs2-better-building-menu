import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, everyDeclaration } from "./harness/compiledCss.ts";

// The build menu's header buttons are drawn as the game draws its close buttons:
// 24rem, white, on the round highlight theme, which paints their hover and press.
describe("the header buttons", () => {
  const toggle = declarationsOf("mods/ControlPaneToggle/controlPaneToggle.module.scss", ".toggle");
  const glyph = declarationsOf("mods/ControlPaneToggle/controlPaneToggle.module.scss", ".glyph");
  const close = declarationsOf("mods/BuildingMenu/buildingMenuHeader.module.scss", ".menuClose");
  const closeGlyph = declarationsOf("mods/BuildingMenu/buildingMenuHeader.module.scss", ".menuCloseGlyph");

  it("are the same size as the game's close button", () => {
    for (const button of [toggle, close]) {
      assert.equal(button.width, "24rem");
      assert.equal(button.height, "24rem");
    }
  });

  it("leave their background to the round highlight theme, in every state", () => {
    const sheets: Array<[string, RegExp]> = [
      ["mods/ControlPaneToggle/controlPaneToggle.module.scss", /^\.toggle(\b|:)/],
      ["mods/BuildingMenu/buildingMenuHeader.module.scss", /^\.menuClose(\b|:)/],
    ];
    for (const [sheet, button] of sheets) {
      for (const { selectors, prop } of everyDeclaration(sheet)) {
        if (!selectors.some((selector) => button.test(selector))) continue;
        assert.ok(!/^background/.test(prop), `${selectors.join(", ")} { ${prop} }`);
      }
    }
  });

  it("draw white icons, the pane's as the close's", () => {
    assert.equal(glyph["background-color"], "rgb(255, 255, 255)");
    assert.equal(closeGlyph["background-color"], "rgb(255, 255, 255)");
    assert.equal(glyph.width, closeGlyph.width);
  });

  it("sit as far apart as the game spaces its close button", () => {
    assert.equal(toggle["margin-left"], "10rem");
    assert.equal(close["margin-left"], "10rem");
  });
});
