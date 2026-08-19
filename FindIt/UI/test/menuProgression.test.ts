import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANY_MILESTONE,
  isMilestoneSelected,
  milestoneTabs,
  shouldShowMilestoneTabs,
} from "../src/domain/menuProgression.ts";
import { milestoneLabel } from "../src/domain/buildingGroups.ts";

const NAMES = ["Tiny Village", "Small Village", "Grand Village", "Large Village"];

// The labeller the strip passes. Its own rules — the fallback to a bare index,
// the gap in the table — are buildingGroups' and tested there; here it stands
// in for whatever the component injects.
const label = (milestone: number) => milestoneLabel(milestone, NAMES);

describe("menu progression strip", () => {
  it("names each tier out of the published milestone table", () => {
    const tabs = milestoneTabs(
      [
        { milestone: 0, count: 12 },
        { milestone: 2, count: 4 },
      ],
      label
    );

    assert.deepEqual(tabs, [
      { milestone: 0, label: "Tiny Village", count: 12 },
      { milestone: 2, label: "Grand Village", count: 4 },
    ]);
  });

  it("orders the tabs by milestone whatever order they arrive in", () => {
    // The index IS the progression, unlike the category strip where the order
    // is only for stability. A strip running 3, 0, 1 would misstate it.
    const tabs = milestoneTabs(
      [
        { milestone: 3, count: 1 },
        { milestone: 0, count: 9 },
        { milestone: 1, count: 5 },
      ],
      label
    );

    assert.deepEqual(tabs.map((tab) => tab.milestone), [0, 1, 3]);
  });

  it("keeps a tier whose name has not arrived, under its index", () => {
    // The names and the counts are two bindings and land on separate frames.
    // Dropping the tab until the name arrives would make the strip flicker its
    // width on every menu change.
    const tabs = milestoneTabs([{ milestone: 5, count: 3 }], (m) => milestoneLabel(m, []));

    assert.deepEqual(tabs, [{ milestone: 5, label: "Milestone 5", count: 3 }]);
  });

  it("drops entries the backend could not place in the progression", () => {
    const tabs = milestoneTabs(
      [
        { milestone: -1, count: 2 },
        { milestone: 1, count: 3 },
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
    assert.equal(shouldShowMilestoneTabs(milestoneTabs([{ milestone: 0, count: 8 }], label)), false);
    assert.equal(
      shouldShowMilestoneTabs(
        milestoneTabs([{ milestone: 0, count: 8 }, { milestone: 1, count: 2 }], label)
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
