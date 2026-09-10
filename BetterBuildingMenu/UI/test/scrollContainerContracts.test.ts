import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Scroll containers in the lens sit inside .catalog, whose height is a cap
 * rather than a height. A zero flex-basis resolves against nothing there, so
 * the container contributes no height and its rows lay out below the viewport,
 * present in the DOM and invisible on screen.
 */
const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const SCROLL_CONTAINERS: { file: string; selector: string }[] = [
  { file: "../src/mods/BuildingCatalog/buildingCatalog.module.scss", selector: ".rows" },
  { file: "../src/mods/GroupedResults/groupedResults.module.scss", selector: ".groupScroll" },
];

/** The declarations of a top-level rule, without nested blocks or comments. */
const ruleBody = (source: string, selector: string): string => {
  const start = source.indexOf(`\n${selector} {`);
  assert.notEqual(start, -1, `expected a top-level "${selector}" rule`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  assert.notEqual(close, -1, `expected "${selector}" to be closed`);
  return source.slice(open + 1, close);
};

const declaration = (body: string, property: string): string | undefined => {
  const match = body.match(new RegExp(`(?:^|;|\\n)\\s*${property}\\s*:([^;\\n}]*)`));
  return match ? match[1].trim() : undefined;
};

describe("lens scroll containers", () => {
  for (const { file, selector } of SCROLL_CONTAINERS) {
    const body = ruleBody(read(file), selector);

    it(`${selector} does not use a zero flex-basis against an indefinite parent`, () => {
      const flex = declaration(body, "flex");
      assert.ok(flex, `${selector} should declare flex`);
      assert.equal(
        /(^|\s)0(px|rem)?\s*$/.test(flex),
        false,
        `${selector} has flex: ${flex} — a zero basis collapses it to no height`
      );
    });

    it(`${selector} caps its height so it cannot outgrow the panel`, () => {
      assert.equal(declaration(body, "max-height"), "100%", `${selector} should cap at the panel`);
    });

    it(`${selector} allows itself to shrink below its content`, () => {
      assert.equal(declaration(body, "min-height"), "0", `${selector} should set min-height: 0`);
    });
  }
});
