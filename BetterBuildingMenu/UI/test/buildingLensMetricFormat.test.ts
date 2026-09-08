import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  METRIC_FREE,
  METRIC_NO_DATA,
  getNumberSeparators,
  formatBuildingMetric,
  formatCapacity,
  applyMoneyTemplate,
  FALLBACK_MONEY,
  FALLBACK_SEPARATORS,
  formatHeight,
  formatNetworkWidth,
  formatVolume,
  formatWeight,
  formatWeightPerMonth,
  getBuildingDetailMetrics,
  formatPerMonth,
  formatPower,
  formatEnergy,
  formatSpeedLimit,
  formatServiceRange,
  UnitSystem,
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

describe("Building level", () => {
  it("shows a zone building's real level", async () => {
    const { formatBuildingLevel } = await import("../src/domain/buildingLensMetricFormat.ts");

    assert.equal(formatBuildingLevel(1), "1");
    assert.equal(formatBuildingLevel(5), "5");
  });

  it("marks a building with no level as not applicable, not as zero", async () => {
    // cm-ch0z. Service buildings have no level and the column printed a bare
    // "0" for every one of them, sitting beside a "—" in Workers that means
    // "not known". Two different absences rendering as two different lies.
    const { formatBuildingLevel, METRIC_NOT_APPLICABLE } = await import(
      "../src/domain/buildingLensMetricFormat.ts"
    );

    assert.equal(formatBuildingLevel(0), METRIC_NOT_APPLICABLE);
  });

  it("keeps not-applicable distinguishable from not-known", async () => {
    // The bead's third criterion, and the reason this is not just "render a
    // dash": the table already uses one mark for each, and Parking has been
    // making the distinction since cm-zxou.
    const { METRIC_NOT_APPLICABLE, METRIC_NO_DATA } = await import(
      "../src/domain/buildingLensMetricFormat.ts"
    );

    // Both asserted non-empty first: comparing an undefined export against a
    // real one passes without either existing, which is a test that reports
    // success for a reason it does not name.
    assert.equal(typeof METRIC_NOT_APPLICABLE, "string");
    assert.ok(METRIC_NOT_APPLICABLE.length > 0);
    assert.equal(typeof METRIC_NO_DATA, "string");
    assert.ok(METRIC_NO_DATA.length > 0);
    assert.notEqual(METRIC_NOT_APPLICABLE, METRIC_NO_DATA);
  });

  it("falls back to not-known when the level never arrived", async () => {
    // Defensive: the wire always sends a number, but a null here means the
    // projection failed, which is a gap rather than a fact about the building.
    const { formatBuildingLevel, METRIC_NO_DATA } = await import(
      "../src/domain/buildingLensMetricFormat.ts"
    );

    assert.equal(formatBuildingLevel(null), METRIC_NO_DATA);
    assert.equal(formatBuildingLevel(undefined), METRIC_NO_DATA);
    assert.equal(formatBuildingLevel(Number.NaN), METRIC_NO_DATA);
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
    // 1200 in the game's hundreds-of-watts figure is 120 kW — vanilla's Power
    // rule, not the raw number wearing "MW".
    assert.equal(details[0].value, "120 kW");
    // A real zero is a fact worth showing; only absent metrics are dropped.
    assert.equal(details[3].value, "0");
  });

  it("shows the whole projected entry, not just the utility subset", async () => {
    // cm-qnfs. The detail panel offered eight candidates — utilities and
    // pollution — so a building with neither expanded to an empty box while the
    // row above it showed cost, workers and a lot size. The detail view is
    // where an asset is compared properly; it cannot know less than the row.
    const { getBuildingDetailMetrics } = await import("../src/domain/buildingLensMetricFormat.ts");

    const keys = getBuildingDetailMetrics({
      constructionCost: 45000,
      upkeep: 1500,
      capacity: 1000,
      workers: 12,
      households: 180,
      parkingSlots: 12,
      lotWidth: 3,
      lotDepth: 4,
      buildingLevel: 2,
      electricityConsumption: 30,
      groundPollution: 5,
    }).map((detail) => detail.key);

    // Money first, then what it buys, then what it occupies, then what it
    // draws and emits — the order the hover card already reads in.
    assert.deepEqual(keys, [
      "cost",
      "upkeep",
      "capacity",
      "workers",
      "households",
      "parking",
      "lot",
      "level",
      "electricity",
      "groundPollution",
    ]);
  });

  it("keeps a real zero and drops a not-applicable one", async () => {
    // A pollution of zero is a measurement. A building LEVEL of zero is not a
    // level — service buildings have none, and printing "0" beside dashes that
    // mean "unknown" is the defect cm-ch0z describes. Parking is the same: no
    // bays is not a bay count worth a row.
    const { getBuildingDetailMetrics } = await import("../src/domain/buildingLensMetricFormat.ts");

    const details = getBuildingDetailMetrics({
      airPollution: 0,
      buildingLevel: 0,
      parkingSlots: 0,
      constructionCost: 0,
    });

    const keys = details.map((detail) => detail.key);
    assert.ok(keys.includes("airPollution"), "a measured zero stays");
    assert.ok(keys.includes("cost"), "free is a real price");
    assert.ok(!keys.includes("level"), "level 0 means no level");
    assert.ok(!keys.includes("parking"), "0 bays is not a bay count");
  });

  it("names a network's cost as the rate it is", async () => {
    // A road prices by length. 12,500 for a road and 12,500 for a hospital are
    // not the same kind of number, and the existing formatter already says so —
    // the detail view has to use it rather than printing the bare figure.
    const { getBuildingDetailMetrics } = await import("../src/domain/buildingLensMetricFormat.ts");

    const [cost] = getBuildingDetailMetrics({ constructionCost: 12500, costIsPerDistance: true });

    assert.ok(/km/.test(cost.value), `expected a per-kilometre rate, got ${cost.value}`);
  });

  it("draws no lot for something without a footprint", async () => {
    // Networks and zones measure 0 x 0. "0 × 0" is a confident measurement of
    // something that does not exist.
    const { getBuildingDetailMetrics } = await import("../src/domain/buildingLensMetricFormat.ts");

    const keys = getBuildingDetailMetrics({ lotWidth: 0, lotDepth: 0, workers: 4 }).map((d) => d.key);

    assert.deepEqual(keys, ["workers"]);
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

describe("per-distance metrics", () => {
  it("marks a network cost as a rate, not a total", () => {
    // 12,500 for a road is per kilometre; the same number on a hospital is the
    // whole bill. The unit has to travel with the figure.
    // Built from groupDigits rather than a literal: the fallback group
    // separator is U+00A0, indistinguishable from a space on screen and in a
    // diff.
    // The game has its own per-kilometre money form, so the rate is stated the
    // way vanilla states it rather than by bolting "/km" onto a number.
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
    // means a cost reads in the lens exactly as it reads in vanilla's panels.
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
  // The rules are vanilla's own, read out of its UI bundle rather than
  // invented: Length is metres below 1000 and kilometres above with one
  // decimal; under Freedom it is YARDS below 1609 and miles above. Yards, not
  // feet — feet are what vanilla uses for Height and NetElevation.
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
    // Length: metres, and YARDS under Freedom. It briefly rendered feet here
    // on the argument that a net dimension is more like an elevation — that
    // was our taste overriding the game's own rule, and the game wins.
    //
    // Whole units, no decimal, because that is what vanilla's Length does
    // below its threshold.
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
    // ¢4,000/km is ¢6,437/mi — changing the unit without the figure would
    // understate a road by more than a third. And the conversion lands on
    // 6437.376, which must not reach the card as "¢6,437.4": money is whole
    // everywhere else on it.
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
  // Vanilla's Weight formatter, read off the shipped bundle: the raw figure is
  // kilograms; metric shows kg below 100, tonnes below a million (two
  // decimals), kilotonnes above; imperial shows lb below 100 kg, short tons
  // (kg / 907.18474, template "tn") below 9,071,847.4 kg, short kilotons
  // above. Pounds are kg / 0.45359237. Same thresholds, same constants, so a
  // figure here reads as the same figure in the game's own panels.
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
    // "weight" unit as cargo. We printed the raw kilograms under a "t" label
    // — a landfill read "500,000 t".
    assert.equal(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Garbage", "GarbageFacility"), "500 t");
    assert.equal(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Garbage", "GarbageFacility", imperial), "551.16 tn");
  });

  it("a post facility's mail capacity is a count, not a weight", () => {
    // Vanilla binds PostFacilityData.m_MailCapacity as
    // Properties.MAIL_STORAGE_CAPACITY with the "integer" unit
    // (PrefabUISystem.cs:1630) — the same unit as its van count. An earlier
    // pass had grouped it with garbage as a weight, and a post office read
    // "500 t" of mail.
    assert.doesNotMatch(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Communications", "PostFacility"), /\bt$|tn$/);
    // The thousands separator is the locale's business; the digits are ours.
    assert.equal(formatCapacity(500000, "ServiceBuildings", "ServiceBuildings_Communications", "PostFacility").replace(/[^0-9]/g, ""), "500000");
  });
});

describe("rates follow the game's own per-month rules", () => {
  // Vanilla's WeightPerMonth: kilograms per month, shown as kg/mo. below 100
  // (one decimal) and t/mo. above (two); imperial lb/mo. and tn/mo. with the
  // same constants as Weight. Its plain per-month template is "{VALUE} /mo.".
  // Garbage processing and garbage accumulation are the first; deathcare
  // processing and mail sorting are integers per month, the second.
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

describe("the details table shows the game's units", () => {
  // ConsumptionData.m_GarbageAccumulation is kilograms per month and vanilla
  // shows it as WeightPerMonth; we printed the raw figure under "t".
  it("garbage produced is a weight per month", () => {
    const details = getBuildingDetailMetrics({ garbageAccumulation: 100000 } as never);
    const garbage = details.find((d) => d.key === "garbage");
    assert.equal(garbage && garbage.value, "100 t/mo.");
  });
});

describe("electricity follows the game's own units", () => {
  // Vanilla's Power: the raw figure is in hundreds of watts — below 10,000 it
  // shows raw/10 as kW (one decimal), above as raw/10,000 MW (two). Energy is
  // raw/10,000 MWh (one decimal). We labelled the raw figure "MW", so a
  // 400 MW plant read "4,000,000 MW".
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
  // unit (PrefabUISystem.cs:1603, :1605): cubic metres a month, and US
  // gallons a month under Freedom at the game's 264.172. Ours labelled the
  // raw figure "m³" whatever the setting — a water tower read "15,000 m³"
  // beside a road priced per mile.
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
  // through Common.VALUE_GIGABIT_PER_SECOND (PrefabUISystem.cs:1637). Ours was
  // a bare "25 000", and the index had truncated the float on the way in.
  it("states gigabits a second in both unit systems", () => {
    const imperial = { ...FALLBACK_SEPARATORS, unitSystem: UnitSystem.Freedom };

    assert.match(formatCapacity(2.5, "ServiceBuildings", "ServiceBuildings_Communications", "TelecomFacility"), /^2[.,]5 Gbit\/s$/);
    assert.match(formatCapacity(2.5, "ServiceBuildings", "ServiceBuildings_Communications", "TelecomFacility", imperial), /^2[.,]5 Gbit\/s$/);
  });
});
