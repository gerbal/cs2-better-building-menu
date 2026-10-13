import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, everyDeclaration } from "./harness/compiledCss.ts";

// The top row's close is the game's own: 24rem, on the round highlight theme, which paints its hover
// and press, its glyph in the look's light ink, 4 rem after what comes before it.
const TOP_ROW = "mods/TopRow/topRow.module.scss";
const LOOKS = "looks/looks.module.scss";
const STYLES = ["standard", "plates"].flatMap((look) => [
  `.${look}`,
  `:global(.style--bright-blue) .${look}.followStyle`,
  `:global(.style--dark-grey-orange) .${look}.followStyle`,
]);

describe("the top row's close", () => {
  const close = declarationsOf(TOP_ROW, ".menuClose");
  const closeGlyph = declarationsOf(TOP_ROW, ".menuCloseGlyph");

  it("is the same size as the game's close button", () => {
    assert.equal(close.width, "24rem");
    assert.equal(close.height, "24rem");
  });

  it("leaves its background to the round highlight theme, in every state", () => {
    for (const { selectors, prop } of everyDeclaration(TOP_ROW)) {
      if (!selectors.some((selector) => /^\.menuClose(\b|:)/.test(selector))) continue;
      assert.ok(!/^background/.test(prop), `${selectors.join(", ")} { ${prop} }`);
    }
  });

  it("draws its glyph in the look's light ink, which no interface style follows, as wide as the button", () => {
    // The head stays dark under every style, so its ink stays the look's: a followed ink turns dark
    // under Bright blue, and the X would vanish into the band.
    const token = /^var\((--bbm-\w+)\)$/.exec(closeGlyph["background-color"] ?? "")?.[1];
    assert.ok(token, `the glyph reads a look token: ${closeGlyph["background-color"]}`);

    const own = declarationsOf(LOOKS, ".standard")[token];
    assert.match(own, /^rgba\(240, 251, 255, 0\.9\d*\)$/, `${token} is the look's light ink`);
    for (const style of STYLES) assert.equal(declarationsOf(LOOKS, style)[token], own, `${token} under ${style}`);
    assert.equal(closeGlyph.width, close.width);
  });

  it("sits 4 rem after what comes before it", () => {
    assert.equal(close["margin-left"], "4rem");
  });
});
