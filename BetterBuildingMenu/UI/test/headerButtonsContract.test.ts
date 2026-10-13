import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, everyDeclaration } from "./harness/compiledCss.ts";

// The build menu's close is drawn as the game draws its close buttons: 24rem, white, on the round
// highlight theme, which paints its hover and press.
const HEADER = "mods/BuildingMenu/buildingMenuHeader.module.scss";

describe("the header's close", () => {
  const close = declarationsOf(HEADER, ".menuClose");
  const closeGlyph = declarationsOf(HEADER, ".menuCloseGlyph");

  it("is the same size as the game's close button", () => {
    assert.equal(close.width, "24rem");
    assert.equal(close.height, "24rem");
  });

  it("leaves its background to the round highlight theme, in every state", () => {
    for (const { selectors, prop } of everyDeclaration(HEADER)) {
      if (!selectors.some((selector) => /^\.menuClose(\b|:)/.test(selector))) continue;
      assert.ok(!/^background/.test(prop), `${selectors.join(", ")} { ${prop} }`);
    }
  });

  it("draws a white icon as wide as the button", () => {
    assert.equal(closeGlyph["background-color"], "rgb(255, 255, 255)");
    assert.equal(closeGlyph.width, close.width);
  });

  it("sits as far from the field as the game spaces its close button", () => {
    assert.equal(close["margin-left"], "10rem");
  });
});
