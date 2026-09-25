import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNumberSeparators, type NumberSeparators } from "../src/domain/buildingLensMetricFormat.ts";
import { effectLines, formatEffectDelta } from "../src/domain/effectFormat.ts";

const english = getNumberSeparators();
const german: NumberSeparators = { ...english, group: ".", decimal: "," };

describe("an effect's number, where the game's renderer is missing", () => {
  it("is a whole percentage, signed on a gain", () => {
    assert.equal(formatEffectDelta(12.5, "percentage", english), "+13%");
    assert.equal(formatEffectDelta(-20, "percentage", english), "-20%");
  });

  it("is one decimal otherwise, a whole number from 100 up", () => {
    assert.equal(formatEffectDelta(1.24, "floatSingleFraction", english), "+1.2");
    assert.equal(formatEffectDelta(150.44, "floatSingleFraction", english), "+150");
    assert.equal(formatEffectDelta(-250.6, "floatSingleFraction", english), "-251");
  });

  it("never rounds a small effect away", () => {
    assert.equal(formatEffectDelta(0.04, "floatSingleFraction", english), "+0.1");
    assert.equal(formatEffectDelta(-0.04, "floatSingleFraction", english), "-0.1");
  });

  it("draws a zero, unsigned, as vanilla draws every effect", () => {
    assert.equal(formatEffectDelta(0, "floatSingleFraction", english), "0");
    assert.equal(formatEffectDelta(0.4, "percentage", english), "0%");
    assert.equal(formatEffectDelta(-0.4, "percentage", english), "0%");
  });

  it("uses the player's separators", () => {
    assert.equal(formatEffectDelta(1.5, "floatSingleFraction", german), "+1,5");
    assert.equal(formatEffectDelta(1500, "percentage", german), "+1.500%");
  });
});

describe("a building's effect lines", () => {
  const effects = [
    { label: "Health", delta: 1.5, unit: "floatSingleFraction" },
    { label: "Hospital Efficiency", delta: 10, unit: "percentage" },
  ];

  it("take the game's renderer's number when it draws one", () => {
    assert.deepEqual(
      effectLines(effects, (value, unit) => (unit === "percentage" ? `+${value} %` : `+${value}`), english),
      ["Health +1.5", "Hospital Efficiency +10 %"],
    );
  });

  it("fall back to ours when it draws nothing or throws", () => {
    assert.deepEqual(effectLines(effects, () => "", german), ["Health +1,5", "Hospital Efficiency +10%"]);
    assert.deepEqual(
      effectLines(effects, () => {
        throw new Error("no renderer");
      }, english),
      ["Health +1.5", "Hospital Efficiency +10%"],
    );
    assert.deepEqual(effectLines(effects, undefined, english), ["Health +1.5", "Hospital Efficiency +10%"]);
  });

  it("are none for a building with no effects", () => {
    assert.deepEqual(effectLines(null, undefined, english), []);
  });
});
