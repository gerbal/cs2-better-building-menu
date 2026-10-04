import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, rem, sides } from "./harness/compiledCss.ts";

const HEIGHT = "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
const WIDTH = "mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss";
const CATALOG = "mods/BuildingCatalog/buildingCatalog.module.scss";

// The game draws no grips. Its one panel resizer fills white under the mouse and
// while dragging, and its drag thumbs brighten in white, never in the accent.
describe("the grab strips", () => {
  const topGrip = declarationsOf(HEIGHT, ".resizeGrip");
  const band = declarationsOf(WIDTH, ".widthHandle");
  const grip = declarationsOf(WIDTH, ".widthGrip");
  const reach = declarationsOf(WIDTH, ".widthReach");
  const content = declarationsOf("mods/BuildingMenu/assetMenu.module.scss", ".content");
  const pane = declarationsOf("mods/ControlPane/controlPane.module.scss", ".pane");
  const rightPadding = (selector: string) => {
    const rule = declarationsOf(CATALOG, selector);
    return rem(rule["padding-right"] ?? sides(rule.padding)[1]);
  };

  it("paint no band down the catalog's side", () => {
    assert.equal(band["background-color"], undefined);
    assert.equal(band["backdrop-filter"], undefined);
  });

  it("fill white under the mouse and more while dragging, as the game's resizer does", () => {
    assert.equal(declarationsOf(WIDTH, ".widthHandle:hover")["background-color"], "rgba(255, 255, 255, 0.1)");
    assert.equal(declarationsOf(WIDTH, ".widthHandleActive")["background-color"], "rgba(255, 255, 255, 0.15)");
    assert.equal(declarationsOf(WIDTH, ".widthReach:hover")["background-color"], "rgba(255, 255, 255, 0.1)");
    assert.equal(declarationsOf(WIDTH, ".widthReachActive")["background-color"], "rgba(255, 255, 255, 0.15)");
    // The top strip keeps the header's dark paint and lays the same fill over it.
    assert.match(declarationsOf(HEIGHT, ".resizeHandle:hover")["background-image"] ?? "", /rgba\(255, 255, 255, 0\.1\)/);
    assert.match(declarationsOf(HEIGHT, ".resizeHandleActive")["background-image"] ?? "", /rgba\(255, 255, 255, 0\.15\)/);
  });

  it("brighten their pills in white as the game's scrollbar thumb does, at once", () => {
    const pills: Array<[string, string, string, string]> = [
      [HEIGHT, ".resizeGrip", ".resizeHandle:hover .resizeGrip", ".resizeGripActive"],
      [WIDTH, ".widthGrip", ".widthHandle:hover .widthGrip", ".widthGripActive"],
    ];
    for (const [sheet, rest, hover, held] of pills) {
      assert.equal(declarationsOf(sheet, rest)["background-color"], "rgba(var(--scrollbarColor), 0.6)", rest);
      assert.equal(declarationsOf(sheet, hover)["background-color"], "rgba(var(--scrollbarColor), 0.8)", hover);
      assert.equal(declarationsOf(sheet, held)["background-color"], "rgba(var(--scrollbarColor), 1)", held);
      assert.equal(declarationsOf(sheet, rest).transition, undefined, `${rest} eases`);
    }
  });

  it("fit the catalog's right margin in every density, so the catalog keeps its width", () => {
    for (const selector of [".catalog", ".densityDefault", ".densityCompact"]) {
      assert.ok(rem(band.width) <= rightPadding(selector), `${selector}: ${band.width} over ${rightPadding(selector)}rem`);
    }
    assert.equal(content["padding-right"], undefined, "the catalog is not pushed in");
  });

  it("carry a side pill as long as the top one, half as thick", () => {
    assert.equal(grip.height, topGrip.width);
    assert.equal(rem(grip.width), rem(topGrip.height) / 2);
    assert.equal(rem(grip["border-radius"]), rem(grip.width) / 2);
  });

  it("reach across the gap beside the pane, and no further", () => {
    assert.equal(reach.width, pane["margin-left"]);
    assert.equal(reach.right, `-${pane["margin-left"]}`);
    assert.equal(reach.cursor, "url(cursor://horizontal-can-resize)");
  });
});
