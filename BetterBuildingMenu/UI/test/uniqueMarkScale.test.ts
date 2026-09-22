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
 * Four modes draw one catalogue at four picture sizes, so "the same size" can
 * only mean the same RATIO. This pins the single definition, and that every
 * mode derives from it.
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

  it("states the badge's size from the picture and anchors it by inset", () => {
    // Cohtml 2.2 resolves an auto-sized absolute <img> to the picture's
    // INTRINSIC size (64px for AlreadyBuilt.svg) whatever its offsets pin, so
    // pinned-and-auto no longer stretches to the box: the badge must carry its
    // own width and height, derived from the same ratio the inset is.
    const mixin = base.slice(base.indexOf("@mixin unique-mark"));
    const body = mixin.slice(0, mixin.indexOf("\n}"));

    for (const side of ["top", "left"]) {
      assert.match(
        body,
        new RegExp(`${side}: mark-frame-inset\\(\\$picture, \\$frame\\)`),
        `missing ${side}`
      );
    }

    assert.match(body, /width: mark-size\(\$picture\)/);
    assert.match(body, /height: mark-size\(\$picture\)/);
    assert.doesNotMatch(body, /(width|height): auto/);
    // The size is the picture less the inset on both sides: what the old
    // stretch produced, now stated.
    assert.match(base, /@function mark-size\(\$picture\)[\s\S]*?\$picture - 2 \* mark-inset\(\$picture\)/);
  });

  it("derives the badge from the SAME picture the artwork box uses", () => {
    // The invariant, not the numbers. Picture sizes change, and a test that
    // pins them just has to be edited alongside. What must hold is that the
    // badge is measured against the picture it sits on, in every mode.
    for (const [mode, path] of modules) {
      const source = read(path);
      // The PICTURE, which is not always the box: table frames its 60rem
      // picture in a 68rem tile, and reading the box there sizes the badge to
      // the frame, so it overhangs the artwork.
      const pictures = [...source.matchAll(/artwork-picture\((\d+(?:\.\d+)?rem)\)/g)].map((m) => m[1]);
      // The FIRST argument, which is the picture. A second argument is the
      // frame it is inset from — table's tinted tile — and must not be read
      // as the thing the badge is measured against.
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
    // The failure this catches: a fifth mode copies another mode's literal
    // badge size and it is a blob or a speck. The mixin owns width/height
    // here; a literal in a .uniqueAsset rule means the ratio is bypassed.
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
