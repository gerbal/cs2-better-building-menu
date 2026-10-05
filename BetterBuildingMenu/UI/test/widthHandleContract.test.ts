import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, everyDeclaration, rem, sides } from "./harness/compiledCss.ts";

const HEIGHT = "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
const WIDTH = "mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss";
const CATALOG = "mods/BuildingCatalog/buildingCatalog.module.scss";
const fill = (sheet: string, selector: string) => declarationsOf(sheet, selector)["background-color"];
const topFill = (selector: string) => declarationsOf(HEIGHT, selector)["background-image"] ?? "";

// The game draws no grips. Its one panel resizer fills white under the mouse and
// while dragging, and its drag thumbs brighten in white, never in the accent.
describe("the grab strips", () => {
  const topStrip = declarationsOf(HEIGHT, ".resizeHandle");
  const topGrip = declarationsOf(HEIGHT, ".resizeGrip");
  const strip = declarationsOf(WIDTH, ".widthHandle");
  const grip = declarationsOf(WIDTH, ".widthGrip");
  const reach = declarationsOf(WIDTH, ".widthReach");
  const content = declarationsOf("mods/BuildingMenu/assetMenu.module.scss", ".content");
  const pane = declarationsOf("mods/ControlPane/controlPane.module.scss", ".pane");
  const rightPadding = (selector: string) => {
    const rule = declarationsOf(CATALOG, selector);
    return rem(rule["padding-right"] ?? sides(rule.padding)[1]);
  };

  it("paint nothing down the catalog's side until the mouse is on them", () => {
    for (const property of ["background", "background-color", "background-image", "backdrop-filter"]) {
      assert.equal(strip[property], undefined, property);
      assert.equal(reach[property], undefined, property);
    }
  });

  it("fill white under the mouse, and more while dragging whether the mouse is on them or not", () => {
    assert.equal(fill(WIDTH, ".widthHandleHovered"), "rgba(255, 255, 255, 0.1)");
    assert.equal(fill(WIDTH, ".widthReachHovered"), "rgba(255, 255, 255, 0.1)");
    for (const held of [".widthHandleActive", ".widthReachActive", ".widthHandleActive.widthHandleHovered", ".widthReachActive.widthReachHovered"]) {
      assert.equal(fill(WIDTH, held), "rgba(255, 255, 255, 0.15)", held);
    }
    // The top strip keeps the header's dark paint and lays the same fill over it.
    assert.match(topFill(".resizeHandle:hover"), /rgba\(255, 255, 255, 0\.1\)/);
    assert.match(topFill(".resizeHandleActive"), /rgba\(255, 255, 255, 0\.15\)/);
    assert.match(topFill(".resizeHandleActive:hover"), /rgba\(255, 255, 255, 0\.15\)/);
  });

  it("brighten their pills in white as the game's scrollbar thumb does", () => {
    const pills: Array<[string, string, string, string, string]> = [
      [HEIGHT, ".resizeGrip", ".resizeHandle:hover .resizeGrip", ".resizeGripActive", ".resizeHandle:hover .resizeGripActive"],
      [WIDTH, ".widthGrip", ".widthGripHovered", ".widthGripActive", ".widthGripActive.widthGripHovered"],
    ];
    for (const [sheet, rest, hover, held, heldHover] of pills) {
      assert.equal(fill(sheet, rest), "rgba(var(--scrollbarColor), 0.6)", rest);
      assert.equal(fill(sheet, hover), "rgba(var(--scrollbarColor), 0.8)", hover);
      assert.equal(fill(sheet, held), "rgba(var(--scrollbarColor), 1)", held);
      assert.equal(fill(sheet, heldHover), "rgba(var(--scrollbarColor), 1)", heldHover);
    }
  });

  it("never take the accent, and change at once", () => {
    for (const sheet of [HEIGHT, WIDTH]) {
      for (const { selectors, prop, value } of everyDeclaration(sheet)) {
        assert.doesNotMatch(value, /accent/i, `${selectors.join(", ")} { ${prop} }`);
        assert.notEqual(prop, "transition", selectors.join(", "));
      }
    }
  });

  it("fit the catalog's right margin in every density, so the catalog keeps its width", () => {
    for (const selector of [".catalog", ".densityDefault", ".densityExpanded", ".densityCompact"]) {
      assert.ok(rem(strip.width) <= rightPadding(selector), `${selector}: ${strip.width} over ${rightPadding(selector)}rem`);
    }
    assert.equal(content["padding-right"], undefined, "the catalog is not pushed in");
  });

  it("run the catalog's full height at its right edge, above it", () => {
    assert.equal(strip.top, "0");
    assert.equal(strip.bottom, "0");
    assert.equal(strip.right, "0");
    assert.equal(strip["z-index"], "1");
  });

  it("carry a side pill as long as the top one, half as thick", () => {
    assert.equal(grip.height, topGrip.width);
    assert.equal(rem(grip.width), rem(topGrip.height) / 2);
    assert.equal(rem(grip["border-radius"]), rem(grip.width) / 2);
  });

  it("reach across the gap beside the pane, below the top strip, taking presses", () => {
    assert.equal(reach.width, pane["margin-left"]);
    assert.equal(reach.right, `-${pane["margin-left"]}`);
    assert.equal(reach.top, topStrip.height);
    assert.equal(reach.bottom, "0");
    assert.equal(reach["pointer-events"], "auto");
    assert.equal(reach["z-index"], "30");
    assert.equal(reach.cursor, "url(cursor://horizontal-can-resize)");
  });
});
