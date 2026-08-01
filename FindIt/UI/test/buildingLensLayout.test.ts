import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDING_LENS_MAX_WIDTH,
  BUILDING_LENS_MIN_WIDTH,
  clampBuildingLensWidth,
  getBuildingLensDensity,
  getBuildingLensMetricLabel,
  resizedBuildingLensWidth,
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
});
