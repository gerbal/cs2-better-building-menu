import assert from "node:assert/strict";
import { describe, it } from "node:test";

const sortPresentationModulePath = "../src/domain/buildingLensSortPresentation.ts";

async function loadSortPresentationModule(): Promise<{ module: any } | { error: unknown }> {
  try {
    return { module: await import(sortPresentationModulePath) };
  } catch (error) {
    return { error };
  }
}

describe("Building Lens sort presentation", () => {
  it("summarizes the selected sort column and direction compactly", async () => {
    const loaded = await loadSortPresentationModule();
    if (!("module" in loaded)) {
      assert.fail(`sort presentation helper is unavailable: ${String(loaded.error)}`);
    }

    const presentation = loaded.module.getBuildingLensSortPresentation({
      column: "Capacity",
      descending: true,
    });

    assert.deepEqual(presentation.compact, {
      key: "Capacity",
      label: "Capacity",
      direction: "descending",
      indicator: "▼",
    });
  });

  it("maps every metric column to the sort its header drives", async () => {
    const loaded = await loadSortPresentationModule();
    if ("error" in loaded) {
      assert.fail(`sort presentation helper is unavailable: ${String(loaded.error)}`);
    }

    assert.deepEqual(loaded.module.BUILDING_LENS_COLUMN_SORT, {
      cost: "ConstructionCost",
      upkeep: "Upkeep",
      workers: "Workers",
      capacity: "Capacity",
      lot: "LotWidth",
      level: "BuildingLevel",
      parking: "HasParking",
    });
  });

  it("marks only the sorted column, so the header row shows one ordering", async () => {
    const loaded = await loadSortPresentationModule();
    if ("error" in loaded) {
      assert.fail(`sort presentation helper is unavailable: ${String(loaded.error)}`);
    }

    const { getBuildingLensColumnSortIndicator } = loaded.module;
    const state = { column: "ConstructionCost", descending: false };

    assert.equal(getBuildingLensColumnSortIndicator("cost", state), "▲");
    assert.equal(getBuildingLensColumnSortIndicator("cost", { ...state, descending: true }), "▼");
    assert.equal(getBuildingLensColumnSortIndicator("upkeep", state), "");
    // Name/Category are not metric columns, so no header claims them.
    assert.equal(getBuildingLensColumnSortIndicator("capacity", { column: "Name", descending: false }), "");
  });

  it("exposes all ten existing sort choices with the current choice selected", async () => {
    const loaded = await loadSortPresentationModule();
    if (!("module" in loaded)) {
      assert.fail(`sort presentation helper is unavailable: ${String(loaded.error)}`);
    }

    const presentation = loaded.module.getBuildingLensSortPresentation({
      column: "LotDepth",
      descending: false,
    });

    assert.deepEqual(
      presentation.expanded,
      [
        ["Name", "Name"],
        ["Category", "Category"],
        ["ConstructionCost", "Cost"],
        ["Upkeep", "Upkeep"],
        ["Workers", "Workers"],
        ["Capacity", "Capacity"],
        ["LotWidth", "Lot width"],
        ["LotDepth", "Lot depth"],
        ["BuildingLevel", "Level"],
        ["HasParking", "Parking"],
      ].map(([key, label]) => ({
        key,
        label,
        selected: key === "LotDepth",
      }))
    );
  });
});
