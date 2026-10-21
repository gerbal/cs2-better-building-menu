import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAssetMenuEmptyStateMessage, getAssetMenuFilterSummary } from "../src/domain/assetMenuFilterSummary.ts";
import { clearAssetMenuFiltersCommand } from "../src/domain/commands.ts";
import { FALLBACK_SEPARATORS } from "../src/domain/assetMenuMetricFormat.ts";

describe("Asset menu active-filter summary", () => {
  it("counts selected facets and metric ranges as one summary", () => {
    const summary = getAssetMenuFilterSummary(
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
    // Named, not counted: "2 facets" leaves the player nothing to act on, and
    // an empty intersection is easy to reach once filters compose.
    assert.deepEqual(summary.details, ["European", "Modern", "Cost 100–500"]);
    assert.equal(summary.hasSelection, true);
  });

  it("names a bound in the player's own number marks", () => {
    const message = getAssetMenuEmptyStateMessage({
      metricRanges: {
        minCost: 1234.5, maxCost: 98765,
        minUpkeep: null, maxUpkeep: null,
        minWorkers: null, maxWorkers: null,
        minCapacity: null, maxCapacity: null,
        minLotWidth: null, maxLotWidth: null,
        minLotDepth: null, maxLotDepth: null,
        hasSelection: true,
      },
      separators: { ...FALLBACK_SEPARATORS, group: ".", decimal: "," },
    });

    assert.equal(message, "No buildings match Cost 1.234,5–98.765.");
  });

  it("does not invent constraints when the category is simply empty", () => {
    assert.equal(
      getAssetMenuEmptyStateMessage({}),
      "No buildings in this category.",
    );
  });

  it("publishes one explicit clear-asset-menu-filters trigger payload", () => {
    assert.deepEqual(clearAssetMenuFiltersCommand(), {
      method: "ClearAssetMenuFilters",
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
    // "No buildings match Locked, Unlocked" over a menu with nothing filtered:
    // together those two ARE every asset there is, so naming them as the
    // reason tells the player to drop a constraint that was not applied.
    const message = getAssetMenuEmptyStateMessage({ facets: availability(false, true) });

    assert.equal(message, "No buildings in this category.");
  });

  it("still names a real availability narrowing", () => {
    const message = getAssetMenuEmptyStateMessage({ facets: availability(true, false) });

    assert.equal(message, "No buildings match Locked.");
  });

  it("does not count a resting group as an active filter", () => {
    assert.equal(getAssetMenuFilterSummary({ facets: availability(false, true) }).count, 0);
    assert.equal(getAssetMenuFilterSummary({ facets: availability(true, false) }).count, 1);
  });
});
