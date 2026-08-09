import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDING_LENS_TITLE_ICON,
  BUILDING_LENS_TITLE_GAP,
  getBuildingLensRowGeometry,
  BUILDING_LENS_MAX_WIDTH,
  BUILDING_LENS_MIN_WIDTH,
  clampBuildingLensWidth,
  getBuildingLensDensity,
  getBuildingLensMetricLabel,
  getBuildingLensMetricTextScale,
  getBuildingLensCatalogMaxHeight,
  resizedBuildingLensWidth,
  clampBuildingLensHeight,
  draggedBuildingLensHeight,
  BUILDING_LENS_MIN_HEIGHT,
  BUILDING_LENS_MAX_HEIGHT,
  BUILDING_LENS_DEFAULT_HEIGHT,
} from "../src/domain/buildingLensLayout.ts";

describe("Building Lens panel geometry", () => {
  it("clamps invalid and out-of-range widths to the supported bounds", () => {
    assert.equal(clampBuildingLensWidth(Number.NaN), BUILDING_LENS_MIN_WIDTH);
    assert.equal(clampBuildingLensWidth(-100), BUILDING_LENS_MIN_WIDTH);
    assert.equal(clampBuildingLensWidth(BUILDING_LENS_MAX_WIDTH + 100), BUILDING_LENS_MAX_WIDTH);
  });

  it("grows from a left-aligned handle as the pointer moves right", () => {
    assert.equal(resizedBuildingLensWidth(800, 100, 125, "Left"), 825);
  });

  it("grows a right-aligned panel when its handle moves left", () => {
    assert.equal(resizedBuildingLensWidth(800, 100, 75, "Right"), 825);
  });

  it("applies both edge deltas for a centered panel", () => {
    assert.equal(resizedBuildingLensWidth(800, 100, 125, "Center"), 850);
  });

  it("keeps unknown alignments predictable", () => {
    assert.equal(resizedBuildingLensWidth(800, 100, 125, "Legacy"), 825);
  });

  it("maps exact outer-width boundaries to density tiers", () => {
    assert.equal(getBuildingLensDensity(735), "compact");
    assert.equal(getBuildingLensDensity(799), "compact");
    assert.equal(getBuildingLensDensity(800), "default");
    assert.equal(getBuildingLensDensity(999), "default");
    assert.equal(getBuildingLensDensity(1000), "expanded");
    assert.equal(getBuildingLensDensity(1235), "expanded");
  });

  it("abbreviates metric headers only in compact density", () => {
    assert.equal(getBuildingLensMetricLabel("upkeep", "compact", "Upkeep"), "Upk");
    assert.equal(getBuildingLensMetricLabel("workers", "compact", "Workers"), "Wkr");
    assert.equal(getBuildingLensMetricLabel("upkeep", "default", "Unterhalt"), "Unterhalt");
    assert.equal(getBuildingLensMetricLabel("upkeep", "expanded", "Unterhalt"), "Unterhalt");
  });

  it("uses a readable metric text scale outside compact density", () => {
    assert.equal(getBuildingLensMetricTextScale("compact"), "compact");
    assert.equal(getBuildingLensMetricTextScale("default"), "readable");
    assert.equal(getBuildingLensMetricTextScale("expanded"), "readable");
  });

  it("keeps the default and compact row geometry dense but readable", () => {
    assert.deepEqual(getBuildingLensRowGeometry("default"), {
      rowHeight: 92,
      selectorHeight: 88,
      identityHeight: 72,
      selectorVerticalPadding: 2,
    });
    assert.deepEqual(getBuildingLensRowGeometry("compact"), {
      rowHeight: 84,
      selectorHeight: 80,
      identityHeight: 72,
      selectorVerticalPadding: 2,
    });
  });

  it("uses the FindIt building signature as the title icon", () => {
    assert.equal(BUILDING_LENS_TITLE_ICON, "coui://finditbuildingmenu/Icons/Colored/BuildingZoneSignature.svg");
    assert.equal(BUILDING_LENS_TITLE_GAP, 6);
  });

  it("budgets the catalog below the shell chrome at the 1280x720 render target", () => {
    assert.equal(getBuildingLensCatalogMaxHeight(720), 765);
    assert.equal(getBuildingLensCatalogMaxHeight(1080), 870);
    assert.equal(getBuildingLensCatalogMaxHeight(Number.NaN), 765);
  });
});

describe("Building Lens catalog height", () => {
  it("holds the drag inside the range", () => {
    assert.equal(clampBuildingLensHeight(BUILDING_LENS_MIN_HEIGHT - 50), BUILDING_LENS_MIN_HEIGHT);
    assert.equal(clampBuildingLensHeight(BUILDING_LENS_MAX_HEIGHT + 50), BUILDING_LENS_MAX_HEIGHT);
    assert.equal(clampBuildingLensHeight(500), 500);
  });

  it("falls back to the default rather than passing a non-finite height through", () => {
    // It goes straight into an inline style: height: NaNrem leaves the catalog
    // unsized rather than merely the wrong size.
    assert.equal(clampBuildingLensHeight(Number.NaN), BUILDING_LENS_DEFAULT_HEIGHT);
    assert.equal(clampBuildingLensHeight(Number.POSITIVE_INFINITY), BUILDING_LENS_DEFAULT_HEIGHT);
  });

  it("grows when the top edge is dragged upward", () => {
    // The panel is bottom-anchored and the handle is on its top edge, so a
    // smaller clientY means a taller panel. Getting this sign wrong gives a
    // handle that shrinks the panel when you pull it open.
    const taller = draggedBuildingLensHeight(400, 500, 400);
    const shorter = draggedBuildingLensHeight(400, 500, 600);

    assert.ok(taller > 400);
    assert.ok(shorter < 400);
  });

  it("treats a non-finite pointer as no movement", () => {
    assert.equal(draggedBuildingLensHeight(400, Number.NaN, 300), 400);
  });
});
