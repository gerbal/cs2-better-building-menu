import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANY_MILESTONE,
  isMilestoneSelected,
  milestoneTabs,
  shouldShowMilestoneTabs,
  schoolTierTabs,
  schoolTierLabel,
  romanNumeral,
  expandedTabsFor,
  branchTabLabel,
  branchTabTooltip,
} from "../src/domain/menuProgression.ts";
import { milestoneLabel, SCHOOL_TIERS } from "../src/domain/buildingGroups.ts";

const NAMES = ["Tiny Village", "Small Village", "Grand Village", "Large Village"];

// The labeller the strip passes. Its own rules — the fallback to a bare index,
// the gap in the table — are buildingGroups' and tested there; here it stands
// in for whatever the component injects.
const label = (milestone: number) => milestoneLabel(milestone, NAMES);

describe("menu progression strip", () => {
  it("names each tier out of the published milestone table", () => {
    const tabs = milestoneTabs(
      [
        { id: "0", count: 12, icon: "" },
        { id: "2", count: 4, icon: "" },
      ],
      label
    );

    assert.deepEqual(tabs, [
      { milestone: 0, label: "Tiny Village", count: 12, icon: "" },
      { milestone: 2, label: "Grand Village", count: 4, icon: "" },
    ]);
  });

  it("orders the tabs by milestone whatever order they arrive in", () => {
    // The index IS the progression, unlike the category strip where the order
    // is only for stability. A strip running 3, 0, 1 would misstate it.
    const tabs = milestoneTabs(
      [
        { id: "3", count: 1, icon: "" },
        { id: "0", count: 9, icon: "" },
        { id: "1", count: 5, icon: "" },
      ],
      label
    );

    assert.deepEqual(tabs.map((tab) => tab.milestone), [0, 1, 3]);
  });

  it("keeps a tier whose name has not arrived, under its index", () => {
    // The names and the counts are two bindings and land on separate frames.
    // Dropping the tab until the name arrives would make the strip flicker its
    // width on every menu change.
    const tabs = milestoneTabs([{ id: "5", count: 3, icon: "" }], (m) => milestoneLabel(m, []));

    assert.deepEqual(tabs, [{ milestone: 5, label: "Milestone 5", count: 3, icon: "" }]);
  });

  it("drops entries the backend could not place in the progression", () => {
    const tabs = milestoneTabs(
      [
        { id: "-1", count: 2, icon: "" },
        { id: "1", count: 3, icon: "" },
      ],
      label
    );

    assert.deepEqual(tabs.map((tab) => tab.milestone), [1]);
  });

  it("survives a missing binding", () => {
    assert.deepEqual(milestoneTabs(null, label), []);
    assert.deepEqual(milestoneTabs(undefined, label), []);
  });

  it("hides a strip that offers one tier or none", () => {
    // Same rule the category strip follows, and it bites harder here: every
    // menu has a progression axis, and the small ones sit entirely in one tier.
    assert.equal(shouldShowMilestoneTabs([]), false);
    assert.equal(shouldShowMilestoneTabs(milestoneTabs([{ id: "0", count: 8, icon: "" }], label)), false);
    assert.equal(
      shouldShowMilestoneTabs(
        milestoneTabs([{ id: "0", count: 8, icon: "" }, { id: "1", count: 2, icon: "" }], label)
      ),
      true
    );
    assert.equal(shouldShowMilestoneTabs(null), false);
  });

  it("treats no selection as the all-tiers tab", () => {
    assert.equal(isMilestoneSelected(ANY_MILESTONE, null), true);
    assert.equal(isMilestoneSelected(ANY_MILESTONE, undefined), true);
    assert.equal(isMilestoneSelected(ANY_MILESTONE, ANY_MILESTONE), true);
    assert.equal(isMilestoneSelected(0, null), false);
    assert.equal(isMilestoneSelected(0, 0), true);
    assert.equal(isMilestoneSelected(0, 1), false);
    // 0 is a real tier, and the sentinel is -1 precisely so the two are not
    // the same value read two ways.
    assert.equal(isMilestoneSelected(ANY_MILESTONE, 0), false);
  });
});

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

  it("uses the same words as the grouping dimension", () => {
    // Two copies of the game's SchoolLevel wording, one per domain module,
    // because the modules deliberately do not import each other by value.
    // This is what stops them drifting.
    for (const tier of SCHOOL_TIERS) {
      assert.equal(schoolTierLabel(tier.level), tier.label);
    }
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

  it("has a rank for every tier it can draw", () => {
    // The tabs come from SCHOOL_TIERS; a tier with no numeral would draw a
    // blank chip over the mortarboard.
    for (const tier of SCHOOL_TIERS) {
      assert.match(romanNumeral(tier.level), /^[IV]+$/);
    }
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

describe("branchTabLabel", () => {
  it("shows the label, not the composite id it matches on", () => {
    // The id carries the family so a tier tab cannot narrow to all three
    // families at once. The player must never see that machinery.
    assert.equal(
      branchTabLabel({ id: "ZonesResidential\u001fLow Density", count: 22, icon: "", label: "Low Density" }),
      "Low Density"
    );
  });

  it("falls back to the id for a development branch, which has no label", () => {
    assert.equal(branchTabLabel({ id: "Roundabouts", count: 38, icon: "" }), "Roundabouts");
    assert.equal(branchTabLabel({ id: "Roundabouts", count: 38, icon: "", label: "  " }), "Roundabouts");
  });

  it("survives a missing tab", () => {
    assert.equal(branchTabLabel(null), "");
    assert.equal(branchTabLabel(undefined), "");
  });
});

describe("branchTabTooltip", () => {
  const density = { id: "ZonesResidential\u001fLow Density", count: 15, icon: "", label: "Low Density" };
  const branch = { id: "Roundabouts", count: 38, icon: "" };

  it("names the zoning type as well as the density", () => {
    // The tab is drawn in its family's place and carries only an icon and a
    // count, so the family appears nowhere else on the strip. Reported from
    // play: the tooltips "state only the density and are missing the zoning
    // type".
    assert.equal(branchTabTooltip(density, "Residential Zones"), "Low Density Residential Zones");
  });

  it("leaves a development branch alone", () => {
    // "Roundabouts Small Roads" would repeat what the branch already says.
    assert.equal(branchTabTooltip(branch, "Small Roads"), "Roundabouts");
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
