import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GROUP_DIMENSIONS, groupDimensionLabel, groupDimensionsFor, isEducationMenu } from "../src/domain/buildingGroups.ts";

describe("Group dimensions", () => {

  it("puts None last, because it is how grouping is turned off", () => {
    assert.equal(GROUP_DIMENSIONS[GROUP_DIMENSIONS.length - 1].id, "none");
    assert.equal(groupDimensionLabel("none"), "No groups");
    assert.equal(groupDimensionLabel("menuCategory"), "By tab");
  });

  it("names the education menu loosely, like C#", () => {
    assert.equal(isEducationMenu("Education & Research"), true);
    assert.equal(isEducationMenu("education"), true);
    assert.equal(isEducationMenu("Roads"), false);
    assert.equal(isEducationMenu(null), false);
  });
});

describe("Which grouping choices a menu offers", () => {
  const ids = (offered: string[] | null) => groupDimensionsFor(offered).map((d) => d.id);

  it("shows the dimensions C# offered, in picker order", () => {
    // C# publishes the ids in its own order; the picker keeps its own.
    assert.deepEqual(ids(["none", "development", "menuCategory"]), ["menuCategory", "development", "none"]);
  });

  it("ignores an id it has no picker entry for", () => {
    assert.deepEqual(ids(["assetPack", "category"]), ["category"]);
  });

  it("offers everything before C# has said anything", () => {
    // Judging an empty list would shorten the picker and leave it short.
    assert.deepEqual(ids([]), GROUP_DIMENSIONS.map((d) => d.id));
    assert.deepEqual(ids(null), GROUP_DIMENSIONS.map((d) => d.id));
  });

  it("keeps the label the picker shows", () => {
    assert.deepEqual(
      groupDimensionsFor(["schoolTier"]).map((d) => [d.id, d.label, d.depth]),
      [["schoolTier", "School tier", 1]]
    );
  });
});
