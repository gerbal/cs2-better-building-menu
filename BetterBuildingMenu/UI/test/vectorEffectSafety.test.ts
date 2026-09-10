import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hasVectorThumbnail } from "../src/domain/buildingLockState.ts";

/**
 * No compositing effect may be drawn over a vector.
 *
 * Cohtml rasterises an SVG at draw time, so an effect over one re-rasterises
 * it per composite and intermittently fails: filtered SVG thumbnails flicker
 * and some never draw, while `opacity` makes the same icons vanish outright.
 *
 * The failure is invisible in code review and to CDP — the DOM never changes
 * — so the rule is pinned here as text, against the stylesheets themselves.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const SHEETS = [
  ["grid", "../src/mods/BuildingGrid/buildingGrid.module.scss"],
  ["list", "../src/mods/BuildingList/buildingList.module.scss"],
  ["table", "../src/mods/BuildingCatalog/buildingCatalog.module.scss"],
] as const;

/** Declarations with the file's comments stripped, so prose cannot pass or fail a check. */
const rules = (src: string) =>
  src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("no compositing effect over a vector", () => {
  for (const [name, path] of SHEETS) {
    it(`${name}: every compositing effect is gated to rasters`, () => {
      const src = rules(read(path));
      // Each selector block that applies the silhouette must also require
      // data-vector-thumb="false" somewhere in its selector list.
      const blocks = src.split("}");

      for (const block of blocks) {
        // Every compositing effect, not only the silhouette: a drop-shadow
        // over a vector corrupts it the same way. The rule is "no compositing
        // effect over a vector", not one named instance of it.
        if (!/brightness\(0%\)|drop-shadow\(/.test(block)) continue;

        assert.ok(
          block.includes('data-vector-thumb="false"'),
          `${name}: a compositing effect is not gated to rasters:\n${block.trim().slice(0, 240)}`
        );

        // The gate above is necessary and not sufficient: it asks whether the
        // ENTRY's thumbnail is a raster, not which elements the selector then
        // reaches. So every such selector must end in the picture's own class.
        for (const selector of block.split("{")[0].split(",")) {
          const target = selector.trim().split(/\s+/).pop() ?? "";
          if (target === "") continue;

          assert.ok(
            target.startsWith("."),
            `${name}: a compositing effect targets elements rather than the picture's own class, `
              + `so it also silhouettes the badge over it: ${selector.trim()}`
          );
        }
      }
    });
  }

  it("the padlock is not a masked vector", () => {
    const scss = rules(read("../src/mods/BuildingGrid/buildingGrid.module.scss"));
    const lockGlyph = scss.slice(scss.indexOf(".lockGlyph"));
    const rule = lockGlyph.slice(0, lockGlyph.indexOf("}"));

    assert.ok(!/mask/.test(rule), `lockGlyph regained a mask:\n${rule}`);

    const tsx = read("../src/mods/BuildingGrid/BuildingGrid.tsx");
    assert.ok(
      !/maskImage:\s*"url\(assetdb:\/\/gameui\/Media\/Glyphs\/Lock\.svg\)"/.test(tsx),
      "the padlock is masking Lock.svg again"
    );
    assert.ok(tsx.includes("LockRaster.png"), "the padlock should draw a raster");
  });
});

describe("hasVectorThumbnail", () => {
  it("recognises the sources that actually appear", () => {
    // Real srcs read off the live grid, both kinds.
    assert.equal(hasVectorThumbnail("Media/Game/Icons/DoubleTrainTrack.svg"), true);
    assert.equal(hasVectorThumbnail("Media/Game/Icons/TrussArchBridge01.svg"), true);
    assert.equal(hasVectorThumbnail("8ef69617cc5d8c286aa1500971601d.png"), false);
    assert.equal(hasVectorThumbnail("Subway/TrussViaductRail.png"), false);
    assert.equal(hasVectorThumbnail("Filter.cok@MediumSubwayYard02.png"), false);
  });

  it("is not fooled by a query string or a fragment", () => {
    // The generated thumbnails carry sizing params; one of them is a PNG route
    // with no extension at all, which must not be read as a vector.
    assert.equal(hasVectorThumbnail("Glyphs/Lock.svg?width=128"), true);
    assert.equal(hasVectorThumbnail("Glyphs/Lock.svg#icon"), true);
    assert.equal(hasVectorThumbnail("StationElevated02?width=128&height=128"), false);
  });

  it("treats a missing thumbnail as raster, so the silhouette still applies", () => {
    assert.equal(hasVectorThumbnail(undefined), false);
    assert.equal(hasVectorThumbnail(null), false);
    assert.equal(hasVectorThumbnail(""), false);
  });
});
