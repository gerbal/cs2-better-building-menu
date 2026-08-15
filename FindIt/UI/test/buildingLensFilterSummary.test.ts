import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearBuildingLensFiltersCommand,
  getBuildingLensEmptyStateMessage,
  getBuildingLensFilterSummary,
  type BuildingLensMetricRangeState,
} from "../src/domain/buildingLensFilterSummary.ts";

const emptyRanges: BuildingLensMetricRangeState = {
  minCost: null,
  maxCost: null,
  minUpkeep: null,
  maxUpkeep: null,
  minWorkers: null,
  maxWorkers: null,
  minCapacity: null,
  maxCapacity: null,
  minLotWidth: null,
  maxLotWidth: null,
  minLotDepth: null,
  maxLotDepth: null,
  hasSelection: false,
};

describe("Building Lens active-filter summary", () => {
  it("counts selected facets and metric ranges as one summary", () => {
    const summary = getBuildingLensFilterSummary(
      {
        facets: {
          groups: [
            {
              id: "theme",
              label: "Theme",
              options: [
                { id: "European", label: "European", selected: true },
                { id: "Modern", label: "Modern", selected: true },
              ],
            },
          ],
          hasSelection: true,
        },
        metricRanges: {
          minCost: 100,
          maxCost: 500,
          minUpkeep: null,
          maxUpkeep: null,
          minWorkers: null,
          maxWorkers: null,
          minCapacity: null,
          maxCapacity: null,
          minLotWidth: null,
          maxLotWidth: null,
          minLotDepth: null,
          maxLotDepth: null,
          hasSelection: true,
        },
      },
    );

    assert.equal(summary.count, 3);
    assert.equal(summary.text, "3 active filters");
    // Named, not counted: "2 facets" left the player nothing to act on, and an
    // empty intersection is easy to reach now that filters compose.
    assert.deepEqual(summary.details, ["European", "Modern", "Cost 100–500"]);
    assert.equal(summary.hasSelection, true);
  });

  it("counts and names the legacy Find It filters that narrow the lens", () => {
    // The adapter pre-filters the lens index with the legacy filter list, so a
    // summary that ignored them told the player nothing was filtering while a
    // legacy toggle was hiding most of the catalog.
    const summary = getBuildingLensFilterSummary({ legacyFilters: ["Only placed", "Hide vanilla"] });

    assert.equal(summary.count, 2);
    assert.equal(summary.text, "2 active filters");
    assert.deepEqual(summary.details, ["Find It: Only placed", "Find It: Hide vanilla"]);
    assert.equal(summary.hasSelection, true);
    // Nothing here is clearable from the lens panel, so it must not offer to.
    assert.equal(summary.lensCount, 0);
  });

  it("reports nothing active only when no surface is filtering", () => {
    const summary = getBuildingLensFilterSummary({ legacyFilters: [] });

    assert.equal(summary.count, 0);
    assert.equal(summary.text, "No active filters");
    assert.equal(summary.hasSelection, false);
  });

  it("names every constraint in the empty state instead of blaming search and category", () => {
    const message = getBuildingLensEmptyStateMessage({
      searchText: "school",
      legacyFilters: ["Only placed"],
    });

    assert.match(message, /"school"/);
    assert.match(message, /Find It: Only placed/);
  });

  it("does not invent constraints when the category is simply empty", () => {
    assert.equal(
      getBuildingLensEmptyStateMessage({}),
      "No buildings in this category.",
    );
  });

  it("publishes one explicit clear-lens-filters trigger payload", () => {
    assert.deepEqual(clearBuildingLensFiltersCommand(), {
      method: "ClearBuildingLensFilters",
      args: [],
    });
  });
});

describe("Resting facets are not constraints", () => {
  const availability = (narrowing: boolean, unlockedSelected: boolean) => ({
    hasSelection: true,
    groups: [
      {
        id: "availability",
        label: "Availability",
        narrowing,
        options: [
          { id: "Locked", label: "Locked", selected: true },
          { id: "Unlocked", label: "Unlocked", selected: unlockedSelected },
        ],
      },
    ],
  });

  it("does not blame the resting Availability state for an empty menu", () => {
    // The reported symptom: "No buildings match Locked, Unlocked" over a menu
    // with nothing filtered. Together those two ARE every asset there is, so
    // naming them as the reason nothing matched told the player to drop a
    // constraint that was not applied.
    const message = getBuildingLensEmptyStateMessage({ facets: availability(false, true) });

    assert.equal(message, "No buildings in this category.");
  });

  it("still names a real availability narrowing", () => {
    const message = getBuildingLensEmptyStateMessage({ facets: availability(true, false) });

    assert.equal(message, "No buildings match Locked.");
  });

  it("does not count a resting group as an active filter", () => {
    assert.equal(getBuildingLensFilterSummary({ facets: availability(false, true) }).count, 0);
    assert.equal(getBuildingLensFilterSummary({ facets: availability(true, false) }).count, 1);
  });
});
