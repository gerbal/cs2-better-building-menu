import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_FACT_LOCALIZATION_KEYS,
  renderServiceFacts,
  renderServiceTextFacts,
  orderFacts,
} from "../src/domain/serviceFacts.ts";

const noTranslation = () => null;

describe("renderServiceFacts", () => {
  it("labels a service figure and gives it its unit", () => {
    const rendered = renderServiceFacts(
      [{ key: "helicopters", value: 2 }, { key: "processingRate", value: 1200 }],
      noTranslation,
    );

    assert.deepEqual(rendered.map((f) => `${f.label} ${f.value}`), [
      "Helicopters 2",
      "Processing 1200 t/mo",
    ]);
  });

  it("draws a modifier as a multiplier, not a quantity", () => {
    // A graduation modifier of 1.15 is a different building from one of 1.5;
    // rounded to whole numbers both would read "×1".
    const [fact] = renderServiceFacts([{ key: "graduation", value: 1.15 }], noTranslation);

    assert.equal(fact.value, "×1.15");
  });

  it("drops a key this build has no wording for", () => {
    // The backend can record a figure before the UI knows how to say it — the
    // two ship together but a player may run a mismatched pair, and
    // "sortingRate 240" on a card is worse than no line at all.
    assert.deepEqual(renderServiceFacts([{ key: "somethingNew", value: 5 }], noTranslation), []);
  });

  it("drops a value that is not a number", () => {
    const facts = [{ key: "helicopters", value: Number.NaN }] as { key: string; value: number }[];

    assert.deepEqual(renderServiceFacts(facts, noTranslation), []);
  });

  it("prefers the game's translation over the fallback", () => {
    const [fact] = renderServiceFacts(
      [{ key: "attractiveness", value: 40 }],
      (key) => (key === "Tooltip.LABEL[BetterBuildingMenu.Attractiveness]" ? "Anziehungskraft" : null),
    );

    assert.equal(fact.label, "Anziehungskraft");
  });

  it("says nothing for a building with no service figures", () => {
    assert.deepEqual(renderServiceFacts([], noTranslation), []);
    assert.deepEqual(renderServiceFacts(null, noTranslation), []);
    assert.deepEqual(renderServiceFacts(undefined, noTranslation), []);
  });

  it("ships a string for every key it can ask for", () => {
    // The localization audit scans source for literal keys; these live in a
    // table, so this is the check that the table and Locale.json agree.
    assert.ok(SERVICE_FACT_LOCALIZATION_KEYS.length > 0);
    for (const key of SERVICE_FACT_LOCALIZATION_KEYS) {
      assert.match(key, /^Tooltip\.LABEL\[BetterBuildingMenu\.[A-Za-z]+\]$/);
    }
  });
});

describe("renderServiceTextFacts", () => {
  it("labels a worded figure the game already named", () => {
    // A traded resource arrives named by the game, so it passes through.
    const rendered = renderServiceTextFacts(
      [{ key: "zoneSold", value: "Food" }, { key: "zoneStored", value: "Grain" }],
      () => null,
    );

    assert.deepEqual(rendered.map((f) => `${f.label} ${f.value}`), ["Sells Food", "Stores Grain"]);
  });

  it("gives our own tokens our own words", () => {
    // "narrow" and "corners" are our tokens, not the game's vocabulary.
    const [fact] = renderServiceTextFacts([{ key: "zoneLotShapes", value: "narrow" }], () => null);

    assert.equal(fact.value, "Narrow");
  });

  it("joins repeats of one key into a single line", () => {
    // The indexer emits one fact per lot shape; two lines both reading
    // "Lot shapes" would be one fact printed twice.
    const [fact] = renderServiceTextFacts(
      [{ key: "zoneLotShapes", value: "narrow" }, { key: "zoneLotShapes", value: "corners" }],
      () => null,
    );

    assert.equal(fact.label, "Lot shapes");
    assert.equal(fact.value, "Narrow, Corners");
  });

  it("prefers the game's translation for label and value alike", () => {
    const [fact] = renderServiceTextFacts(
      [{ key: "zoneLotShapes", value: "corners" }],
      (key) =>
        key === "Tooltip.LABEL[BetterBuildingMenu.ZoneLotShapes]" ? "Grundstücke"
          : key === "Tooltip.LABEL[BetterBuildingMenu.ZoneShapeCorners]" ? "Ecken"
            : null,
    );

    assert.equal(fact.label, "Grundstücke");
    assert.equal(fact.value, "Ecken");
  });

  it("drops a key or a blank this build cannot draw", () => {
    assert.deepEqual(renderServiceTextFacts([{ key: "somethingNew", value: "x" }], () => null), []);
    assert.deepEqual(renderServiceTextFacts([{ key: "zoneSold", value: "  " }], () => null), []);
    assert.deepEqual(renderServiceTextFacts([], () => null), []);
    assert.deepEqual(renderServiceTextFacts(null, () => null), []);
  });
});

