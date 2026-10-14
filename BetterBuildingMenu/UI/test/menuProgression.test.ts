import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  schoolTierTabs,
  romanNumeral,
  expandedTabsFor,
  branchTabTooltip,
} from "../src/domain/menuProgression.ts";

describe("education tier tabs", () => {
  it("orders the levels by career, which the alphabet gets wrong", () => {
    // College sorts before High School and before University; only one of
    // those is the order a player thinks in.
    const tabs = schoolTierTabs([
      { id: "3", count: 5, icon: "" },
      { id: "1", count: 12, icon: "" },
      { id: "4", count: 2, icon: "" },
      { id: "2", count: 8, icon: "" },
    ]);

    assert.deepEqual(tabs.map((t) => t.label), [
      "Elementary School",
      "High School",
      "College",
      "University",
    ]);
    assert.deepEqual(tabs.map((t) => t.count), [12, 8, 5, 2]);
  });

  it("says the game's name for each level, which C# sends as the label", () => {
    // In German the base-game schools are the level's names; the English
    // words were drawn in every language before (#67).
    const tabs = schoolTierTabs([
      { id: "2", count: 8, icon: "", label: "Gymnasium" },
      { id: "1", count: 12, icon: "", label: " Grundschule " },
    ]);

    assert.deepEqual(tabs.map((t) => t.label), ["Grundschule", "Gymnasium"]);
  });

  it("falls back to English for a tab C# sent no label for", () => {
    // An empty label reaches the UI as the id (MenuBranchCount.DisplayLabel),
    // and a "2" on the tab would read as a count.
    const tabs = schoolTierTabs([
      { id: "1", count: 12, icon: "", label: "1" },
      { id: "2", count: 8, icon: "", label: "" },
      { id: "3", count: 5, icon: "" },
    ]);

    assert.deepEqual(tabs.map((t) => t.label), ["Elementary School", "High School", "College"]);
  });

  it("drops the levels that are not tiers", () => {
    // 0 is a capacity upgrade with no tier of its own and 5 is the outside
    // connection. The backend already filters them; this is the second wall.
    const tabs = schoolTierTabs([
      { id: "0", count: 3, icon: "" },
      { id: "2", count: 8, icon: "" },
    ]);

    assert.deepEqual(tabs.map((t) => t.level), [2]);
  });

  it("survives a missing binding", () => {
    assert.deepEqual(schoolTierTabs(null), []);
    assert.deepEqual(schoolTierTabs(undefined), []);
  });
});

describe("school level rank", () => {
  it("numbers the four levels in roman", () => {
    // Roman, because the arabic numeral would be read as a count — every other
    // number on that row is one, including the badge in the opposite corner of
    // the same tab.
    assert.deepEqual([1, 2, 3, 4].map(romanNumeral), ["I", "II", "III", "IV"]);
  });

  it("falls back to the plain number outside the game's range", () => {
    // Four levels is the whole range SchoolLevel has, so this is not a general
    // converter and does not pretend to be one.
    assert.equal(romanNumeral(0), "0");
    assert.equal(romanNumeral(5), "5");
  });
});

describe("expandedTabsFor", () => {
  const categories = [
    { categoryId: "ZonesResidential", tabs: [{ id: "ZonesResidential\u001fLow Density", count: 22, icon: "a.svg", label: "Low Density" }] },
    { categoryId: "ZonesCommercial", tabs: [{ id: "ZonesCommercial\u001fLow Density", count: 7, icon: "a.svg", label: "Low Density" }] },
  ];

  it("finds a category's own tabs", () => {
    assert.equal(expandedTabsFor(categories, "ZonesCommercial")[0].count, 7);
  });

  it("returns nothing for a category that is not expanded", () => {
    // Industrial has one untiered zone, so the backend sends no tabs for it
    // and the category draws itself.
    assert.deepEqual(expandedTabsFor(categories, "ZonesIndustrial"), []);
  });

  it("survives a missing binding", () => {
    assert.deepEqual(expandedTabsFor(null, "ZonesResidential"), []);
    assert.deepEqual(expandedTabsFor(undefined, "ZonesResidential"), []);
  });
});

describe("branchTabTooltip", () => {
  const density = { id: "ZonesResidential\u001fLow Density", count: 15, icon: "", label: "Low Density" };
  const branch = { id: "Roundabouts", count: 38, icon: "" };

  it("names the zoning type as well as the density", () => {
    // The tab is drawn in its family's place and carries only an icon and a
    // count, so the family appears nowhere else on the strip — the tooltip
    // has to state the zoning type as well as the density.
    assert.equal(branchTabTooltip(density, "Residential Zones"), "Low Density Residential Zones");
  });

  it("leaves a development branch alone", () => {
    // "Roundabouts Small Roads" would repeat what the branch already says.
    assert.equal(branchTabTooltip(branch, "Small Roads"), "Roundabouts");
  });

  it("leaves a branch alone as C# sends it, its id standing in for a label", () => {
    // MenuBranchCount writes DisplayLabel, so a branch with no label arrives
    // labelled with its own id; "Prison Police" names no density tier.
    assert.equal(branchTabTooltip({ ...branch, id: "Prison", label: "Prison" }, "Police"), "Prison");
  });

  it("falls back to the tier when the category has no label", () => {
    assert.equal(branchTabTooltip(density, ""), "Low Density");
    assert.equal(branchTabTooltip(density, null), "Low Density");
    assert.equal(branchTabTooltip(density, undefined), "Low Density");
  });

  it("survives a missing tab", () => {
    assert.equal(branchTabTooltip(null, "Residential Zones"), "");
    assert.equal(branchTabTooltip(undefined, "Residential Zones"), "");
  });
});
