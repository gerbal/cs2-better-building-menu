import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrivedCount, cellsOf, planTabRow, readoutRange, tabRow, type TabRowInput } from "../src/domain/tabRow.ts";
import { NO_TIER_BRACKET } from "../src/domain/menuProgression.ts";

const ROADS_ICON = "Media/Game/Icons/Roads.svg";
const category = (id: string, icon = `Media/Game/Icons/${id}.svg`) => ({ id, name: id, icon, priority: 0 });

/** Roads as C# sends it: three tabs, Highways emptied by the filters, nothing picked. */
const roads = (over: Partial<TabRowInput> = {}): TabRowInput => ({
  menu: "Roads",
  menuIcon: ROADS_ICON,
  allLabel: "All",
  allCount: 64,
  categories: [category("SmallRoads"), category("MediumRoads"), category("Highways")],
  counts: [{ id: "SmallRoads", count: 30 }, { id: "MediumRoads", count: 34 }, { id: "Highways", count: 0 }],
  selectedCategory: "",
  expanded: [],
  stripTabs: [],
  selectedStripTabs: [],
  bracket: NO_TIER_BRACKET,
  selectedTier: -1,
  categoryLabel: (entry) => entry.name,
  indexing: false,
  ...over,
});

/** Each cell as kind:id:count, with lit, empty and named when they hold. */
const row = (input: TabRowInput): string[] =>
  cellsOf(tabRow(input).items).map((cell) =>
    [`${cell.kind}:${cell.id}:${cell.count}`, cell.lit && "lit", cell.empty && "empty", cell.named && "named"].filter(Boolean).join(":"));

/** Education with its four levels, the tab's 65 schools and Research beside it. */
const education = (over: Partial<TabRowInput> = {}): TabRowInput => roads({
  menu: "Education & Research",
  menuIcon: "Media/Game/Icons/EducationResearch.svg",
  allCount: 70,
  categories: [category("Education"), category("Research")],
  counts: [{ id: "Education", count: 65 }, { id: "Research", count: 5 }],
  bracket: {
    parentCategory: "Education",
    parentCount: 65,
    tiers: [
      { id: "1", count: 22, icon: "", label: "Elementary School" },
      { id: "2", count: 23, icon: "", label: "High School" },
      { id: "3", count: 11, icon: "", label: "College" },
      { id: "4", count: 9, icon: "", label: "University" },
    ],
  },
  ...over,
});

/** Health with two tabs, the first split into two branches the row draws in its place. */
const health = (over: Partial<TabRowInput> = {}): TabRowInput => roads({
  menu: "Health",
  categories: [category("Healthcare"), category("Deathcare")],
  counts: [{ id: "Healthcare", count: 9 }, { id: "Deathcare", count: 2 }],
  expanded: [{ categoryId: "Healthcare", tabs: [{ id: "Basic", count: 4, icon: "Basic.svg" }, { id: "Hospitals", count: 5, icon: "Hospitals.svg" }] }],
  allCount: 11,
  ...over,
});

