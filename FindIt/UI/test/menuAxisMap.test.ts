import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROVENANCE_AXIS_IDS,
  TAXONOMIC_AXIS_IDS,
  authoredAxisFor,
  isTaxonomicAxis,
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
});
