import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_FORECAST_BINDINGS,
  getServiceForecastKey,
} from "../src/domain/serviceForecast.ts";

const entry = (
  subCategory: string,
  name = "Something",
  educationLevel?: number,
  buildingType?: string
) => ({ subCategory, name, educationLevel, buildingType });

describe("Service forecast mapping", () => {
  it("routes a building by the component it carries, not its name", () => {
    // Find It classifies by component query, and the indexer already derives
    // these roles. Matching a display name was reading the label off the box.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "x", undefined, "Hospital"))!.key, "patients");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Garbage", "x", undefined, "GarbageFacility"))!.key, "garbage");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "x", undefined, "WaterPumpingStation"))!.key, "water");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Electricity", "x", undefined, "PowerPlant"))!.key, "electricity");
  });

  it("separates deathcare from healthcare, which share a subcategory", () => {
    // Health & Deathcare is one subcategory but two demand series: patients
    // against the sick, and cemetery places against burials.
    // DeathcareFacilityData is what makes the difference, not the word
    // "Cemetery" in a name.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "x", undefined, "DeathcareFacility"))!.key, "cemetery");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "x", undefined, "Hospital"))!.key, "patients");
  });

  it("separates sewage from fresh water, which also share one", () => {
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "x", undefined, "WastewaterTreatmentPlant"))!.key, "sewage");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "x", undefined, "SewageOutlet"))!.key, "sewage");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "x", undefined, "WaterPumpingStation"))!.key, "water");
  });

  it("sees a modded or localized name the old matcher could not", () => {
    // The whole point. "Friedhof" carries DeathcareFacilityData just as
    // "Cemetery" does, and a substring match on English never saw it.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "Friedhof", undefined, "DeathcareFacility"))!.key, "cemetery");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "Klaerwerk", undefined, "WastewaterTreatmentPlant"))!.key, "sewage");
  });

  it("reads the education tier from the prefab's own data when present", () => {
    // SchoolData.m_EducationLevel is the tier the school grants, and the game
    // switches on exactly these values: 1 elementary, 2 high school,
    // 3 college, 4 university. Data beats guessing at the name.
    const sub = "ServiceBuildings_EducationResearch";

    assert.equal(getServiceForecastKey(entry(sub, "Akademie", 1))!.key, "elementary");
    assert.equal(getServiceForecastKey(entry(sub, "Akademie", 2))!.key, "highSchool");
    assert.equal(getServiceForecastKey(entry(sub, "Akademie", 3))!.key, "college");
    assert.equal(getServiceForecastKey(entry(sub, "Akademie", 4))!.key, "university");
  });

  it("prefers the data over a name that disagrees with it", () => {
    // A "High School" prefab granting level 3 is a college by the game's own
    // reckoning, and the demand series should follow the simulation.
    assert.equal(
      getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "High School", 3))!.key,
      "college"
    );
  });

  it("ignores an education level outside the tiers the game switches on", () => {
    // 0 and 5 exist in the enum but are not schools the infoview counts.
    const sub = "ServiceBuildings_EducationResearch";

    assert.equal(getServiceForecastKey(entry(sub, "Radio Telescope", 0)), null);
    assert.equal(getServiceForecastKey(entry(sub, "Radio Telescope", 5)), null);
  });

  it("declines an education building carrying no tier, whatever it is called", () => {
    // Research facilities have no SchoolData and so no level. Measured on a
    // real catalog: 40 of 44 education buildings carry a level, and the four
    // without are Geological Research Center, Large Hadron Collider, Practice
    // Clinic and Radio Telescope — none of which teach anyone.
    //
    // The name is deliberately not consulted: a name that looks like a school
    // but carries no SchoolData has no student capacity to forecast from.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Radio Telescope")), null);
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Elementary School")), null);
  });

  it("routes prisons to the prison series rather than police coverage", () => {
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Police", "x", undefined, "Prison"))!.key, "prison");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Police", "x", undefined, "PoliceStation")), null);
  });

  it("declines a building with no service component at all", () => {
    // No role means nothing to forecast: parks, props and zoned buildings.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Parks", "Bronze Statue")), null);
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "Something")), null);
  });

  it("declines a role this build has no series for", () => {
    // Coverage services report no capacity against a demand figure.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Fire", "x", undefined, "FireStation")), null);
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Misc", "x", undefined, "SomeNewService")), null);
  });

  it("declines anything that is not a service building", () => {
    assert.equal(getServiceForecastKey(entry("Buildings_Residential", "House")), null);
    assert.equal(getServiceForecastKey(entry("", "")), null);
  });

  it("names a binding pair for every key it can return", () => {
    // A key with no binding pair would silently forecast nothing.
    const keys = [
      "elementary", "highSchool", "college", "university",
      "patients", "cemetery", "garbage", "water", "sewage", "electricity", "prison",
    ];

    for (const key of keys) {
      assert.ok(SERVICE_FORECAST_BINDINGS[key], `missing bindings for ${key}`);
      assert.ok(SERVICE_FORECAST_BINDINGS[key].group);
      assert.ok(SERVICE_FORECAST_BINDINGS[key].capacity);
      assert.ok(SERVICE_FORECAST_BINDINGS[key].demand);
      assert.ok(SERVICE_FORECAST_BINDINGS[key].unit);
    }
  });
});