describe("the tab row's cells", () => {
  it("start with All: the menu's icon over the menu's count, lit while nothing is picked", () => {
    const [all] = tabRow(roads()).items;

    assert.deepEqual(all, {
      key: "all", kind: "all", id: "", label: "All", icon: ROADS_ICON, count: 64, lit: true, empty: false, named: false,
    });
  });

  it("draw the game's tabs after All, in its order, each with its count", () => {
    assert.deepEqual(row(roads()), [
      "all::64:lit", "category:SmallRoads:30", "category:MediumRoads:34", "category:Highways:0:empty",
    ]);
  });

  it("keep a lit tab the filters empty where it was, lit and faint", () => {
    assert.deepEqual(row(roads({ selectedCategory: "Highways" })), [
      "all::64", "category:SmallRoads:30", "category:MediumRoads:34", "category:Highways:0:lit:empty",
    ]);
  });

  it("leave out a tab C# sent no count for", () => {
    const counts = [{ id: "SmallRoads", count: 30 }, { id: "MediumRoads", count: 34 }];

    assert.deepEqual(row(roads({ counts })), ["all::64:lit", "category:SmallRoads:30", "category:MediumRoads:34"]);
  });

  it("leave a tab's count blank, not a faint 0, until C# sends the counts", () => {
    assert.deepEqual(row(roads({ counts: [] })), [
      "all::64:lit", "category:SmallRoads:null", "category:MediumRoads:null", "category:Highways:null",
    ]);
  });

  it("name a tab whose picture is the menu's own or another tab's", () => {
    const categories = [category("SmallRoads", ROADS_ICON), category("Ship", "Ship.svg"), category("Ferry", "Ship.svg"), category("Highways")];
    const counts = categories.map((entry) => ({ id: entry.id, count: 1 }));
    const named = cellsOf(tabRow(roads({ categories, counts })).items).filter((cell) => cell.named).map((cell) => cell.id);

    assert.deepEqual(named, ["SmallRoads", "Ship", "Ferry"]);
  });

  it("draw All alone, by its name, while the menu is unscoped", () => {
    assert.deepEqual(row(roads({ menu: "" })), ["all::64:lit:named"]);
  });

  it("draw a one-category menu's strip, and light a strip tab instead of All", () => {
    const power = roads({
      menu: "Electricity",
      categories: [category("Electricity")],
      counts: [{ id: "Electricity", count: 17 }],
      stripTabs: [{ id: "Wind", count: 6, icon: "Wind.svg", label: "Wind" }, { id: "Gas", count: 0, icon: "Gas.svg", label: "Gas" }],
      selectedStripTabs: ["Gas"],
      allCount: 17,
    });

    assert.deepEqual(row(power), ["all::17", "branch:Wind:6", "branch:Gas:0:lit:empty"]);
  });

  it("draw a split category's branches in its place", () => {
    assert.deepEqual(row(health()), ["all::11:lit", "branch:Basic:4", "branch:Hospitals:5", "category:Deathcare:2"]);
  });

  it("draw a menu as its strip when C# counted one of its tabs, as C# does", () => {
    // Two tabs declared and one filled is a one-tab menu: C# sends its strip, and no count for
    // the tab the menu never fills.
    const power = roads({
      menu: "Electricity",
      categories: [category("Electricity"), category("Unfilled")],
      counts: [{ id: "Electricity", count: 17 }],
      stripTabs: [{ id: "Wind", count: 6, icon: "Wind.svg", label: "Wind" }, { id: "Gas", count: 11, icon: "Gas.svg", label: "Gas" }],
      allCount: 17,
    });

    assert.deepEqual(row(power), ["all::17:lit", "branch:Wind:6", "branch:Gas:11"]);
  });

  it("open Education's tab into its levels, worded, and light both for a level", () => {
    const view = tabRow(education({ selectedCategory: "Education", selectedTier: 2 }));
    const bracket = view.items[1];

    assert.equal(bracket.kind, "bracket");
    assert.deepEqual(row(education({ selectedCategory: "Education", selectedTier: 2 })), [
      "all::70", "tierParent:Education:65:lit", "tier:1:22:named", "tier:2:23:lit:named", "tier:3:11:named", "tier:4:9:named",
      "category:Research:5",
    ]);
    assert.equal(view.place, "High School");
  });

  it("draw one level as an ordinary tab", () => {
    const single = education({ bracket: { parentCategory: "Education", parentCount: 65, tiers: [{ id: "1", count: 65, icon: "", label: "Elementary School" }] } });

    assert.deepEqual(row(single), ["all::70:lit", "category:Education:65", "category:Research:5"]);
  });

  it("give the readout the lit cell's name, and All's while nothing narrower is lit", () => {
    assert.equal(tabRow(roads({ selectedCategory: "MediumRoads" })).place, "MediumRoads");
    assert.equal(tabRow(roads()).place, "All");
  });

  it("give the readout a category picked from the pane, which the row draws as its branches", () => {
    // No cell stands for the whole category, so none is lit, but the list is that category's.
    const view = tabRow(health({ selectedCategory: "Healthcare", categoryLabel: (entry) => `${entry.name} services` }));

    assert.ok(cellsOf(view.items).every((cell) => !cell.lit));
    assert.equal(view.place, "Healthcare services");
  });

  it("draw every count blank, and every declared tab, while the catalog is still being indexed", () => {
    // An index still being built has counted nothing yet: its counts are ones that have not
    // arrived, so no tab drops out or reads a faint 0 until it is done.
    const indexing = roads({
      counts: [{ id: "SmallRoads", count: 3 }],
      stripTabs: [],
      indexing: true,
    });

    assert.deepEqual(row(indexing), [
      "all::null:lit", "category:SmallRoads:null", "category:MediumRoads:null", "category:Highways:null",
    ]);
    assert.deepEqual(row(health({ indexing: true })), [
      "all::null:lit", "branch:Basic:null", "branch:Hospitals:null", "category:Deathcare:null",
    ]);
    assert.deepEqual(row(education({ indexing: true })).slice(1, 3), ["tierParent:Education:null", "tier:1:null:named"]);
  });
});

