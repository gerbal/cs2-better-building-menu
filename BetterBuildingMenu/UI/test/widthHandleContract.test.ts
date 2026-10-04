import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, rem, sides } from "./harness/compiledCss.ts";

// The width grip lives in the catalog's own right margin, so the catalog keeps its
// width: a dark band like the top strip's, carrying a slimmer pill.
describe("the width strip in the catalog's margin", () => {
  const top = declarationsOf("mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss", ".resizeHandle");
  const topGrip = declarationsOf("mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss", ".resizeGrip");
  const band = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthHandle");
  const grip = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthGrip");
  const reach = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthReach");
  const content = declarationsOf("mods/BuildingMenu/assetMenu.module.scss", ".content");
  const pane = declarationsOf("mods/ControlPane/controlPane.module.scss", ".pane");
  const rightPadding = (selector: string) =>
    rem(declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", selector)["padding-right"] ?? sides(declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", selector).padding)[1]);

  it("is the top strip's dark bar", () => {
    assert.equal(band["background-color"], top["background-color"]);
    assert.equal(band["backdrop-filter"], top["backdrop-filter"]);
  });

  it("fits the catalog's right margin in every density, so the catalog keeps its width", () => {
    for (const selector of [".catalog", ".densityDefault", ".densityCompact"]) {
      assert.ok(rem(band.width) <= rightPadding(selector), `${selector}: ${band.width} over ${rightPadding(selector)}rem`);
    }
    assert.equal(content["padding-right"], undefined, "the catalog is not pushed in");
  });

  it("carries a pill as long as the top strip's, half as thick, rounded the same way", () => {
    assert.equal(grip.height, topGrip.width);
    assert.equal(rem(grip.width), rem(topGrip.height) / 2);
    assert.equal(rem(grip["border-radius"]), rem(grip.width) / 2);
    assert.equal(grip["background-color"], topGrip["background-color"]);
  });

  it("rounds the menu's bottom corner, as the top strip rounds the top ones", () => {
    assert.equal(band.right, "0");
    assert.equal(band["border-bottom-right-radius"], "var(--panelRadius)");
  });

  it("reaches across the gap beside the pane, and no further", () => {
    assert.equal(reach.width, pane["margin-left"]);
    assert.equal(reach.right, `-${pane["margin-left"]}`);
    assert.equal(reach.cursor, "url(cursor://horizontal-can-resize)");
  });
});
