import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildZoningHierarchy,
  selectZoneCommand,
  ZONING_FAMILY_ORDER,
  type ZoneEntry,
} from "../src/domain/zoningHierarchy.ts";

const zone = (
  id: number,
  name: string,
  family: string,
  density: string
): ZoneEntry => ({ id, version: 1, prefabName: name, name, family, density, thumbnail: "" });

describe("Zoning hierarchy", () => {
  it("groups zones by family in the order the vanilla menu uses", () => {
    const hierarchy = buildZoningHierarchy([
      zone(1, "Office High", "ZoneOffice", "High"),
      zone(2, "Res Low", "ZoneResidential", "Low"),
      zone(3, "Com Low", "ZoneCommercial", "Low"),
    ]);

    assert.deepEqual(hierarchy.map((f) => f.id), ["ZoneResidential", "ZoneCommercial", "ZoneOffice"]);
  });

  it("orders density low to high rather than alphabetically", () => {
    // Alphabetical would read High, Low, Medium, Row — meaningless for a
    // scale. Row sits between Low and Medium, as it does in the game.
    const hierarchy = buildZoningHierarchy([
      zone(1, "d", "ZoneResidential", "High"),
      zone(2, "c", "ZoneResidential", "Medium"),
      zone(3, "b", "ZoneResidential", "Row"),
      zone(4, "a", "ZoneResidential", "Low"),
    ]);

    assert.deepEqual(hierarchy[0].densities.map((d) => d.density), ["Low", "Row", "Medium", "High"]);
  });

  it("keeps zones with no density tier in their own group", () => {
    // Industrial and extractor zones have no tier; they must still be
    // reachable rather than dropped for lacking one.
    const hierarchy = buildZoningHierarchy([
      zone(1, "Manufacturing", "ZoneIndustrial", "Any"),
    ]);

    assert.equal(hierarchy.length, 1);
    assert.equal(hierarchy[0].densities[0].density, "Any");
    assert.equal(hierarchy[0].densities[0].zones.length, 1);
  });

  it("puts the untiered group last so real tiers read as a scale", () => {
    const hierarchy = buildZoningHierarchy([
      zone(1, "special", "ZoneResidential", "Any"),
      zone(2, "low", "ZoneResidential", "Low"),
    ]);

    assert.deepEqual(hierarchy[0].densities.map((d) => d.density), ["Low", "Any"]);
  });

  it("sorts zones within a tier by name so theme variants sit together", () => {
    const hierarchy = buildZoningHierarchy([
      zone(1, "Waterfront Housing", "ZoneResidential", "Low"),
      zone(2, "Detached Housing", "ZoneResidential", "Low"),
    ]);

    assert.deepEqual(hierarchy[0].densities[0].zones.map((z) => z.name), [
      "Detached Housing",
      "Waterfront Housing",
    ]);
  });

  it("omits a family with no zones rather than showing an empty tab", () => {
    const hierarchy = buildZoningHierarchy([zone(1, "a", "ZoneResidential", "Low")]);

    assert.equal(hierarchy.length, 1);
    assert.deepEqual(ZONING_FAMILY_ORDER.length, 5);
  });

  it("handles an empty catalog without inventing families", () => {
    assert.deepEqual(buildZoningHierarchy([]), []);
    assert.deepEqual(buildZoningHierarchy(undefined), []);
  });

  it("delegates assignment to the game's own toolbar trigger", () => {
    // The lens owns the browsing hierarchy; the native Zone tool remains the
    // placement authority, so selecting a zone calls toolbar.selectAsset with
    // the entity rather than placing anything itself.
    assert.deepEqual(selectZoneCommand({ id: 17102, version: 3 }), {
      group: "toolbar",
      method: "selectAsset",
      args: [{ index: 17102, version: 3 }, true],
    });
  });
});
