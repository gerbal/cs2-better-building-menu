import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCapacityForecast,
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

describe("Capacity forecast", () => {
  it("projects the new coverage against demand", () => {
    // The question is never "how big is it" but "does it cover the shortfall".
    assert.deepEqual(
      getCapacityForecast({ added: 1200, current: 2200, demand: 3100, unit: "students" }),
      { basis: "city", projected: 3400, added: 1200, demand: 3100, unit: "students", covers: true, shortfall: 0 }
    );
  });

  it("names the remaining shortfall when it does not cover", () => {
    const forecast = getCapacityForecast({ added: 400, current: 2200, demand: 3100, unit: "students" })!;

    assert.equal(forecast.covers, false);
    assert.equal(forecast.shortfall, 500);
  });

  it("reports coverage exactly at the demand line", () => {
    assert.equal(
      getCapacityForecast({ added: 900, current: 2200, demand: 3100, unit: "students" })!.covers,
      true
    );
  });

  it("says nothing when the building adds no capacity", () => {
    assert.equal(getCapacityForecast({ added: 0, current: 10, demand: 20, unit: "students" }), null);
    assert.equal(getCapacityForecast({ added: null, current: 10, demand: 20, unit: "students" }), null);
  });

  it("omits the projection when the current baseline is unknown", () => {
    // A zero baseline is indistinguishable from "the binding has not reported
    // yet", and claiming "2 000 of 291" when the city already has 1 400 places
    // is worse than claiming less. Report the contribution, not a total.
    const forecast = getCapacityForecast({ added: 2000, current: 0, demand: 291, unit: "students" })!;

    assert.equal(forecast.projected, null);
    assert.equal(forecast.added, 2000);
    assert.equal(forecast.demand, 291);
  });

  it("says nothing when the city has no demand figure for it", () => {
    // Better silent than confidently wrong: a park has no demand series.
    assert.equal(getCapacityForecast({ added: 100, current: 0, demand: null, unit: "" }), null);
  });
});

describe("what the capacity verdict is actually comparing", () => {
  it("says when the city's own capacity is the baseline", async () => {
    const { getCapacityForecast } = await import("../src/domain/buildingForecast.ts");

    const forecast = getCapacityForecast({ added: 25, current: 400, demand: 380, unit: "patients" });

    assert.equal(forecast?.basis, "city");
    assert.equal(forecast?.projected, 425);
    assert.equal(forecast?.covers, true);
  });

  it("says when it has no baseline and is judging the building alone", async () => {
    // cm-7r5r. Without a baseline the verdict silently changes question: it
    // stops asking "does the city meet demand once this is built" and starts
    // asking "does THIS BUILDING meet the whole city's demand". A 25-patient
    // clinic in a city with ample beds and one in a city with none rendered
    // identically, both as a shortfall.
    const { getCapacityForecast } = await import("../src/domain/buildingForecast.ts");

    const unknown = getCapacityForecast({ added: 25, current: null, demand: 380, unit: "patients" });
    const zero = getCapacityForecast({ added: 25, current: 0, demand: 380, unit: "patients" });

    assert.equal(unknown?.basis, "building");
    assert.equal(unknown?.projected, null);
    // A zero baseline is indistinguishable from "the binding has not reported
    // yet", so it takes the same cautious branch rather than being believed.
    assert.equal(zero?.basis, "building");
  });

  it("keeps the arithmetic it always had", async () => {
    // The basis is new information about an existing verdict, not a change to
    // it — a fix that quietly moved the numbers would be a different bug.
    const { getCapacityForecast } = await import("../src/domain/buildingForecast.ts");

    const short = getCapacityForecast({ added: 25, current: null, demand: 380, unit: "patients" });

    assert.equal(short?.shortfall, 355);
    assert.equal(short?.covers, false);
    assert.equal(short?.added, 25);
  });
});

describe("what the hover card is allowed to claim", () => {
  it("only claims a shortfall when the city was the baseline", async () => {
    // cm-7r5r, the UI half. The card renders a shortfall and a warning tone
    // from the forecast; both are honest only on the "city" basis. On the
    // "building" basis the number is the whole city's demand minus one
    // building, which is nearly always alarming and never informative.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../src/mods/BuildingHoverCard/BuildingHoverCard.tsx", import.meta.url),
        "utf8",
      ));

    assert.match(source, /capacityForecast\?\.basis === "city" && !capacityForecast\.covers/);
    assert.match(source, /tone: capacityForecast\?\.basis === "city"/);
  });
});
