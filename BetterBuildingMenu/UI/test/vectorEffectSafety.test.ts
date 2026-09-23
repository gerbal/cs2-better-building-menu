import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hasVectorThumbnail } from "../src/domain/buildingLockState.ts";
import { declarationsOf, everyDeclaration } from "./harness/compiledCss.ts";

/**
 * No compositing effect may be drawn over a vector.
 *
 * Cohtml rasterises an SVG at draw time, so an effect over one re-rasterises
 * it per composite and intermittently fails: filtered SVG thumbnails flicker
 * and some never draw, while `opacity` makes the same icons vanish outright.
 *
 * The failure is invisible in code review and to CDP — the DOM never changes
 * — so the rule is pinned here, against the compiled stylesheets: every
 * selector is written out in full there, however the source nests it.
 */
const SHEETS = [
  ["grid", "mods/BuildingGrid/buildingGrid.module.scss"],
  ["list", "mods/BuildingList/buildingList.module.scss"],
  ["table", "mods/BuildingCatalog/buildingCatalog.module.scss"],
] as const;

describe("no compositing effect over a vector", () => {
  for (const [name, sheet] of SHEETS) {
    it(`${name}: every compositing effect is gated to rasters`, () => {
      // Every compositing effect, not only the silhouette: a drop-shadow
      // over a vector corrupts it the same way. The rule is "no compositing
      // effect over a vector", not one named instance of it.
      const effects = everyDeclaration(sheet).filter(({ value }) => /brightness\(0%\)|drop-shadow\(/.test(value));
      assert.ok(effects.length > 0, `${name} draws its silhouette somewhere`);

      for (const { selectors, prop, value } of effects) {
        for (const selector of selectors) {
          assert.ok(
            selector.includes("[data-vector-thumb=false]"),
            `${name}: ${prop}: ${value} is not gated to rasters: ${selector}`
          );

          // The gate above is necessary and not sufficient: it asks whether the
          // ENTRY's thumbnail is a raster, not which elements the selector then
          // reaches. So every such selector must end in the picture's own class.
          const target = selector.split(/\s+/).pop() ?? "";
          assert.ok(
            target.startsWith("."),
            `${name}: a compositing effect targets elements rather than the picture's own class, `
              + `so it also silhouettes the badge over it: ${selector}`
          );
        }
      }
    });
  }

  it("the padlock is not a masked vector", () => {
    const masks = Object.keys(declarationsOf("mods/BuildingGrid/buildingGrid.module.scss", ".lockGlyph")).filter((property) => property.includes("mask"));
    assert.deepEqual(masks, [], "lockGlyph regained a mask");

    const tsx = readFileSync(new URL("../src/mods/BuildingGrid/BuildingGrid.tsx", import.meta.url), "utf8");
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
