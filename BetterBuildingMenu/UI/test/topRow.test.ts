import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cutToWidth, enterTarget, planField, searchPlaceholder } from "../src/domain/topRow.ts";
import { textWidth } from "../src/domain/tabRow.ts";

const FONT = 11;
const TEMPLATE = "Search {0}";

describe("the search field's placeholder", () => {
  it("names the menu it searches", () => {
    assert.equal(searchPlaceholder(TEMPLATE, "Search...", "Roads & Networks", 500, FONT), "Search Roads & Networks");
  });

  it("falls back to the menu's first word, then to the word alone, as the field narrows", () => {
    const whole = textWidth("Search Parks & Recreation", FONT);
    const first = textWidth("Search Parks", FONT);

    assert.equal(searchPlaceholder(TEMPLATE, "Search...", "Parks & Recreation", whole - 1, FONT), "Search Parks");
    assert.equal(searchPlaceholder(TEMPLATE, "Search...", "Parks & Recreation", first - 1, FONT), "Search");
  });

  it("says the word alone while no menu is open", () => {
    assert.equal(searchPlaceholder(TEMPLATE, "Search...", "", 500, FONT), "Search");
  });

  it("is the game's own word in a language with no string of ours", () => {
    assert.equal(searchPlaceholder(null, "Suchen…", "Straßen", 500, FONT), "Suchen…");
  });
});

describe("a text cut to its room", () => {
  it("is whole where it fits", () => {
    assert.equal(cutToWidth("Four-Lane Road 2", 500, FONT), "Four-Lane Road 2");
  });

  it("ends on one mark where it does not, and is nothing where not a character fits", () => {
    assert.equal(cutToWidth("Four-Lane Road 2", textWidth("Four-Lane…", FONT), FONT), "Four-Lane…");
    assert.equal(cutToWidth("Four-Lane Road 2", 1, FONT), null);
  });
});

describe("what Enter arms", () => {
  const page = { searchText: "four", bestMatch: { id: 7, name: "Four-Lane Road 2", menu: "Roads", index: 0 }, allMatchesLocked: false };

  it("is the page's best match once the page answers the query in the box", () => {
    assert.deepEqual(enterTarget(page, " four "), { kind: "match", name: "Four-Lane Road 2" });
  });

  it("is nothing armable when every match is locked", () => {
    assert.deepEqual(enterTarget({ searchText: "cargo", bestMatch: null, allMatchesLocked: true }, "cargo"), { kind: "locked" });
  });

  it("is nothing without a query, or while the page still answers an older one", () => {
    assert.equal(enterTarget(page, ""), null);
    assert.equal(enterTarget(page, "four-l"), null);
    assert.equal(enterTarget(null, "four"), null);
  });
});

describe("the field's plan", () => {
  const rest = { field: 279, scale: 1, menuLabel: "Roads & Networks", template: TEMPLATE, gameFallback: "Search...", query: "", target: null };

  it("names its target whole while the query leaves it room", () => {
    assert.deepEqual(
      planField({ ...rest, query: "four", target: "Four-Lane Road 2" }),
      { placeholder: "Search Roads & Networks", target: "Four-Lane Road 2" }
    );
  });

  it("cuts its target to the room a long query leaves, and names none at rest", () => {
    const plan = planField({ ...rest, query: "four lane road with parking", target: "Four-Lane Road with Parking Lots" });

    assert.ok(plan.target !== null && plan.target.endsWith("…"), String(plan.target));
    assert.equal(planField(rest).target, null);
  });
});