describe("cargo capacity", () => {
  // StorageLimitData.m_Limit, which vanilla binds as Properties.CARGO_CAPACITY
  // with the weight unit — a cargo harbour's warehouses add to it, and the
  // picker had nothing to say about them.
  it("is a weight, labelled with the game's own words, placed with the capacities", () => {
    const translate = (key: string, fallback: string | null) =>
      key === "Tooltip.LABEL[BetterBuildingMenu.CargoCapacity]" ? "Cargo Capacity" : fallback;
    const [line] = renderServiceFacts(
      [{ key: "cargoCapacity", value: 500000 }],
      translate,
      (value) => String(value),
      { weight: (value) => `W(${value})` },
    );

    assert.equal(line.label, "Cargo Capacity");
    assert.equal(line.value, "W(500000)");

    const ordered = orderFacts([{ key: "purification" }, { key: "cargoCapacity" }, { key: "stormCapacity" }])
      .map((fact) => fact.key);
    assert.deepEqual(ordered, ["stormCapacity", "cargoCapacity", "purification"]);
  });
});

describe("orderFacts", () => {
  it("puts figures in one declared order whatever order they arrived in", () => {
    // The facts arrive in the order the INDEXER happened to emit them, which
    // depends on which C# blocks a prefab hit. A fire station and a hospital
    // both carry helicopters and a shift share, and without this they would
    // show them in different positions — so the reader cannot learn where to
    // look, which is the whole point of a fixed card.
    const asIndexed = [
      { key: "nightShift" }, { key: "helicopters" }, { key: "xpReward" }, { key: "graduation" },
    ];
    const other = [
      { key: "xpReward" }, { key: "graduation" }, { key: "helicopters" }, { key: "nightShift" },
    ];

    const first = orderFacts(asIndexed).map((fact) => fact.key);
    const second = orderFacts(other).map((fact) => fact.key);

    assert.deepEqual(first, second, "the same keys must land in the same order");
    // What the building DOES leads; how it is staffed and what it earns follow.
    assert.ok(first.indexOf("helicopters") < first.indexOf("graduation"));
    assert.ok(first.indexOf("graduation") < first.indexOf("nightShift"));
    assert.ok(first.indexOf("nightShift") < first.indexOf("xpReward"));
  });

  it("keeps a key it has never heard of, last and in the order given", () => {
    // A new fact must not vanish because nobody added it to the order — it
    // shows up at the end until someone places it deliberately.
    const ordered = orderFacts([
      { key: "somethingNew" }, { key: "helicopters" }, { key: "anotherNew" },
    ]).map((fact) => fact.key);

    assert.deepEqual(ordered, ["helicopters", "somethingNew", "anotherNew"]);
  });

  it("interleaves worded figures with numeric ones", () => {
    // They render as two separate lists and used to be shown as two blocks,
    // all the words then all the numbers. Ordering is a property of the FIELD,
    // not of how its value happens to be typed.
    const ordered = orderFacts([
      { key: "xpReward" }, { key: "jobComplexity" }, { key: "helicopters" },
    ]).map((fact) => fact.key);

    assert.deepEqual(ordered, ["helicopters", "jobComplexity", "xpReward"]);
  });
});
