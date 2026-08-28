import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCostForecast,
} from "../src/domain/buildingForecast.ts";

describe("Cost forecast", () => {
  it("states the cost against what you actually have", () => {
    // "115 000" is a fact; "115 000 of 310 000" is a decision.
    assert.deepEqual(getCostForecast(115000, 310000), {
      cost: 115000,
      treasury: 310000,
      share: 37,
      affordable: true,
    });
  });

  it("marks a building you cannot afford", () => {
    const forecast = getCostForecast(500000, 310000)!;

    assert.equal(forecast.affordable, false);
    assert.ok(forecast.share > 100);
  });

  it("treats a bankrupt treasury as affording nothing", () => {
    // The share would be negative or meaningless; what matters is the answer.
    assert.equal(getCostForecast(1000, -50000)!.affordable, false);
  });

  it("says nothing when there is no cost to speak of", () => {
    assert.equal(getCostForecast(null, 310000), null);
    assert.equal(getCostForecast(undefined, 310000), null);
  });

  it("still reports the cost when the treasury is unknown", () => {
    const forecast = getCostForecast(115000, null)!;

    assert.equal(forecast.cost, 115000);
    assert.equal(forecast.treasury, null);
    assert.equal(forecast.share, null);
  });
});

