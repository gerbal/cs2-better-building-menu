import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAxis, resolveAxis } from "../src/domain/menuAxisMap.ts";

describe("Adaptive axis", () => {
  it("picks the taxonomic dimension that partitions best", () => {
    assert.equal(
      computeAxis([{ id: "buildingType", optionCount: 6 }, { id: "zone", optionCount: 3 }]),
      "buildingType"
    );
  });

  it("never picks a provenance dimension, even when it scores highest", () => {
    assert.equal(
      computeAxis([{ id: "dlc", optionCount: 40 }, { id: "buildingType", optionCount: 3 }]),
      "buildingType"
    );
  });

  it("returns null rather than a well-scoring wrong label", () => {
    assert.equal(computeAxis([{ id: "dlc", optionCount: 40 }, { id: "assetPack", optionCount: 20 }]), null);
  });

  it("refuses a single-option axis, because one tab is not navigation", () => {
    assert.equal(computeAxis([{ id: "buildingType", optionCount: 1 }]), null);
  });

  it("returns null for no candidates at all", () => {
    assert.equal(computeAxis([]), null);
  });

  it("prefers the authored answer over the computed one", () => {
    assert.equal(resolveAxis("Zones", [{ id: "buildingType", optionCount: 9 }]), "zoneFamily");
  });

  it("falls back to computing for an unauthored menu", () => {
    assert.equal(resolveAxis("SomeModdedMenu", [{ id: "buildingType", optionCount: 4 }]), "buildingType");
  });
});
