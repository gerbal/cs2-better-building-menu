import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectZoneCommand,
  sortZonesForDisplay,
  zoneAsCatalogEntry,
  type ZoneEntry,
} from "../src/domain/zoningHierarchy.ts";

const zone = (
  id: number,
  name: string,
  family: string,
  density: string
): ZoneEntry => ({ id, version: 1, prefabName: name, name, family, density, thumbnail: "" });


describe("Zones as catalog entries", () => {
  const zone = {
    id: 7,
    version: 2,
    prefabName: "ZoneEUResidentialLow",
    name: "EU Low Density Housing",
    family: "ZoneResidential",
    density: "Low",
    thumbnail: "thumb.png",
  };

  it("maps family to category and density to subcategory", () => {
    // So grouping by "category" reproduces the old two-level hierarchy
    // exactly, rather than the zoning view keeping its own renderer.
    const entry = zoneAsCatalogEntry(zone);

    assert.equal(entry.category, "ZoneResidential");
    assert.equal(entry.categoryLabel, "ZoneResidential");
    assert.equal(entry.subCategory, "Low");
    assert.equal(entry.subCategoryLabel, "Low");
  });

  it("carries the identity the renderer and the placement both need", () => {
    const entry = zoneAsCatalogEntry(zone);

    assert.equal(entry.id, 7);
    assert.equal(entry.version, 2);
    assert.equal(entry.name, "EU Low Density Housing");
    assert.equal(entry.thumbnail, "thumb.png");
  });

  it("leaves every metric null rather than inventing a zero", () => {
    // A zone is painted, not placed: it has no cost, capacity or lot, and "0"
    // would answer a question that does not apply.
    const entry = zoneAsCatalogEntry(zone);

    for (const field of ["constructionCost", "upkeep", "workers", "capacity", "lotWidth", "lotDepth"]) {
      assert.equal(entry[field], null, field);
    }
  });
});

describe("Display order", () => {
  const zone = (family: string, density: string, name: string): ZoneEntry => ({
    id: 1, version: 1, prefabName: name, name, family, density, thumbnail: "",
  });

  it("orders families as the vanilla Zones menu presents its tabs", () => {
    const sorted = sortZonesForDisplay([
      zone("ZoneOffice", "Low", "b"),
      zone("ZoneResidential", "Low", "a"),
      zone("ZoneCommercial", "Low", "c"),
    ]);

    assert.deepEqual(sorted.map((z) => z.family), ["ZoneResidential", "ZoneCommercial", "ZoneOffice"]);
  });

  it("orders density low to high, not alphabetically", () => {
    // Alphabetical reads High, Low, Medium, Row, which is meaningless for what
    // is a scale. Row sits between Low and Medium as it does in the game.
    const sorted = sortZonesForDisplay([
      zone("ZoneResidential", "High", "a"),
      zone("ZoneResidential", "Medium", "b"),
      zone("ZoneResidential", "Row", "c"),
      zone("ZoneResidential", "Low", "d"),
    ]);

    assert.deepEqual(sorted.map((z) => z.density), ["Low", "Row", "Medium", "High"]);
  });

  it("puts tierless zones after the real tiers", () => {
    const sorted = sortZonesForDisplay([
      zone("ZoneResidential", "Any", "a"),
      zone("ZoneResidential", "Low", "b"),
    ]);

    assert.deepEqual(sorted.map((z) => z.density), ["Low", "Any"]);
  });

  it("reads theme and pack variants of a tier together, by name", () => {
    const sorted = sortZonesForDisplay([
      zone("ZoneResidential", "Low", "NA Low Density"),
      zone("ZoneResidential", "Low", "EU Low Density"),
    ]);

    assert.deepEqual(sorted.map((z) => z.name), ["EU Low Density", "NA Low Density"]);
  });

  it("does not mutate what it was given", () => {
    const input = [zone("ZoneOffice", "Low", "b"), zone("ZoneResidential", "Low", "a")];
    sortZonesForDisplay(input);

    assert.equal(input[0].family, "ZoneOffice");
  });

  it("survives absent input", () => {
    assert.deepEqual(sortZonesForDisplay(null), []);
    assert.deepEqual(sortZonesForDisplay(undefined), []);
  });
});
