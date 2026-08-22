import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, "..", "src", path), "utf8");

const base = read("base.scss");
const modes: Array<[string, string, string]> = [
  ["grid", "mods/BuildingGrid/buildingGrid.module.scss", "45rem"],
  ["list", "mods/BuildingList/buildingList.module.scss", "20rem"],
  ["cards", "mods/BuildingList/buildingList.module.scss", "36rem"],
  ["table", "mods/BuildingCatalog/buildingCatalog.module.scss", "68rem"],
];

/**
 * The badge has to read the same size against the building in every mode.
 *
 * Four modes draw one catalogue at four picture sizes — 45rem, 20rem, 36rem and
 * 68rem — so "the same size" can only mean the same RATIO. A fixed number would
 * be a blob on a row icon and a speck on a table thumbnail, and four numbers
 * that agree today are four numbers that stop agreeing later. This pins the
 * single definition and that every mode derives from it.
 */
describe("unique mark scale", () => {
  it("is defined once, as a ratio of the picture", () => {
    assert.match(base, /\$mark-scale:\s*0?\.\d+;/);
    assert.match(base, /@mixin unique-mark\(\$picture\)/);
    // Derived, not restated: the mixin must multiply the picture it is given.
    assert.match(base, /@function mark-size\(\$picture\)[\s\S]*?\$picture \* \$mark-scale/);
  });

  it("is derived from the picture in every view mode", () => {
    for (const [mode, path, picture] of modes) {
      const source = read(path);
      assert.match(
        source,
        new RegExp(`unique-mark\\(${picture.replace(".", "\\.")}\\)`),
        `${mode} should call unique-mark(${picture}) rather than sizing the badge itself`
      );
    }
  });

  it("never hardcodes a badge size beside the mixin", () => {
    // The failure this catches: someone adds a fifth mode, copies the grid's
    // 16rem, and it is a blob or a speck depending on which picture they copied
    // it onto. The mixin owns width/height for this element; a literal one in a
    // .uniqueAsset rule means the ratio has been bypassed.
    for (const [mode, path] of modes) {
      const source = read(path);
      const rules = source.match(/\.uniqueAsset[A-Za-z]*\s*\{[^}]*\}/g) ?? [];
      assert.ok(rules.length > 0, `${mode} should style a unique mark`);
      for (const rule of rules) {
        assert.doesNotMatch(
          rule,
          /(width|height):\s*\d/,
          `${mode} sizes its badge directly: ${rule.trim()}`
        );
      }
    }
  });
});
