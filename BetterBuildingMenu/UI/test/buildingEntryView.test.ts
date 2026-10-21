import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortedBadgeText } from "../src/domain/buildingEntryView.ts";
import { FALLBACK_SEPARATORS, formatBuildingMetric, formatLotDimensions } from "../src/domain/assetMenuMetricFormat.ts";
import { entry } from "./harness/entries.ts";

describe("the sorted figure's text", () => {
  it("is nothing when the sort shows no figure", () => {
    assert.equal(sortedBadgeText(entry(1), null, FALLBACK_SEPARATORS), null);
  });

  it("states a lot as the table and the hover card do", () => {
    assert.equal(sortedBadgeText(entry(1, { lotWidth: 6, lotDepth: 4 }), "lot", FALLBACK_SEPARATORS), formatLotDimensions(6, 4));
  });

  it("is nothing for a lot of 0 × 0, which measures nothing", () => {
    assert.equal(sortedBadgeText(entry(1, { lotWidth: 0, lotDepth: 0 }), "lot", FALLBACK_SEPARATORS), null);
  });

  it("formats a figure the entry carries, per distance where it is priced so", () => {
    const road = entry(1, { constructionCost: 1250, costIsPerDistance: true });

    assert.equal(sortedBadgeText(road, "cost", FALLBACK_SEPARATORS), formatBuildingMetric(1250, "cost", FALLBACK_SEPARATORS, true));
  });

  it("is nothing for a figure the entry never carried, not a dash", () => {
    assert.equal(sortedBadgeText(entry(1, { workers: null as unknown as number }), "workers", FALLBACK_SEPARATORS), null);
  });
});
