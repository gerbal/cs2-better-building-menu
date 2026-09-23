import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_CATEGORIES_ID,
  isCategorySelected,
  orderedCategories,
  shouldShowCategoryStrip,
  type VanillaMenuCategory,
  categoryCount,
  visibleCategories,
} from "../src/domain/vanillaMenuCategories.ts";

const category = (id: string, priority = 0): VanillaMenuCategory => ({
  id,
  name: id,
  icon: `Media/Game/Icons/${id}.svg`,
  priority,
});

describe("category strip visibility", () => {
  it("hides the strip when the menu has no categories", () => {
    assert.equal(shouldShowCategoryStrip([], "Roads"), false);
    assert.equal(shouldShowCategoryStrip(null, "Roads"), false);
    assert.equal(shouldShowCategoryStrip(undefined, "Roads"), false);
  });

  it("hides the strip at exactly one category, as vanilla does", () => {
    // Water & Sewage and Zones each have exactly one, so this is not a corner
    // case — it fires on real menus.
    assert.equal(shouldShowCategoryStrip([category("Water")], "Water & Sewage"), false);
  });

  it("shows the strip from two categories up", () => {
    assert.equal(shouldShowCategoryStrip([category("Road"), category("Train")], "Roads"), true);
  });

  it("hides the strip while the lens is unscoped", () => {
    // All menus publishes every category of every menu — about seventy — and
    // the strip wrapped to four rows of icon-only tabs. The categories are
    // still the group headings there; the strip has nothing to add.
    assert.equal(shouldShowCategoryStrip([category("Road"), category("Train")], ""), false);
    assert.equal(shouldShowCategoryStrip([category("Road"), category("Train")], "   "), false);
    assert.equal(shouldShowCategoryStrip([category("Road"), category("Train")], undefined), false);
  });
});

describe("category order", () => {
  it("orders by the game's own priority", () => {
    const ordered = orderedCategories([
      category("Ship", 30),
      category("Road", 10),
      category("Train", 20),
    ]);

    assert.deepEqual(ordered.map((c) => c.id), ["Road", "Train", "Ship"]);
  });

  it("keeps incoming order among equal priorities, which default to zero", () => {
    const ordered = orderedCategories([category("B"), category("A"), category("C")]);

    assert.deepEqual(ordered.map((c) => c.id), ["B", "A", "C"]);
  });

  it("does not mutate the binding's array", () => {
    const input = [category("B", 2), category("A", 1)];
    orderedCategories(input);

    assert.deepEqual(input.map((c) => c.id), ["B", "A"]);
  });

  it("survives a null binding before the first publish", () => {
    assert.deepEqual(orderedCategories(null), []);
  });
});

describe("category selection", () => {
  it("treats the empty id as All, which is selected by default", () => {
    assert.equal(isCategorySelected(ALL_CATEGORIES_ID, ""), true);
    assert.equal(isCategorySelected(ALL_CATEGORIES_ID, null), true);
    assert.equal(isCategorySelected(ALL_CATEGORIES_ID, undefined), true);
  });

  it("selects the matching tab and nothing else", () => {
    assert.equal(isCategorySelected("TransportationRoad", "TransportationRoad"), true);
    assert.equal(isCategorySelected("TransportationTrain", "TransportationRoad"), false);
  });

  it("does not select All once a real category is chosen", () => {
    assert.equal(isCategorySelected(ALL_CATEGORIES_ID, "TransportationRoad"), false);
  });
});

describe("Menu category counts", () => {
  const counts = [
    { id: "Vegetation", count: 22 },
    { id: "Terraforming", count: 9 },
  ];

  it("reports a tab's own share", () => {
    assert.equal(categoryCount(counts, "Vegetation"), 22);
    assert.equal(categoryCount(counts, "Terraforming"), 9);
  });

  it("sums the tabs for All, which has no share of its own", () => {
    assert.equal(categoryCount(counts, ALL_CATEGORIES_ID), 31);
  });

  it("says nothing rather than zero when the count has not arrived", () => {
    // Null and 0 are different claims: 0 means the tab is genuinely empty,
    // nothing means the backend has not answered yet. Collapsing them flashes
    // "0" across the whole strip on every menu change.
    assert.equal(categoryCount([], "Vegetation"), null);
    assert.equal(categoryCount(null, "Vegetation"), null);
    assert.equal(categoryCount(undefined, ALL_CATEGORIES_ID), null);
  });

  it("distinguishes an absent count from a real zero", () => {
    assert.equal(categoryCount([{ id: "Pathways", count: 0 }], "Pathways"), 0);
    // Absent from a table that HAS arrived is zero, not unknown: the backend
    // only emits a group for a category with something in it, and picking a
    // progression tier empties most of them at once.
    assert.equal(categoryCount([{ id: "Pathways", count: 0 }], "Vegetation"), 0);
  });
});

describe("Which category tabs are worth drawing", () => {
  const tab = (id: string) => ({ id, name: id, icon: "", priority: 0 });

  it("drops the tabs with nothing behind them", () => {
    // Roads carries ten of these: tab list and membership come from two
    // different questions, and they disagree by exactly the extra networks.
    const categories = [tab("SmallRoads"), tab("Ship"), tab("PowerLines")];
    const counts = [{ id: "SmallRoads", count: 24 }];

    assert.deepEqual(
      visibleCategories(categories, counts).map((c) => c.id),
      ["SmallRoads"]
    );
  });

  it("keeps every tab until the counts arrive", () => {
    // Otherwise the strip collapses to nothing and springs back on every menu
    // change, which reads as a flicker rather than a filter.
    const categories = [tab("SmallRoads"), tab("Ship")];

    assert.deepEqual(visibleCategories(categories, []).map((c) => c.id), ["SmallRoads", "Ship"]);
    assert.deepEqual(visibleCategories(categories, null).map((c) => c.id), ["SmallRoads", "Ship"]);
  });

  it("keeps a tab the backend counted as zero only when it said nothing", () => {
    // An explicit 0 is an answer; absence from a populated table is too. Both
    // mean the tab is a dead end.
    const categories = [tab("A"), tab("B")];

    assert.deepEqual(
      visibleCategories(categories, [{ id: "A", count: 3 }, { id: "B", count: 0 }]).map((c) => c.id),
      ["A"]
    );
  });

  it("survives a missing category list", () => {
    assert.deepEqual(visibleCategories(null, [{ id: "A", count: 1 }]), []);
    assert.deepEqual(visibleCategories(undefined, null), []);
  });
});
