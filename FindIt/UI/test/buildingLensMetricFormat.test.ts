import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  METRIC_FREE,
  METRIC_NO_DATA,
  getNumberSeparators,
  formatBuildingMetric,
  formatCapacity,
  getCapacityUnitLabel,
  groupDigits,
  hasFootprint,
} from "../src/domain/buildingLensMetricFormat.ts";

describe("Building Lens metric formatting", () => {
  it("groups thousands without relying on Intl", () => {
    // Cohtml's toLocaleString did not group in the archived captures, so the
    // grouping is done explicitly rather than delegated to the runtime.
    // The separator defaults to a NO-BREAK space: Cohtml treats a plain U+0020
    // between digits as a line-break opportunity and will split a number in
    // half across two lines.
    assert.equal(groupDigits(80000), "80\u00a0000");
    assert.equal(groupDigits(1234567), "1\u00a0234\u00a0567");
    assert.equal(groupDigits(999), "999");
    assert.equal(groupDigits(-1500), "-1\u00a0500");
  });

  it("groups with whatever separator the game's dictionary gives", () => {
    // The defect this fixes: our column read "192 405/mo" beside the game's own
    // "1,416,788" on the same screen, because the separator was hardcoded here
    // while the game reads its own Common.THOUSANDS_SEPARATOR.
    assert.equal(groupDigits(1234567, { group: ",", decimal: "." }), "1,234,567");
    assert.equal(groupDigits(1234567, { group: ".", decimal: "," }), "1.234.567");
    assert.equal(groupDigits(12.34, { group: ".", decimal: "," }), "12,3");
  });

  it("reads the separators from the game rather than assuming them", () => {
    const separators = getNumberSeparators((id) =>
      id === "Common.THOUSANDS_SEPARATOR" ? "," : id === "Common.DECIMAL_SEPARATOR" ? "." : null
    );
    assert.deepEqual(separators, { group: ",", decimal: "." });
  });

  it("falls back rather than printing a locale id when the key is missing", () => {
    // translate() echoes the id back for an unknown key, and an id is not a
    // separator: unguarded, a missing key renders 1Common.THOUSANDS_SEPARATOR416.
    const echoed = getNumberSeparators((id) => id);
    assert.equal(echoed.group.includes("Common."), false);
    assert.equal(echoed.group, "\u00a0");

    const missing = getNumberSeparators(() => null);
    assert.equal(missing.group, "\u00a0");
    assert.equal(missing.decimal, ".");

    assert.equal(getNumberSeparators().group, "\u00a0");
  });

  it("promotes a plain space from the dictionary to a no-break space", () => {
    // The game does this normalization itself for the same reason.
    assert.equal(getNumberSeparators(() => " ").group, "\u00a0");
  });

  it("never emits a breakable space inside a number", () => {
    for (const value of [80000, 1234567, -1500, 12.34]) {
      assert.equal(groupDigits(value).includes(" "), false, `${value} grouped with a plain space`);
    }
  });

  it("keeps one decimal for fractional metrics and none for whole ones", () => {
    assert.equal(groupDigits(12.34), "12.3");
    assert.equal(groupDigits(12), "12");
  });

  it("distinguishes an absent metric from a real zero", () => {
    assert.equal(formatBuildingMetric(null, "cost"), METRIC_NO_DATA);
    assert.equal(formatBuildingMetric(undefined, "cost"), METRIC_NO_DATA);
    assert.equal(formatBuildingMetric(Number.NaN, "cost"), METRIC_NO_DATA);
    // A zero cost is real — the indexer leaves an unknown cost null, and vanilla
    // renders an authored zero as a zero too. It is named rather than printed as
    // a bare 0 so it cannot be misread as the "—" that means "not known".
    assert.equal(formatBuildingMetric(0, "cost"), METRIC_FREE);
    assert.notEqual(formatBuildingMetric(0, "cost"), METRIC_NO_DATA);
    assert.equal(formatBuildingMetric(0, "workers"), "0");
  });

  it("says what upkeep is per", () => {
    assert.equal(formatBuildingMetric(5000, "upkeep"), "5\u00a0000/mo");
    assert.equal(formatBuildingMetric(5000, "cost"), "5\u00a0000");
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
    assert.equal(formatCapacity(1200, "ServiceBuildings", "Education"), "1\u00a0200 students");
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
    assert.equal(details[0].value, "1\u00a0200 MW");
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

describe("Footprint presence", () => {
  it("declines a lot that is absent", () => {
    assert.equal(hasFootprint(null, null), false);
    assert.equal(hasFootprint(undefined, undefined), false);
    assert.equal(hasFootprint(4, null), false);
  });

  it("declines a zero lot, which is what a network has", () => {
    // A road's LotSize is 0x0 and formats as "0 × 0" — a measurement, stated
    // confidently, of something that does not exist.
    assert.equal(hasFootprint(0, 0), false);
    assert.equal(hasFootprint(4, 0), false);
    assert.equal(hasFootprint(0, 4), false);
  });

  it("accepts a real lot", () => {
    assert.equal(hasFootprint(4, 4), true);
    assert.equal(hasFootprint(1, 1), true);
  });
});

describe("Capacity units by role", () => {
  it("takes the unit from the component the prefab carries", () => {
    // Find It's own method. The category match below is a fallback for
    // anything the indexer found no service component on.
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Health", "Hospital"), "patients");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_EducationResearch", "School"), "students");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Electricity", "PowerPlant"), "MW");
  });

  it("fixes the two the category match got wrong", () => {
    // "police" matched a prison and called its prisoners vehicles; deathcare
    // storage was reported as patients.
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Police", "Prison"), "prisoners");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Police"), "vehicles");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Health", "DeathcareFacility"), "plots");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Health"), "patients");
  });

  it("falls back to the category when there is no role", () => {
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Water"), "m³");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Water", ""), "m³");
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Water", null), "m³");
  });

  it("falls back for a role this build has no unit for", () => {
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Health", "SomeNewService"), "patients");
  });
});
