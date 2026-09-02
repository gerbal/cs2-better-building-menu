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
    assert.match(base, /\$mark-inset:\s*0?\.\d+;/);
    assert.match(base, /@mixin unique-mark\(\$picture, \$frame: \$picture\)/);
    // Derived, not restated: the inset must be a fraction of the picture given.
    assert.match(base, /@function mark-inset\(\$picture\)[\s\S]*?\$picture \* \$mark-inset/);
    // ...and the frame-aware inset must reduce to that when the two agree,
    // which is what keeps every other mode on the same arithmetic.
    assert.match(base, /@function mark-frame-inset\(\$picture, \$frame\)[\s\S]*?mark-inset\(\$picture\)/);
  });

  it("pins all four sides and leaves the size auto", () => {
    // This is what makes the badge CENTRE on the building rather than corner
    // itself on it. Measured: pinned-and-auto stretches to the box in this
    // engine, 19px inside a 30px picture with 5px clear each side. Stating a
    // width instead resolves to a fixed size anchored top-left, which is the
    // bug this replaced.
    const mixin = base.slice(base.indexOf("@mixin unique-mark"));
    const body = mixin.slice(0, mixin.indexOf("\n}"));

    for (const side of ["top", "bottom", "left", "right"]) {
      assert.match(
        body,
        new RegExp(`${side}: mark-frame-inset\\(\\$picture, \\$frame\\)`),
        `missing ${side}`
      );
    }

    assert.match(body, /width: auto/);
    assert.match(body, /height: auto/);
    assert.doesNotMatch(body, /(width|height):\s*mark-size/);
  });

  it("derives the badge from the SAME picture the artwork box uses", () => {
    // The invariant, not the numbers. Sizes change — list went 20rem to 24rem
    // and cards 36rem to 40rem the moment the pictures were judged too small —
    // and a test that pins them just has to be edited alongside, which teaches
    // it nothing. What must hold is that the badge is measured against the
    // picture it sits on, in every mode.
    for (const [mode, path] of modules) {
      const source = read(path);
      // The PICTURE, which is not always the box. Table frames its 60rem
      // picture in a 68rem tile, and reading the box there sized the badge to
      // the frame — it overhung the artwork, and this guard passed anyway
      // because it was checking the wrong number against itself.
      const pictures = [...source.matchAll(/artwork-picture\((\d+(?:\.\d+)?rem)\)/g)].map((m) => m[1]);
      // The FIRST argument, which is the picture. A second argument is the
      // frame it is inset from — table's tinted tile — and must not be read as
      // the thing the badge is measured against, which was the original bug.
      const badges = [...source.matchAll(/unique-mark\((\d+(?:\.\d+)?rem)(?:,\s*\d+(?:\.\d+)?rem)?\)/g)]
        .map((m) => m[1]);

      assert.ok(pictures.length > 0, `${mode} should declare its picture size through artwork-picture`);
      assert.deepEqual(
        badges,
        pictures,
        `${mode}: every unique-mark must use its artwork-PICTURE size, in the same order`
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
