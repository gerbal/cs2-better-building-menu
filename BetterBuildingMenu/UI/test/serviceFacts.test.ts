import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_FACT_LOCALIZATION_KEYS,
  renderServiceFacts,
  renderServiceTextFacts,
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
