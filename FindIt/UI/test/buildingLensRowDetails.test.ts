import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBuildingDescriptionKeys,
  getBuildingExtensionLabels,
  getBuildingFlagGroups,
  getBuildingProvenanceChips,
} from "../src/domain/buildingLensRowDetails.ts";

describe("Building description lookup", () => {
  it("asks for the asset description the game itself uses", () => {
    // PrefabUISystem.GetTitleAndDescription keys ordinary assets as
    // Assets.DESCRIPTION[<prefab.name>] and service upgrades as
    // Assets.UPGRADE_DESCRIPTION[<prefab.name>]. The catalog entry already
    // carries prefabName, so no backend projection is needed.
    assert.deepEqual(getBuildingDescriptionKeys("ElementarySchool01"), [
      "Assets.DESCRIPTION[ElementarySchool01]",
      "Assets.UPGRADE_DESCRIPTION[ElementarySchool01]",
    ]);
  });

  it("returns no keys for a missing prefab name rather than a malformed one", () => {
    assert.deepEqual(getBuildingDescriptionKeys(""), []);
    assert.deepEqual(getBuildingDescriptionKeys(undefined), []);
  });
});

describe("Building flag groups", () => {
  it("ranks decision-relevant placement above lot and engine detail", () => {
    // All 19 BuildingFlags stay visible — a modder wants the engine detail —
    // but ordering them puts what constrains placement first and the lot
    // internals last, instead of one flat 19-chip wall.
    const groups = getBuildingFlagGroups([
      "ColorizeLot",
      "RequireRoad",
      "LeftAccess",
      "HasWaterNode",
      "RestrictedParking",
    ]);

    assert.deepEqual(groups.map((group) => group.id), ["placement", "access", "connections", "lot"]);
  });

  it("labels each flag in the game's own terms", () => {
    const groups = getBuildingFlagGroups(["RequireRoad", "NoRoadConnection", "CanBeOnRoad"]);

    assert.deepEqual(groups, [
      {
        id: "placement",
        label: "Placement",
        values: ["Requires a road connection", "No road connection", "Can be placed on a road"],
      },
    ]);
  });

  it("separates lot access and restrictions from the placement rule itself", () => {
    const groups = getBuildingFlagGroups(["LeftAccess", "BackAccess", "RestrictedCar"]);

    assert.deepEqual(groups, [
      { id: "access", label: "Access", values: ["Left", "Back", "No car access"] },
    ]);
  });

  it("reports which networks the building hooks into", () => {
    const groups = getBuildingFlagGroups([
      "HasWaterNode",
      "HasSewageNode",
      "HasLowVoltageNode",
      "HasResourceNode",
    ]);

    assert.deepEqual(groups, [
      { id: "connections", label: "Connections", values: ["Water", "Sewage", "Power", "Resources"] },
    ]);
  });

  it("humanizes a flag it has never seen instead of dropping it", () => {
    // The game adds flags between patches. An unknown flag landing in the lot
    // group readably beats it vanishing from the UI with no trace.
    const groups = getBuildingFlagGroups(["SomeFutureFlag"]);

    assert.deepEqual(groups, [{ id: "lot", label: "Lot", values: ["Some future flag"] }]);
  });

  it("emits nothing for a building with no flags", () => {
    assert.deepEqual(getBuildingFlagGroups(undefined), []);
    assert.deepEqual(getBuildingFlagGroups([]), []);
  });
});

describe("Extensions", () => {
  it("lists the upgrades a building supports", () => {
    assert.deepEqual(getBuildingExtensionLabels(["Bus Depot 01 Extra Garage", "Bus Station 02 Services"]), [
      "Bus Depot 01 Extra Garage",
      "Bus Station 02 Services",
    ]);
  });

  it("treats an empty extension list as nothing to show", () => {
    assert.deepEqual(getBuildingExtensionLabels([]), []);
    assert.deepEqual(getBuildingExtensionLabels(undefined), []);
  });
});

describe("Provenance", () => {
  it("names where the asset came from without repeating empties", () => {
    assert.deepEqual(
      getBuildingProvenanceChips({
        dlcId: "San Francisco",
        theme: "North American",
        assetPacks: ["Creator Pack: Modern Architecture"],
        provenance: "Base game",
      }),
      [
        { label: "DLC", value: "San Francisco" },
        { label: "Theme", value: "North American" },
        { label: "Pack", value: "Creator Pack: Modern Architecture" },
        { label: "Source", value: "Base game" },
      ]
    );
  });

  it("omits fields the adapter left blank", () => {
    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "", theme: "European", assetPacks: [] }), [
      { label: "Theme", value: "European" },
    ]);
    assert.deepEqual(getBuildingProvenanceChips({}), []);
  });

  it("shows the DLC's name rather than its raw numeric id", () => {
    // The adapter puts the raw DlcId on the entry ("-2009") while the facet
    // group carries the display name, so the row read "DLC -2009" until it
    // resolved through the same table the filter uses.
    const resolve = (groupId: string, value: string) =>
      groupId === "dlc" && value === "-2009" ? "Landmark Buildings" : null;

    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "-2009" }, resolve), [
      { label: "DLC", value: "Landmark Buildings" },
    ]);
  });

  it("falls back to the raw value when the facet has no matching option", () => {
    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "-9999" }, () => null), [
      { label: "DLC", value: "-9999" },
    ]);
  });

  it("joins multiple asset packs into one chip", () => {
    assert.deepEqual(getBuildingProvenanceChips({ assetPacks: ["Pack A", "Pack B"] }), [
      { label: "Pack", value: "Pack A, Pack B" },
    ]);
  });
});
