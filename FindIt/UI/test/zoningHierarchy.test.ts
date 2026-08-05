import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getZoneFacts,
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

describe("Zone facts", () => {
  const zone = (over: Record<string, unknown> = {}): ZoneEntry => ({
    id: 1, version: 1, prefabName: "Z", name: "Z", family: "ZoneResidential",
    density: "Low", thumbnail: "", ...over,
  } as ZoneEntry);

  it("leads with height, which is the question a tier only gestures at", () => {
    const facts = getZoneFacts(zone({ maxHeight: 24, supportsNarrow: true }));

    assert.equal(facts[0].kind, "height");
    assert.equal(facts[0].value, 24);
  });

  it("omits a height the game never measured", () => {
    // ZoneSystem seeds MaxHeight to zero; it stays there for a zone with no
    // spawnable buildings, and "0m" would be a measurement rather than a gap.
    assert.deepEqual(getZoneFacts(zone({ maxHeight: 0 })), []);
    assert.deepEqual(getZoneFacts(zone({})), []);
  });

  it("states a support flag only when it is true", () => {
    // "Does not support corners" is noise on the majority that do not.
    assert.deepEqual(
      getZoneFacts(zone({ supportsNarrow: true, supportsCorners: false })).map((f) => f.kind),
      ["narrow"]
    );
    assert.deepEqual(getZoneFacts(zone({ supportsNarrow: false, supportsCorners: false })), []);
  });

  it("names the resources a commercial or industrial zone trades in", () => {
    const facts = getZoneFacts(zone({ allowedSold: "Food", allowedStored: "Grain" }));

    assert.deepEqual(facts, [
      { kind: "sold", value: "Food" },
      { kind: "stored", value: "Grain" },
    ]);
  });

  it("treats an empty resource as absent rather than as a resource", () => {
    // Resource is a flags enum whose zero value stringifies as "NoResource",
    // which a player would read as a kind of resource.
    assert.deepEqual(getZoneFacts(zone({ allowedSold: "", allowedManufactured: "   " })), []);
  });

  it("survives an absent zone", () => {
    assert.deepEqual(getZoneFacts(null), []);
    assert.deepEqual(getZoneFacts(undefined), []);
  });
});
