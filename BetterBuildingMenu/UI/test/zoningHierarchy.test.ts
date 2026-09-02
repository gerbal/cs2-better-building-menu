import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatZoneLots,
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

describe("Zone lot sizes", () => {
  const lots = (over: Record<string, unknown>) => ({
    id: 1, version: 1, prefabName: "Z", name: "Z", family: "ZoneResidential",
    density: "Low", thumbnail: "", ...over,
  } as ZoneEntry);

  it("states one footprint plainly when every building is the same size", () => {
    // The case worth knowing: this zone fills a two-cell strip and nothing
    // wider, which the density tier does not imply.
    assert.equal(
      formatZoneLots(lots({ minLotWidth: 2, maxLotWidth: 2, minLotDepth: 2, maxLotDepth: 2 })),
      "2 × 2"
    );
  });

  it("states a width range when the zone takes several", () => {
    assert.equal(
      formatZoneLots(lots({ minLotWidth: 1, maxLotWidth: 4, minLotDepth: 2, maxLotDepth: 6 })),
      "1–4 wide"
    );
  });

  it("states the depth whenever it is fixed, whatever the width does", () => {
    // A depth range is noise beside the width — block depth is usually the
    // real constraint — but a fixed depth is a fact worth having, and it reads
    // as a lot spec: widths 1 to 4, always 6 deep.
    assert.equal(
      formatZoneLots(lots({ minLotWidth: 1, maxLotWidth: 4, minLotDepth: 6, maxLotDepth: 6 })),
      // Non-breaking spaces, as the lot column uses: Cohtml takes each text
      // node boundary as a break opportunity and split "19 × 16" over three
      // lines in a narrow cell.
      "1\u20134\u00a0\u00d7\u00a06"
    );
    assert.equal(
      formatZoneLots(lots({ minLotWidth: 3, maxLotWidth: 3, minLotDepth: 2, maxLotDepth: 6 })),
      "3 wide"
    );
  });

  it("declines a zone with no spawnable buildings at all", () => {
    assert.equal(formatZoneLots(lots({ minLotWidth: 0, maxLotWidth: 0 })), null);
    assert.equal(formatZoneLots(lots({})), null);
    assert.equal(formatZoneLots(null), null);
  });

  it("leads the facts, since size rules a zone in or out before height does", () => {
    const facts = getZoneFacts(lots({ minLotWidth: 2, maxLotWidth: 2, minLotDepth: 2, maxLotDepth: 2, maxHeight: 12 }));

    assert.deepEqual(facts.map((fact) => fact.kind), ["lots", "height"]);
  });
});

describe("A locked zone", () => {
  const zone = (over: Record<string, unknown> = {}) => ({
    id: 1,
    version: 1,
    prefabName: "ZoneEUResidentialHigh",
    name: "High Density Residential",
    family: "ZoneResidential",
    density: "High",
    thumbnail: "",
    ...over,
  });

  it("carries its lock through to the shared catalog entry", async () => {
    const { zoneAsCatalogEntry } = await import("../src/domain/zoningHierarchy.ts");
    const { isEntryLocked, canPlace } = await import("../src/domain/buildingLockState.ts");

    // High density residential is locked at the start of a city. Before the
    // indexer read this, the surface drew it exactly like an unlocked zone and
    // the only way to find out was to try to paint with it.
    const entry = zoneAsCatalogEntry(zone({ isLocked: true, unlockMilestone: 4 }) as never);

    assert.equal(isEntryLocked(entry as never), true);
    assert.equal(canPlace(entry as never), false);
    assert.equal((entry as { unlockMilestone: number }).unlockMilestone, 4);
  });

  it("is placeable when the game says it is unlocked", async () => {
    const { zoneAsCatalogEntry } = await import("../src/domain/zoningHierarchy.ts");
    const { isEntryLocked, canPlace } = await import("../src/domain/buildingLockState.ts");

    const entry = zoneAsCatalogEntry(zone({ isLocked: false }) as never);

    assert.equal(isEntryLocked(entry as never), false);
    assert.equal(canPlace(entry as never), true);
  });

  it("stays placeable when the field is missing entirely", async () => {
    const { zoneAsCatalogEntry } = await import("../src/domain/zoningHierarchy.ts");
    const { canPlace } = await import("../src/domain/buildingLockState.ts");

    // Absent is not locked. A guard that defaulted to refusing would make every
    // zone unbuildable the moment the backend skipped a field.
    assert.equal(canPlace(zoneAsCatalogEntry(zone()) as never), true);
  });

  it("hands the hover card the conditions rather than a bare flag", async () => {
    const { zoneAsCatalogEntry } = await import("../src/domain/zoningHierarchy.ts");

    const entry = zoneAsCatalogEntry(
      zone({ isLocked: true, unlockRequirements: ["Milestone 4", "1 500 population"] }) as never
    ) as { unlockRequirements: string[] };

    assert.deepEqual(entry.unlockRequirements, ["Milestone 4", "1 500 population"]);
  });
});

describe("Extractor areas in the zoning surface", () => {
  const area = (over: Record<string, unknown> = {}) => ({
    id: 500,
    version: 1,
    prefabName: "Grain Farm",
    name: "Grain Farm",
    family: "ZoneExtractors",
    density: "Any",
    thumbnail: "",
    mapFeature: "FertileLand",
    ...over,
  });

  it("carries the natural resource through to the shared entry", async () => {
    const { zoneAsCatalogEntry } = await import("../src/domain/zoningHierarchy.ts");

    // The only thing separating grain from cotton in the game's data. Both are
    // LotPrefabs with ExtractorArea on FertileLand; neither is a zone, because
    // Game.Zones.AreaType has no specialised value for them to take.
    const entry = zoneAsCatalogEntry(area() as never) as { mapFeature: string };

    assert.equal(entry.mapFeature, "FertileLand");
  });

  it("leaves the field empty for a real zone", async () => {
    const { zoneAsCatalogEntry } = await import("../src/domain/zoningHierarchy.ts");

    const entry = zoneAsCatalogEntry(
      area({ mapFeature: undefined, family: "ZoneResidential", density: "Low" }) as never
    ) as { mapFeature: string };

    // Empty is what marks an entry as a zone rather than an area, so it has to
    // stay empty rather than becoming "undefined" or "None".
    assert.equal(entry.mapFeature, "");
  });
});
