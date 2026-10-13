import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTROLS_MARK,
  POPOVER_MARK,
  controlLeftRem,
  cutToWidth,
  enterTarget,
  fieldNeeds,
  isWithin,
  planControls,
  planField,
  popoverLeft,
  searchPlaceholder,
  toggleList,
  type ControlCell,
  type ControlKind,
} from "../src/domain/topRow.ts";
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

describe("the controls' plan", () => {
  /** Four controls as a menu has them at rest: its sorts and groupings, no filter on, the view. */
  const cells = (over: Partial<Record<ControlKind, Partial<ControlCell>>> = {}): ControlCell[] => [
    { kind: "sort", word: "Sort", value: "Default", values: ["Default", "Name", "Cost", "Upkeep"], changed: false, ...over.sort },
    { kind: "filter", word: "Filter", value: "None", values: ["None", "99 on"], changed: false, ...over.filter },
    { kind: "group", word: "Group", value: "By tab", values: ["By tab", "No groups", "Asset type"], changed: false, ...over.group },
    { kind: "view", word: "View", value: "Cards", values: ["Cards", "List", "Grid", "Table"], changed: false, ...over.view },
  ];
  // The first step's row less close: 698 inside the box, less 24 and its 4.
  const ROW = 670;

  it("shows the words at 100% text, with the field well past its floor", () => {
    const plan = planControls({ row: ROW, scale: 1, cells: cells(), fieldNeeds: 0 });

    assert.equal(plan.form, "words");
    assert.ok(plan.field >= 220, `the field keeps ${plan.field}`);
  });

  it("folds to a glyph and the value from 110%, at every text size the game offers, and keeps the field its floor", () => {
    for (const scale of [1.1, 1.2, 1.3, 1.4, 1.5]) {
      const plan = planControls({ row: ROW, scale, cells: cells(), fieldNeeds: 0 });

      assert.equal(plan.form, "glyphs", String(scale));
      assert.ok(plan.field >= 150, `${scale}: the field keeps ${plan.field}`);
    }
  });

  it("sizes each value's slot to the widest it can show, so a pick never moves the strip", () => {
    const atRest = planControls({ row: ROW, scale: 1, cells: cells(), fieldNeeds: 0 });
    const picked = planControls({ row: ROW, scale: 1, cells: cells({ sort: { value: "Upkeep", changed: true }, group: { value: "Asset type" } }), fieldNeeds: 0 });

    assert.deepEqual(picked.slots, atRest.slots);
    assert.equal(picked.field, atRest.field);
  });

  it("folds at 100% only to keep the field its floor, even with a menu's long sorts", () => {
    const water = cells({ sort: { values: ["Default", "Water capacity", "Sewage capacity", "Households"] } });
    const narrow = planControls({ row: 520, scale: 1, cells: water, fieldNeeds: 0 });

    assert.equal(planControls({ row: ROW, scale: 1, cells: water, fieldNeeds: 0 }).form, "words");
    assert.equal(narrow.form, "glyphs");
    assert.ok(narrow.field >= 150, `the field keeps ${narrow.field}`);
  });

  it("folds while a typed query's Enter target would not fit whole beside the words", () => {
    const needs = fieldNeeds("four lane", "Four-Lane Road with Parking Lots", 1);

    assert.equal(planControls({ row: ROW, scale: 1, cells: cells(), fieldNeeds: 0 }).form, "words");
    assert.equal(planControls({ row: ROW, scale: 1, cells: cells(), fieldNeeds: needs }).form, "glyphs");
  });

  it("asks nothing past the field's floor without a query and a target", () => {
    assert.equal(fieldNeeds("", "Four-Lane Road 2", 1), 0);
    assert.equal(fieldNeeds("four", null, 1), 0);
  });
});

describe("a press inside a popover or the controls", () => {
  const node = (attributes: Record<string, string>, parentElement: unknown = null) => ({
    getAttribute: (name: string) => attributes[name] ?? null,
    parentElement,
  });

  it("is placed by a marked ancestor", () => {
    const row = node({}, node({}, node({ [POPOVER_MARK]: "true" })));

    assert.equal(isWithin(row, POPOVER_MARK), true);
    assert.equal(isWithin(row, CONTROLS_MARK), false);
  });

  it("is outside both for the map, the page or nothing", () => {
    assert.equal(isWithin(node({}, node({})), POPOVER_MARK), false);
    assert.equal(isWithin(null, CONTROLS_MARK), false);
  });
});

describe("a popover's place", () => {
  it("sits under its control, pulled left to end at the limit", () => {
    assert.equal(popoverLeft(320, 706), 320);
    assert.equal(popoverLeft(600, 706), 466);
  });

  it("ends at the limit when its control could not be measured, and never starts left of the box", () => {
    assert.equal(popoverLeft(null, 706), 466);
    assert.equal(popoverLeft(null, 200), 0);
  });

  it("reads a control's left edge in the box from the drawn pixels", () => {
    // At 720p a rem is two thirds of a pixel.
    assert.equal(controlLeftRem(500, 300, 720), 300);
    assert.equal(controlLeftRem(undefined, 300, 720), null);
  });
});

describe("the one open list", () => {
  const sortHere = { home: "popover", kind: "sort", left: 40 } as const;
  const sortInThePane = { home: "pane", kind: "sort" } as const;

  it("opens on a press, and a second press on the same control closes it", () => {
    assert.deepEqual(toggleList(null, sortHere), sortHere);
    assert.equal(toggleList(sortHere, { ...sortHere, left: 52 }), null);
    assert.equal(toggleList(sortInThePane, sortInThePane), null);
  });

  it("switches to another control's list, in the same home or the other, never stacking two", () => {
    assert.deepEqual(toggleList(sortHere, { home: "popover", kind: "group", left: 90 }), { home: "popover", kind: "group", left: 90 });
    assert.deepEqual(toggleList(sortHere, sortInThePane), sortInThePane);
    assert.deepEqual(toggleList(sortInThePane, sortHere), sortHere);
  });
});
