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
  it("counts selected facets, metric ranges, and education capacity as one summary", () => {
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
        capacityFloor: 500,
      },
    );

    assert.equal(summary.count, 4);
    assert.equal(summary.text, "4 active filters");
    assert.deepEqual(summary.details, ["2 facets", "Cost 100–500", "Education capacity 500+"]);
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
      capacityFloor: 500,
    });

    assert.match(message, /"school"/);
    assert.match(message, /Find It: Only placed/);
    assert.match(message, /Education capacity 500\+/);
  });

  it("does not invent constraints when the category is simply empty", () => {
    assert.equal(
      getBuildingLensEmptyStateMessage({}),
      "No buildings in this category.",
    );
  });

  it("calls out a capacity floor that cannot be satisfied", () => {
    // The Education preset composes as max(floor, metricMin), so a floor above
    // the metric maximum rejects every row while both controls look reasonable.
    const message = getBuildingLensEmptyStateMessage({
      capacityFloor: 900,
      metricRanges: { ...emptyRanges, maxCapacity: 400, hasSelection: true },
    });

    assert.match(message, /capacity floor .*above/i);
  });

  it("publishes one explicit clear-lens-filters trigger payload", () => {
    assert.deepEqual(clearBuildingLensFiltersCommand(), {
      method: "ClearBuildingLensFilters",
      args: [],
    });
  });
});
