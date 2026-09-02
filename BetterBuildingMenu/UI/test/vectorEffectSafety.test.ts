import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hasVectorThumbnail } from "../src/domain/buildingLockState.ts";

/**
 * cm-2xvs.24: no compositing effect may be drawn over a vector.
 *
 * Cohtml rasterises an SVG at draw time, so an effect over one re-rasterises it
 * per composite and intermittently fails. Measured live with 105 asset packs on
 * locked subway tiles: filtered SVG thumbnails flickered and some silhouettes
 * never drew at all, while filtered PNGs beside them were stable; `opacity` on
 * the same icons made them vanish outright.
 *
 * The failure is invisible in code review and invisible to CDP — a screenshot
 * of the UI layer looks perfectly clean, because the DOM never changes. So the
 * rule is pinned here as text, against the stylesheets themselves.
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
    it(`${name}: every silhouette filter is gated to rasters`, () => {
      const src = rules(read(path));
      // Each selector block that applies the silhouette must also require
      // data-vector-thumb="false" somewhere in its selector list.
      const blocks = src.split("}");

      for (const block of blocks) {
        if (!block.includes("brightness(0%)")) continue;

        assert.ok(
          block.includes('data-vector-thumb="false"'),
          `${name}: a brightness(0%) rule is not gated to rasters:\n${block.trim().slice(0, 240)}`
        );

        // The gate above is necessary and not sufficient, which is how the
        // table shipped a filter over a vector while passing this test. The
        // gate asks whether the ENTRY's thumbnail is a raster; it says nothing
        // about which elements the selector then reaches. `.thumbnail img`
        // passed the gate and still caught the already-built badge — an SVG,
        // always — painting it solid black on top of the artwork.
        //
        // So the target has to be named. Every selector applying the
        // silhouette must end in a class, which is the picture's own; an
        // element at the end of the chain reaches whatever else the box holds.
        for (const selector of block.split("{")[0].split(",")) {
          const target = selector.trim().split(/\s+/).pop() ?? "";
          if (target === "") continue;

          assert.ok(
            target.startsWith("."),
            `${name}: a brightness(0%) rule targets elements rather than the picture's own class, `
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
