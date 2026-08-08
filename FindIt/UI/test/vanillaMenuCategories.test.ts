import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_CATEGORIES_ID,
  isCategorySelected,
  orderedCategories,
  shouldShowCategoryStrip,
  type VanillaMenuCategory,
} from "../src/domain/vanillaMenuCategories.ts";

const category = (id: string, priority = 0): VanillaMenuCategory => ({
  id,
  name: id,
  icon: `Media/Game/Icons/${id}.svg`,
  priority,
});

describe("category strip visibility", () => {
  it("hides the strip when the menu has no categories", () => {
    assert.equal(shouldShowCategoryStrip([]), false);
    assert.equal(shouldShowCategoryStrip(null), false);
    assert.equal(shouldShowCategoryStrip(undefined), false);
  });

  it("hides the strip at exactly one category, as vanilla does", () => {
    // Water & Sewage and Zones each have exactly one, so this is not a corner
    // case — it fires on real menus.
    assert.equal(shouldShowCategoryStrip([category("Water")]), false);
  });

  it("shows the strip from two categories up", () => {
    assert.equal(shouldShowCategoryStrip([category("Road"), category("Train")]), true);
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
