import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  METRIC_NO_DATA,
  formatBuildingMetric,
  formatCapacity,
  getCapacityUnitLabel,
  groupDigits,
} from "../src/domain/buildingLensMetricFormat.ts";

describe("Building Lens metric formatting", () => {
  it("groups thousands without relying on Intl", () => {
    // Cohtml's toLocaleString did not group in the archived captures, so the
    // grouping is done explicitly rather than delegated to the runtime.
    assert.equal(groupDigits(80000), "80 000");
    assert.equal(groupDigits(1234567), "1 234 567");
    assert.equal(groupDigits(999), "999");
    assert.equal(groupDigits(-1500), "-1 500");
  });

  it("keeps one decimal for fractional metrics and none for whole ones", () => {
    assert.equal(groupDigits(12.34), "12.3");
    assert.equal(groupDigits(12), "12");
  });

  it("distinguishes an absent metric from a real zero", () => {
    assert.equal(formatBuildingMetric(null, "cost"), METRIC_NO_DATA);
    assert.equal(formatBuildingMetric(undefined, "cost"), METRIC_NO_DATA);
    assert.equal(formatBuildingMetric(Number.NaN, "cost"), METRIC_NO_DATA);
    assert.equal(formatBuildingMetric(0, "cost"), "0");
  });

  it("says what upkeep is per", () => {
    assert.equal(formatBuildingMetric(5000, "upkeep"), "5 000/mo");
    assert.equal(formatBuildingMetric(5000, "cost"), "5 000");
  });

  it("names what capacity counts so the column is comparable", () => {
    // One "Capacity" column carried students, beds and megawatts, which look
    // like one series but are not comparable at all.
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "Education"), "students");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "Healthcare"), "patients");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "Power"), "MW");
    assert.equal(getCapacityUnitLabel("Buildings", "Industrial"), "");
  });

  it("renders capacity with its unit and preserves the no-data marker", () => {
    assert.equal(formatCapacity(1200, "ServiceBuildings", "Education"), "1 200 students");
    assert.equal(formatCapacity(null, "ServiceBuildings", "Education"), METRIC_NO_DATA);
    assert.equal(formatCapacity(40, "Buildings", "Industrial"), "40");
  });
});

describe("Building Lens detail metrics", () => {
  it("surfaces the projected metrics the table never rendered", async () => {
    const { getBuildingDetailMetrics } = await import("../src/domain/buildingLensMetricFormat.ts");

    const details = getBuildingDetailMetrics({
      electricityConsumption: 1200,
      waterConsumption: 30,
      groundPollution: 15,
      airPollution: 0,
    });

    assert.deepEqual(details.map((detail) => detail.key), [
      "electricity",
      "water",
      "groundPollution",
      "airPollution",
    ]);
    assert.equal(details[0].value, "1 200 MW");
    // A real zero is a fact worth showing; only absent metrics are dropped.
    assert.equal(details[3].value, "0");
  });

  it("omits metrics that were never projected rather than showing empty rows", async () => {
    const { getBuildingDetailMetrics } = await import("../src/domain/buildingLensMetricFormat.ts");

    assert.deepEqual(getBuildingDetailMetrics({}), []);
    assert.deepEqual(
      getBuildingDetailMetrics({ electricityConsumption: null, noisePollution: 5 }).map((d) => d.key),
      ["noisePollution"],
    );
  });
});

describe("Building Lens lot dimensions", () => {
  it("emits one text node with non-breaking spaces", async () => {
    const { formatLotDimensions } = await import("../src/domain/buildingLensMetricFormat.ts");

    // JSX's `{w} × {d}` produced three text nodes, and Cohtml broke the cell
    // across three lines at those boundaries even under white-space: nowrap.
    // A single string joined by U+00A0 leaves no break opportunity at all.
    assert.equal(formatLotDimensions(19, 16), "19\u00a0\u00d7\u00a016");
    assert.ok(!formatLotDimensions(19, 16).includes("\u0020"));
  });

  it("still renders when a dimension is missing", async () => {
    const { formatLotDimensions } = await import("../src/domain/buildingLensMetricFormat.ts");

    assert.equal(formatLotDimensions(null, 16), METRIC_NO_DATA);
    assert.equal(formatLotDimensions(4, undefined), METRIC_NO_DATA);
  });
});
