import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_FORECAST_BINDINGS,
  getServiceForecastKey,
} from "../src/domain/serviceForecast.ts";

const entry = (subCategory: string, name = "Something") => ({ subCategory, name });

describe("Service forecast mapping", () => {
  it("routes each service subcategory to its own capacity and demand pair", () => {
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "Hospital"))!.key, "patients");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Garbage"))!.key, "garbage");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "Water Tower"))!.key, "water");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Electricity"))!.key, "electricity");
  });

  it("separates deathcare from healthcare, which share a subcategory", () => {
    // Health & Deathcare is one subcategory but two demand series: patients
    // against the sick, and cemetery places against burials.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "Cemetery"))!.key, "cemetery");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "Crematorium"))!.key, "cemetery");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Health", "Medical Clinic"))!.key, "patients");
  });

  it("separates sewage from fresh water, which also share one", () => {
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "Wastewater Treatment Plant"))!.key, "sewage");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "Sewage Outlet"))!.key, "sewage");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Water", "Groundwater Pumping Station"))!.key, "water");
  });

  it("picks the education tier the building actually serves", () => {
    // One "students" unit covers four separate demand series. The tier is only
    // discoverable from the name, so this is a heuristic and says so.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Elementary School"))!.key, "elementary");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "High School"))!.key, "highSchool");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Community College"))!.key, "college");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Medical University"))!.key, "university");
  });

  it("prefers the more specific education tier when names overlap", () => {
    // "High School" contains "School"; elementary must not swallow it.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Urban High School"))!.key, "highSchool");
  });

  it("declines an education building with no recognisable tier", () => {
    // Research institutes and labs teach nobody; a forecast against student
    // demand would be nonsense.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_EducationResearch", "Radio Telescope")), null);
  });

  it("declines services with no meaningful demand series", () => {
    // Parks, police stations and fire houses have coverage, not a capacity
    // the game reports against a demand figure.
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Parks", "Bronze Statue")), null);
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Fire", "Fire Station")), null);
  });

  it("routes prisons to the prison series rather than police coverage", () => {
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Police", "Prison"))!.key, "prison");
    assert.equal(getServiceForecastKey(entry("ServiceBuildings_Police", "Police Station")), null);
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