describe("the row at the first step", () => {
  /** All and nineteen tabs, the size of the Roads menu: three counts in the hundreds. */
  const nineteen = () => tabRow(roads({
    categories: Array.from({ length: 19 }, (_, index) => category(`Tab${index}`)),
    counts: Array.from({ length: 19 }, (_, index) => ({ id: `Tab${index}`, count: [183, 120, 410][index] ?? 12 + index })),
    allCount: 779,
  })).items;
  const readout = { place: "Medium Roads", range: "1–100 of 779" };
  const plain = (count: number) => String(count);

  it("keeps All and nineteen tabs on one line at 100% text, with the readout whole", () => {
    assert.deepEqual(planTabRow(nineteen(), readout, 706, 1, plain), { readout: "full", clipped: false });
  });

  it("keeps the readout's range alone from 110% text, where its two lines no longer fit the row", () => {
    assert.deepEqual(planTabRow(nineteen(), readout, 706, 1.1, plain), { readout: "range", clipped: false });
  });

  it("keeps the range at 130% and at 150% text, where the last tabs clip instead", () => {
    for (const scale of [1.3, 1.5]) {
      const plan = planTabRow(nineteen(), readout, 706, scale, plain);

      assert.deepEqual(plan, { readout: "range", clipped: true }, `at ${scale}`);
    }
  });

  it("cuts the row at the box's edge, never wrapping it, when the tabs do not fit", () => {
    const forty = tabRow(roads({
      categories: Array.from({ length: 40 }, (_, index) => category(`Tab${index}`)),
      counts: Array.from({ length: 40 }, (_, index) => ({ id: `Tab${index}`, count: 100 + index })),
    })).items;

    assert.deepEqual(planTabRow(forty, readout, 706, 1, plain), { readout: "range", clipped: true });
  });

  it("fits Education's plate and its four worded levels with the readout whole", () => {
    const levels = tabRow(education()).items;

    assert.deepEqual(planTabRow(levels, { place: "Elementary School", range: "1–22 of 22" }, 706, 1, plain), { readout: "full", clipped: false });
  });

  it("budgets a count that has not arrived as blank", () => {
    const blank = tabRow(roads({ counts: [], allCount: null })).items;

    assert.deepEqual(planTabRow(blank, readout, 706, 1, plain), { readout: "full", clipped: false });
  });
});

describe("the readout's range", () => {
  const plain = (count: number) => String(count);

  it("is the window the list holds, with the true total", () => {
    assert.equal(readoutRange(100, 779, "1–{0} of {1}", plain), "1–100 of 779");
    assert.equal(readoutRange(34, 34, "1–{0} of {1}", plain), "1–34 of 34");
  });

  it("is the total alone while nothing is loaded, or nothing matches", () => {
    assert.equal(readoutRange(0, 64, "1–{0} of {1}", plain), "64");
    assert.equal(readoutRange(0, 0, "1–{0} of {1}", plain), "0");
  });
});

describe("a count C# has not sent", () => {
  it("is the binding's negative initial value, which the row draws blank", () => {
    assert.equal(arrivedCount(-1), null);
    assert.equal(arrivedCount(undefined), null);
    assert.equal(arrivedCount(0), 0);
    assert.equal(arrivedCount(779), 779);
  });

  it("leaves the All cell's count blank, like every other", () => {
    assert.equal(cellsOf(tabRow(roads({ allCount: null })).items)[0].count, null);
  });
});
