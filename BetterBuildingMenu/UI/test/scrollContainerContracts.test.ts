import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf } from "./harness/compiledCss.ts";

/**
 * Scroll containers in the lens sit inside .catalog, whose height is a cap
 * rather than a height. A zero flex-basis resolves against nothing there, so
 * the container contributes no height and its rows lay out below the viewport,
 * present in the DOM and invisible on screen.
 */
const SCROLL_CONTAINERS: { file: string; selector: string }[] = [
  { file: "mods/BuildingCatalog/buildingCatalog.module.scss", selector: ".rows" },
  { file: "mods/GroupedResults/groupedResults.module.scss", selector: ".groupScroll" },
];

describe("lens scroll containers", () => {
  for (const { file, selector } of SCROLL_CONTAINERS) {
    const declarations = declarationsOf(file, selector);

    it(`${selector} does not use a zero flex-basis against an indefinite parent`, () => {
      const flex = declarations.flex;
      assert.ok(flex, `${selector} should declare flex`);
      assert.equal(
        /(^|\s)0(px|rem)?\s*$/.test(flex),
        false,
        `${selector} has flex: ${flex} — a zero basis collapses it to no height`
      );
    });

    it(`${selector} caps its height so it cannot outgrow the panel`, () => {
      assert.equal(declarations["max-height"], "100%", `${selector} should cap at the panel`);
    });

    it(`${selector} allows itself to shrink below its content`, () => {
      assert.equal(declarations["min-height"], "0", `${selector} should set min-height: 0`);
    });
  }
});
