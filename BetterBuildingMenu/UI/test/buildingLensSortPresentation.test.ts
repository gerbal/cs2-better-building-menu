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

  it("exposes every sort choice, Default first, with the current choice selected", async () => {
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
        // Default leads: it is the game's own order and where the lens opens.
        ["Default", "Default"],
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

describe("dropping sorts that cannot reorder", () => {
  const load = async () => {
    const loaded = await loadSortPresentationModule();
    if (!("module" in loaded)) {
      assert.fail(`sort presentation helper is unavailable: ${String(loaded.error)}`);
    }
    return loaded.module;
  };

  it("offers only the fields that can move a row", async () => {
    // Signatures by Cost: every building is "Free", so the control responds
    // and the list does not. Reproduced live before this was written.
    const m = await load();

    assert.deepEqual(
      m.usableSortOptions(["Name", "Upkeep"], "Name").map((o: { key: string }) => o.key),
      ["Name", "Upkeep"]
    );
  });

  it("keeps the current selection even after it goes dead", async () => {
    // A picker whose summary shows a value its own list does not contain is a
    // worse bug than the one being fixed.
    const m = await load();

    assert.deepEqual(
      m.usableSortOptions(["Name"], "ConstructionCost").map((o: { key: string }) => o.key),
      ["Name", "ConstructionCost"]
    );
  });

  it("offers everything before the backend has answered", async () => {
    // Empty means "not said yet", not "nothing works" — hiding every option
    // would leave the control blank on open.
    const m = await load();
    const all = m.BUILDING_LENS_SORT_OPTIONS.length;

    assert.equal(m.usableSortOptions([], "Name").length, all);
    assert.equal(m.usableSortOptions(null, "Name").length, all);
    assert.equal(m.usableSortOptions(undefined, "Name").length, all);
  });

  it("filters the expanded list the picker renders", async () => {
    const m = await load();

    const presentation = m.getBuildingLensSortPresentation(
      { column: "Name", descending: false },
      ["Name", "Workers"]
    );

    assert.deepEqual(presentation.expanded.map((o: { key: string }) => o.key), ["Name", "Workers"]);
    assert.equal(presentation.compact.key, "Name");
  });
});
