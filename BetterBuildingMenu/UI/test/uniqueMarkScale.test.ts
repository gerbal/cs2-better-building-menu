import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { declarationsOf, rem } from "./harness/compiledCss.ts";

const base = readFileSync(new URL("../src/base.scss", import.meta.url), "utf8");

const GRID = "mods/BuildingGrid/buildingGrid.module.scss";
const LIST = "mods/BuildingList/buildingList.module.scss";
const TABLE = "mods/BuildingCatalog/buildingCatalog.module.scss";

/**
 * Each mode's badge, the picture it is measured against and the box it sits
 * in. The table frames its 60rem picture in a 68rem tinted tile, the one mode
 * where picture and frame differ.
 */
const MODES = [
  { mode: "grid", sheet: GRID, badge: ".tile .artwork .uniqueAsset", picture: ".tile .artwork .thumb", frame: ".tile .artwork" },
  { mode: "list", sheet: LIST, badge: ".artwork .uniqueAsset", picture: ".artwork .icon", frame: ".artwork" },
  { mode: "cards", sheet: LIST, badge: ".artworkLarge .uniqueAssetLarge", picture: ".artworkLarge .iconLarge", frame: ".artworkLarge" },
  { mode: "table", sheet: TABLE, badge: ".thumbnail .uniqueAsset", picture: ".thumbnail .picture", frame: ".thumbnail" },
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

  it("is the same fraction of its picture in every mode, square, and centred in its frame", () => {
    // Read off the compiled sheets, so it is what each mode draws whatever
    // mixin or literal produced it. Cohtml 2.2 sizes an auto-sized absolute
    // <img> to its intrinsic size, so every badge must state its own.
    const ratios = MODES.map(({ mode, sheet, badge, picture, frame }) => {
      const mark = declarationsOf(sheet, badge);
      const size = rem(mark.width);
      const pictureSize = rem(declarationsOf(sheet, picture).width);
      const frameSize = rem(declarationsOf(sheet, frame).width);

      assert.ok(size > 0 && pictureSize > 0 && frameSize > 0, `${mode}: badge ${mark.width}, picture, frame all sized`);
      assert.equal(rem(mark.height), size, `${mode}: square`);
      assert.equal(mark.position, "absolute", mode);
      assert.equal(mark.top, mark.left, `${mode}: inset the same on both axes`);
      assert.ok(Math.abs(rem(mark.top) - (frameSize - size) / 2) < 1e-6, `${mode}: centred in its ${frameSize}rem frame`);

      return size / pictureSize;
    });

    for (const [i, ratio] of ratios.entries()) {
      assert.ok(Math.abs(ratio - ratios[0]) < 1e-6, `${MODES[i].mode} draws its badge at ${ratio} of the picture, not ${ratios[0]}`);
    }
  });
});
