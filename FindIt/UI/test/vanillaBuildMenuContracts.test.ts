import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lensRoleCommand,
  lensSectionCommand,
  lensSubCategoryCommand,
  selectedNavigationId,
} from "../src/domain/vanillaBuildMenuContracts.ts";

describe("vanilla build menu navigation contracts", () => {
  it("dispatches string section and subcategory IDs", () => {
    assert.deepEqual(lensSectionCommand("Zones"), {
      method: "SetBuildingLensSection",
      args: ["Zones"],
    });
    assert.deepEqual(lensSubCategoryCommand("Buildings_Residential"), {
      method: "SetBuildingLensSubCategory",
      args: ["Buildings_Residential"],
    });
  });

  it("dispatches string role IDs", () => {
    assert.deepEqual(lensRoleCommand("PoliceStation"), {
      method: "SetBuildingLensRole",
      args: ["PoliceStation"],
    });
  });

  it("uses lens selection only in lens mode and legacy selection otherwise", () => {
    assert.equal(selectedNavigationId(true, 100, "Zones"), "Zones");
    assert.equal(selectedNavigationId(false, 100, "Zones"), 100);
  });
});
