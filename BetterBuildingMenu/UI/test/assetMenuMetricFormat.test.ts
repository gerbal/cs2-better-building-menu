import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  METRIC_FREE,
  METRIC_NO_DATA,
  getNumberSeparators,
  formatBuildingMetric,
  formatCapacity,
  compactCostPerCellForms,
  compactMoneyForms,
  compactUnitForms,
  formatCostPerCell,
  applyMoneyTemplate,
  FALLBACK_MONEY,
  FALLBACK_SEPARATORS,
  formatHeight,
  formatNetworkWidth,
  formatVolume,
  formatWeight,
  formatWeightPerMonth,
  formatPerMonth,
  formatPower,
  formatEnergy,
  formatSpeedLimit,
  formatServiceRange,
  UnitSystem,
  getCapacityUnitLabel,
  groupDigits,
  hasFootprint,
} from "../src/domain/assetMenuMetricFormat.ts";

describe("Asset menu metric formatting", () => {
  it("groups thousands without relying on Intl", () => {
    // Cohtml's toLocaleString does not group, so the grouping is done here
    // rather than delegated. The separator defaults to a NO-BREAK space:
    // Cohtml splits a number across lines at a plain U+0020 between digits.
    assert.equal(groupDigits(80000), "80\u00a0000");
    assert.equal(groupDigits(1234567), "1\u00a0234\u00a0567");
    assert.equal(groupDigits(999), "999");
    assert.equal(groupDigits(-1500), "-1\u00a0500");
  });

  it("groups with whatever separator the game's dictionary gives", () => {
    // The separator is the game's own Common.THOUSANDS_SEPARATOR, not one
    // hardcoded here, or our column disagrees with the game's on one screen.
    assert.equal(groupDigits(1234567, { group: ",", decimal: "." }), "1,234,567");
    assert.equal(groupDigits(1234567, { group: ".", decimal: "," }), "1.234.567");
    assert.equal(groupDigits(12.34, { group: ".", decimal: "," }), "12,3");
  });

  it("reads the separators from the game rather than assuming them", () => {
    const separators = getNumberSeparators((id) =>
      id === "Common.THOUSANDS_SEPARATOR" ? "," : id === "Common.DECIMAL_SEPARATOR" ? "." : null
    );
    assert.equal(separators.group, ",");
    assert.equal(separators.decimal, ".");
    // The money templates come from the same dictionary; an absent key falls
    // back rather than rendering the id.
    assert.equal(separators.money?.plain, FALLBACK_MONEY.plain);
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

  it("says what upkeep is per, and that both are money", () => {
    // Money is drawn through the game's own VALUE_MONEY templates, so it
    // carries vanilla's symbol and vanilla's "per month" — see MoneyTemplates.
    assert.equal(formatBuildingMetric(5000, "upkeep"), "¢5\u00a0000/mo");
    assert.equal(formatBuildingMetric(5000, "cost"), "¢5\u00a0000");
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

describe("Asset menu lot dimensions", () => {
  it("emits one text node with non-breaking spaces", async () => {
    const { formatLotDimensions } = await import("../src/domain/assetMenuMetricFormat.ts");

    // JSX's `{w} × {d}` produced three text nodes, and Cohtml broke the cell
    // across three lines at those boundaries even under white-space: nowrap.
    // A single string joined by U+00A0 leaves no break opportunity at all.
    assert.equal(formatLotDimensions(19, 16), "19\u00a0\u00d7\u00a016");
    assert.ok(!formatLotDimensions(19, 16).includes("\u0020"));
  });

  it("still renders when a dimension is missing", async () => {
    const { formatLotDimensions } = await import("../src/domain/assetMenuMetricFormat.ts");

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
    assert.equal(getCapacityUnitLabel("ServiceBuildings", "ServiceBuildings_Health", "DeathcareFacility"), "");
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

describe("per-distance metrics", () => {
  it("marks a network cost as a rate, not a total", () => {
    // 12,500 for a road is per kilometre; the same number on a hospital is the
    // whole bill, so the unit travels with the figure. Built from groupDigits,
    // and stated in the game's own per-kilometre money form.
    assert.equal(
      formatBuildingMetric(12500, "cost", undefined, true),
      applyMoneyTemplate(FALLBACK_MONEY.perKilometre, groupDigits(12500)),
    );
  });

  it("keeps upkeep's monthly sense alongside the distance", () => {
    assert.equal(
      formatBuildingMetric(340, "upkeep", undefined, true),
      applyMoneyTemplate(FALLBACK_MONEY.perKilometrePerMonth, groupDigits(340)),
    );
  });

  it("does not call a zero rate Free, which is a claim about a total", () => {
    assert.equal(
      formatBuildingMetric(0, "cost", undefined, true),
      applyMoneyTemplate(FALLBACK_MONEY.perKilometre, "0"),
    );
    assert.equal(formatBuildingMetric(0, "cost", undefined, false), METRIC_FREE);
  });

  it("still reports absence as absence", () => {
    assert.equal(formatBuildingMetric(null, "cost", undefined, true), METRIC_NO_DATA);
  });
});

describe("formatServiceRange", () => {
  it("reads as metres, rounded", () => {
    // The simulation measures in metres and the game's own coverage readouts
    // say so; nobody reads a tower's reach to the centimetre.
    assert.equal(formatServiceRange(480), "480 m");
    assert.equal(formatServiceRange(479.6), "480 m");
  });

  it("says nothing where there is no range to say", () => {
    // Most of the catalog: a building that serves the whole city, or nothing.
    // Empty rather than a dash, so the tooltip line drops out entirely.
    for (const value of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(formatServiceRange(value as number), "");
    }
  });
});

describe("money templates", () => {
  it("uses the game's own template, symbol placement and all", () => {
    // Vanilla ships "{SIGN}¢{VALUE}", and some locales put the symbol
    // elsewhere or use a different one. Substituting into the game's string
    // means a cost reads in the asset menu exactly as it reads in vanilla's panels.
    const separators = getNumberSeparators((id) =>
      id === "Common.VALUE_MONEY" ? "{SIGN}{VALUE} kr" : null);

    assert.equal(formatBuildingMetric(1200, "cost", separators), "1 200 kr");
  });

  it("ignores a template that lost its placeholder", () => {
    // A template with no {VALUE} would render the symbol and drop the number,
    // which is worse than our own fallback.
    const separators = getNumberSeparators((id) =>
      id === "Common.VALUE_MONEY" ? "¢" : null);

    assert.equal(formatBuildingMetric(50, "cost", separators), applyMoneyTemplate(FALLBACK_MONEY.plain, "50"));
  });

  it("drops {SIGN}, which is for negatives a cost never has", () => {
    assert.equal(applyMoneyTemplate("{SIGN}¢{VALUE}", "40"), "¢40");
  });

  it("leaves non-money metrics alone", () => {
    // Workers and capacity are counts; a currency symbol on them would be a
    // lie about what the number measures.
    assert.equal(formatBuildingMetric(500, "workers"), groupDigits(500));
    assert.equal(formatBuildingMetric(500, "capacity"), groupDigits(500));
  });
});

describe("formatServiceRange under the player's unit system", () => {
  // The rules are vanilla's own, read out of its UI bundle: Length is metres
  // below 1000 and kilometres above with one decimal; under Freedom it is
  // YARDS below 1609 and miles above — not feet, which Height uses.
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };
  const metric = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Metric };

  it("keeps the game's own metric thresholds", () => {
    assert.match(formatServiceRange(480, metric), /480 m$/);
    assert.match(formatServiceRange(2000, metric), /2 km$/);
    assert.match(formatServiceRange(2300, metric), /2\.3 km$/);
  });

  it("reads in yards and miles for a Freedom-units player", () => {
    // 500 m is 546.8 yd; 2000 m is 1.2 mi. The switch is at 1609 m, which is
    // one mile, so nothing ever reads "1,760 yd".
    assert.match(formatServiceRange(500, imperial), /547 yd$/);
    assert.match(formatServiceRange(2000, imperial), /1\.2 mi$/);
    assert.doesNotMatch(formatServiceRange(2000, imperial), /\bm\b|km/);
  });

  it("switches at a mile, not at a kilometre", () => {
    assert.match(formatServiceRange(1608, imperial), /yd$/);
    assert.match(formatServiceRange(1610, imperial), /mi$/);
  });

  it("defaults to metric when nobody said otherwise", () => {
    // An older caller that passes no unit system, and the first frame before
    // the binding has answered.
    assert.match(formatServiceRange(2000), /2 km$/);
  });
});

describe("width and speed follow the same setting", () => {
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

  it("states a network width by the game's Length rule", () => {
    // A width is a horizontal distance, so it takes the units vanilla gives a
    // Length: metres, and YARDS under Freedom. Whole units, no decimal, which
    // is what vanilla's Length does below its threshold.
    assert.match(formatNetworkWidth(16, imperial), /17 yd$/);
    assert.match(formatNetworkWidth(16), /16 m$/);
  });

  it("states a speed limit in mph", () => {
    assert.match(formatSpeedLimit(56, imperial), /35 mph$/);
    assert.match(formatSpeedLimit(56), /56 km\/h$/);
  });
});

describe("per-distance money under Freedom units", () => {
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

  it("converts the rate as well as the unit, and keeps money whole", () => {
    // Changing the unit without converting the figure would understate a road
    // by more than a third, and the conversion must not reach the card with a
    // decimal: money is whole everywhere else on it.
    const cost = formatBuildingMetric(4000, "cost", imperial, true);

    assert.doesNotMatch(cost, /\./, `money kept a fraction: ${cost}`);
    assert.match(cost, /6.437/);
    assert.match(cost, /mi/);
    assert.doesNotMatch(cost, /km/);
  });

  it("leaves the metric rate exactly as it was", () => {
    const metric = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Metric };

    assert.match(formatBuildingMetric(4000, "cost", metric, true), /4.000.*km/);
  });
});

describe("height and volume take the game's other two rules", () => {
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

  it("states a height in feet, which is what vanilla's Height does", () => {
    // Height and NetElevation are the two places vanilla uses FEET rather than
    // yards. A zone's maximum building height is one of them.
    assert.match(formatHeight(30, imperial), /98 ft$/);
    assert.match(formatHeight(30), /30 m$/);
  });

  it("states a volume in gallons, at the game's own factor", () => {
    // 264.172 is the literal in vanilla's bundle, so a tank here reads the
    // same as the same tank anywhere else.
    assert.match(formatVolume(10, imperial), /2.642 gal$/);
    assert.match(formatVolume(10), /10 m³$/);
  });
});

describe("weight follows the game's own rule", () => {
  // Vanilla's Weight formatter, read off the shipped bundle: metric shows kg
  // below 100, tonnes below a million (two decimals) and kilotonnes above;
  // imperial shows lb, short tons and short kilotons on the same thresholds.
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

  it("metric: kilograms, tonnes, kilotonnes at vanilla's thresholds", () => {
    assert.equal(formatWeight(50), "50 kg");
    assert.equal(formatWeight(500000), "500 t");
    assert.equal(formatWeight(12345), "12.35 t");
    assert.equal(formatWeight(1250000), "1.25 kt");
    assert.equal(formatWeight(0), "");
  });

  it("imperial: pounds and short tons with vanilla's constants", () => {
    assert.equal(formatWeight(50, imperial), "110.2 lb");
    assert.equal(formatWeight(500000, imperial), "551.16 tn");
    assert.match(formatWeight(10000000, imperial), /^11\.02 /);
  });

  it("a weight capacity is kilograms too, so garbage reads in tonnes", () => {
    // GarbageFacilityData.m_GarbageCapacity is bound by vanilla with the same
    // "weight" unit as cargo, not as raw kilograms under a "t" label.
    assert.equal(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Garbage", "GarbageFacility"), "500 t");
    assert.equal(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Garbage", "GarbageFacility", imperial), "551.16 tn");
  });

  it("a post facility's mail capacity is a count, not a weight", () => {
    // Vanilla binds PostFacilityData.m_MailCapacity as
    // Properties.MAIL_STORAGE_CAPACITY with the "integer" unit — the same
    // unit as its van count, and not a weight.
    assert.doesNotMatch(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Communications", "PostFacility"), /\bt$|tn$/);
    // The thousands separator is the locale's business; the digits are ours.
    assert.equal(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Communications", "PostFacility").replace(/[^0-9]/g, ""), "500000");
  });
});

describe("rates follow the game's own per-month rules", () => {
  // Vanilla's WeightPerMonth: kg/mo. below 100 (one decimal) and t/mo. above
  // (two), imperial on Weight's constants. Garbage processing and garbage
  // accumulation are these; deathcare and mail sorting are integers per month.
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

  it("weight per month", () => {
    assert.equal(formatWeightPerMonth(50), "50 kg/mo.");
    assert.equal(formatWeightPerMonth(100000), "100 t/mo.");
    assert.equal(formatWeightPerMonth(50, imperial), "110.2 lb/mo.");
    assert.equal(formatWeightPerMonth(100000, imperial), "110.23 tn/mo.");
    assert.equal(formatWeightPerMonth(0), "");
  });

  it("a plain count per month", () => {
    assert.match(formatPerMonth(1200), /^1.200 \/mo\.$/);
    assert.equal(formatPerMonth(0), "");
  });
});

describe("electricity follows the game's own units", () => {
  // Vanilla's Power: the raw figure is in hundreds of watts — below 10,000 it
  // shows raw/10 as kW (one decimal), above as raw/10,000 MW (two). Energy is
  // raw/10,000 MWh (one decimal).
  it("power", () => {
    assert.equal(formatPower(5000), "500 kW");
    assert.equal(formatPower(20000), "2 MW");
    assert.equal(formatPower(4000000), "400 MW");
    assert.equal(formatPower(0), "");
  });

  it("energy", () => {
    assert.equal(formatEnergy(150000), "15 MWh");
    assert.equal(formatEnergy(0), "");
  });

  it("a power plant's capacity and a battery's storage take those rules", () => {
    assert.equal(formatCapacity(4000000, "ServiceBuildings", "ServiceBuildings_Electricity", "PowerPlant"), "400 MW");
    assert.equal(formatCapacity(150000, "ServiceBuildings", "ServiceBuildings_Electricity", "Battery"), "15 MWh");
  });
});

describe("water volumes follow the game's own unit system", () => {
  const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

  // Vanilla binds WATER_CAPACITY and SEWAGE_CAPACITY with the volumePerMonth
  // unit: cubic metres a month, and US gallons a month under Freedom at the
  // game's own 264.172.
  for (const role of ["WaterPumpingStation", "SewageOutlet", "WastewaterTreatmentPlant"]) {
    it(`${role}: cubic metres a month, gallons a month under Freedom`, () => {
      const metric = formatCapacity(100000, "ServiceBuildings", "ServiceBuildings_Water", role);
      const freedom = formatCapacity(100000, "ServiceBuildings", "ServiceBuildings_Water", role, imperial);

      assert.match(metric, /m³\/mo\.$/);
      assert.equal(metric.replace(/[^0-9]/g, ""), "100000");
      assert.match(freedom, /gal\/mo\.$/);
      assert.equal(freedom.replace(/[^0-9]/g, ""), "26417200");
    });
  }

  it("a water building with no role still converts", () => {
    assert.match(formatCapacity(15000, "ServiceBuildings", "ServiceBuildings_Water", null, imperial), /gal\/mo\.$/);
  });
});

describe("a telecom facility's capacity is a data rate", () => {
  // Vanilla binds TelecomFacilityData.m_NetworkCapacity as NETWORK_CAPACITY
  // with the dataRate unit: the figure as gigabits a second, one decimal,
  // through Common.VALUE_GIGABIT_PER_SECOND.
  it("states gigabits a second in both unit systems", () => {
    const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

    assert.match(formatCapacity(2.5, "ServiceBuildings", "ServiceBuildings_Communications", "TelecomFacility"), /^2[.,]5 Gbit\/s$/);
    assert.match(formatCapacity(2.5, "ServiceBuildings", "ServiceBuildings_Communications", "TelecomFacility", imperial), /^2[.,]5 Gbit\/s$/);
  });
});

describe("a network's cost per cell", () => {
  it("is its per-kilometre figure over the 125 cells of a kilometre, whole, in the game's money template", () => {
    assert.equal(formatCostPerCell(5_500), "¢44/c");
    assert.equal(formatCostPerCell(26_500), "¢212/c");
    assert.equal(formatCostPerCell(125_000), `¢${groupDigits(1_000)}/c`);
  });

  it("shortens like a total and keeps its cell, which tells a network's figure from a building's", () => {
    assert.deepEqual(compactCostPerCellForms(12_500_000), ["¢100k/c", "¢0.1M/c"]);
    assert.deepEqual(compactCostPerCellForms(1_250_000), ["¢10k/c", "¢0.01M/c"]);
    // A road's monthly upkeep, a cell's share of it to one decimal.
    assert.deepEqual(compactCostPerCellForms(38), ["¢0.3/c", "¢0/c"]);
    assert.deepEqual(compactCostPerCellForms(4_612), ["¢36.9/c", "¢37/c", "¢0.04k/c"]);
  });
});

describe("a figure with a unit, shortened", () => {
  it("drops its decimals a step at a time and keeps its unit", () => {
    assert.deepEqual(compactUnitForms("1,234.57 MW", { ...FALLBACK_SEPARATORS, group: "," }), ["1,234.57 MW", "1,234.6 MW", "1,235 MW"]);
    assert.deepEqual(compactUnitForms("2.45 t"), ["2.45 t", "2.5 t", "2 t"]);
  });

  it("reads the player's own marks, and leaves a figure with no decimals as it is", () => {
    assert.deepEqual(compactUnitForms("1.234,5 kW", { ...FALLBACK_SEPARATORS, group: ".", decimal: "," }), ["1.234,5 kW", "1.235 kW"]);
    assert.deepEqual(compactUnitForms("450 kW"), ["450 kW"]);
  });
});

describe("compact money", () => {
  const first = (...args: Parameters<typeof compactMoneyForms>) => compactMoneyForms(...args)[0];

  it("says thousands and millions with one decimal at most, in the game's template for a total", () => {
    assert.equal(first(850_000), "¢850k");
    assert.equal(first(1_200_000), "¢1.2M");
    assert.equal(first(12_500_000), "¢12.5M");
    assert.equal(first(1_250, { ...FALLBACK_SEPARATORS, money: { ...FALLBACK_MONEY, plain: "{SIGN}{VALUE} ¢" } }), "1.3k ¢");
  });

  it("says millions where thousands would round to a thousand of them", () => {
    assert.equal(first(999_950), "¢1M");
    assert.equal(first(999_000), "¢999k");
  });

  it("shortens a figure step by step: one decimal, none, the next unit up, and adds no unit of its own", () => {
    assert.deepEqual(compactMoneyForms(16_500), ["¢16.5k", "¢17k", "¢0.02M"]);
    // Not "¢0M": the next unit up is left out where two decimals still say nothing.
    assert.deepEqual(compactMoneyForms(1_250), ["¢1.3k", "¢1k"]);
  });

  it("never says a thousand thousands, and says a whole figure in the next unit up", () => {
    // 999.6k to no decimal is 1000k: the next unit says it.
    assert.deepEqual(compactMoneyForms(999_600), ["¢999.6k", "¢1M"]);
    assert.deepEqual(compactMoneyForms(950), ["¢950", "¢1k"]);
  });
});
