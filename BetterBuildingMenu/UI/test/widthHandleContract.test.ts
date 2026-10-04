import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

// The two drag strips are one control on two edges: the same dark bar, as thick,
// carrying the same pill.
describe("the width strip beside the height strip", () => {
  const top = declarationsOf("mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss", ".resizeHandle");
  const topGrip = declarationsOf("mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss", ".resizeGrip");
  const side = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthHandle");
  const sideGrip = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthGrip");
  const content = declarationsOf("mods/BuildingMenu/assetMenu.module.scss", ".content");

  it("is the same dark bar", () => {
    assert.equal(side["background-color"], top["background-color"]);
    assert.equal(side["backdrop-filter"], top["backdrop-filter"]);
  });

  it("is as thick as the top strip", () => {
    assert.equal(side.width, top.height);
  });

  it("carries the same pill, turned on its side", () => {
    assert.equal(sideGrip.width, topGrip.height);
    assert.equal(sideGrip.height, topGrip.width);
    assert.equal(sideGrip["border-radius"], topGrip["border-radius"]);
    assert.equal(sideGrip["background-color"], topGrip["background-color"]);
  });

  it("rounds the menu's bottom corner, as the top strip rounds the top ones", () => {
    assert.equal(side["border-bottom-right-radius"], "var(--panelRadius)");
  });

  it("keeps the catalog out from under it", () => {
    assert.equal(content["padding-right"], side.width);
  });
});
