import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

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

  it("leave their background to the round highlight theme", () => {
    for (const button of [toggle, close]) {
      assert.equal(button.background, undefined);
      assert.equal(button["background-color"], undefined);
    }
  });

  it("draw white icons, the pane's as the close's", () => {
    assert.equal(glyph["background-color"], closeGlyph["background-color"]);
    assert.equal(glyph.width, closeGlyph.width);
  });

  it("sit as far apart as the game spaces its close button", () => {
    assert.equal(toggle["margin-left"], "10rem");
    assert.equal(close["margin-left"], "10rem");
  });
});
