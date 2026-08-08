import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROVENANCE_AXIS_IDS,
  TAXONOMIC_AXIS_IDS,
  authoredAxisFor,
  isTaxonomicAxis,
  resolveAxis,
} from "../src/domain/menuAxisMap.ts";

describe("Menu axis map", () => {
  it("gives the service menus their sub-category", () => {
    assert.equal(authoredAxisFor("Healthcare"), "subCategory");
    assert.equal(authoredAxisFor("Education"), "subCategory");
    assert.equal(authoredAxisFor("Transportation"), "subCategory");
  });

  it("gives Zones its family rather than a sub-category", () => {
    assert.equal(authoredAxisFor("Zones"), "zoneFamily");
  });

  it("returns null for a menu nobody authored, so the fallback runs", () => {
    assert.equal(authoredAxisFor("SomeModdedMenu"), null);
  });

  it("is case- and spacing-insensitive, since tooltips vary", () => {
    assert.equal(authoredAxisFor("parks and recreation"), "subCategory");
  });

  it("classifies every taxonomic id as eligible", () => {
    for (const id of TAXONOMIC_AXIS_IDS) assert.equal(isTaxonomicAxis(id), true);
  });

  it("classifies every provenance id as ineligible", () => {
    for (const id of PROVENANCE_AXIS_IDS) assert.equal(isTaxonomicAxis(id), false);
  });

  it("classifies role as taxonomic — it names what a building is", () => {
    assert.equal(isTaxonomicAxis("role"), true);
  });

  it("picks role over a service menu's authored subCategory once the backend has found roles", () => {
    // Healthcare is authored to subCategory (the 13-service-menu strip this
    // task replaces), but once BuildingLensRoleList is non-empty, role is a
    // finer subdivision of the menu already open and outranks it.
    assert.equal(
      resolveAxis("Healthcare", [
        { id: "subCategory", optionCount: 13 },
        { id: "role", optionCount: 3 },
      ]),
      "role"
    );
  });

  it("shows no strip, rather than falling back to the sibling subCategory list, when role is empty", () => {
    // Transportation: 41 buildings, zero role groups (BuildingLensRoleScope's
    // two-role floor), so BuildingLensRoleList publishes empty. Authored
    // subCategory here is the 13-sibling list GetSubcategoryDescriptors
    // returns for the whole ServiceBuildings section — the very "redraws
    // the toolbar" bug role replaces — so it must not stand in for role.
    assert.equal(
      resolveAxis("Transportation", [
        { id: "subCategory", optionCount: 13 },
        { id: "role", optionCount: 0 },
      ]),
      null
    );
  });
});
