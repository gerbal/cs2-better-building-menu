import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, "..", "src", path), "utf8");

const base = read("base.scss");
const modules: Array<[string, string]> = [
  ["grid", "mods/BuildingGrid/buildingGrid.module.scss"],
  ["list and cards", "mods/BuildingList/buildingList.module.scss"],
  ["table", "mods/BuildingCatalog/buildingCatalog.module.scss"],
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

  it("derives the badge from the SAME picture the artwork box uses", () => {
    // The invariant, not the numbers. Sizes change — list went 20rem to 24rem
    // and cards 36rem to 40rem the moment the pictures were judged too small —
    // and a test that pins them just has to be edited alongside, which teaches
    // it nothing. What must hold is that the badge is measured against the
    // picture it sits on, in every mode.
    for (const [mode, path] of modules) {
      const source = read(path);
      const pictures = [...source.matchAll(/artwork-box\((\d+(?:\.\d+)?rem)\)/g)].map((m) => m[1]);
      const badges = [...source.matchAll(/unique-mark\((\d+(?:\.\d+)?rem)\)/g)].map((m) => m[1]);

      assert.ok(pictures.length > 0, `${mode} should declare an artwork box`);
      assert.deepEqual(
        badges,
        pictures,
        `${mode}: every unique-mark must use its artwork-box size, in the same order`
      );
    }
  });

  it("never hardcodes a badge size beside the mixin", () => {
    // The failure this catches: someone adds a fifth mode, copies the grid's
    // 16rem, and it is a blob or a speck depending on which picture they copied
    // it onto. The mixin owns width/height for this element; a literal one in a
    // .uniqueAsset rule means the ratio has been bypassed.
    for (const [mode, path] of modules) {
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
