import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortedMetricFor, sortedMetricValue } from "../src/domain/sortedMetric.ts";
import { BUILDING_LENS_COLUMN_SORT } from "../src/domain/buildingLensSortPresentation.ts";
import type { BuildingLensMetric } from "../src/domain/buildingLensLayout.ts";

describe("the metric a sort is ordering by", () => {
  it("inverts the column-header map exactly", () => {
    // The table's headers and the tile badge must name the same metric for the
    // same sort, or clicking "Capacity" in the table and picking "Capacity"
    // from the sort list would label the figure two different ways.
    for (const [metric, column] of Object.entries(BUILDING_LENS_COLUMN_SORT)) {
      assert.equal(
        sortedMetricFor(column),
        metric as BuildingLensMetric,
        `${column} should resolve back to ${metric}`
      );
    }
  });

  it("shows nothing for the sorts the tile already displays", () => {
    // The name is on the tile; a badge repeating it fills no gap.
    assert.equal(sortedMetricFor("Name"), null);
    assert.equal(sortedMetricFor("Category"), null);
    assert.equal(sortedMetricFor(null), null);
    assert.equal(sortedMetricFor(undefined), null);
  });

  it("treats sorting by depth as the same combined lot cell as width", () => {
    assert.equal(sortedMetricFor("LotDepth"), "lot");
    assert.equal(sortedMetricFor("LotWidth"), "lot");
  });
});

describe("reading the sorted value off an entry", () => {
  const entry = {
    constructionCost: 12_500,
    upkeep: 300,
    workers: 45,
    capacity: 800,
    lotWidth: 6,
    lotDepth: 4,
    buildingLevel: 2,
    parkingSlots: 80,
  };

  it("reads each metric from its own field", () => {
    assert.equal(sortedMetricValue(entry, "cost"), 12_500);
    assert.equal(sortedMetricValue(entry, "upkeep"), 300);
    assert.equal(sortedMetricValue(entry, "workers"), 45);
    assert.equal(sortedMetricValue(entry, "capacity"), 800);
    assert.equal(sortedMetricValue(entry, "level"), 2);
  });

  it("reads parking as the bay count, which is what the sort orders on", () => {
    // Order() sorts HasParking by ParkingSlots: a boolean put every entry into
    // one of two buckets and left the order inside them untouched, so on any
    // set that agreed the sort visibly did nothing.
    assert.equal(sortedMetricValue(entry, "parking"), 80);
  });

  it("leaves the combined lot cell to its caller", () => {
    assert.equal(sortedMetricValue(entry, "lot"), null);
  });

  it("returns null rather than a zero for a metric that was never projected", () => {
    // Absent and zero are different answers, and the formatter renders them
    // differently on purpose.
    assert.equal(sortedMetricValue({ capacity: null }, "capacity"), null);
    assert.equal(sortedMetricValue({}, "workers"), null);
    assert.equal(sortedMetricValue(null, "cost"), null);
    assert.equal(sortedMetricValue(entry, null), null);
    assert.equal(sortedMetricValue({ capacity: 0 }, "capacity"), 0);
  });
});
