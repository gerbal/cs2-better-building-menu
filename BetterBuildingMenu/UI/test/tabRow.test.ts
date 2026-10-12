import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cellsOf, fitIcon, SQUARE, tabRow, type TabRowInput } from "../src/domain/tabRow.ts";
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
    const health = roads({
      menu: "Health",
      categories: [category("Healthcare"), category("Deathcare")],
      counts: [{ id: "Healthcare", count: 9 }, { id: "Deathcare", count: 2 }],
      expanded: [{ categoryId: "Healthcare", tabs: [{ id: "Basic", count: 4, icon: "Basic.svg" }, { id: "Hospitals", count: 5, icon: "Hospitals.svg" }] }],
      allCount: 11,
    });

    assert.deepEqual(row(health), ["all::11:lit", "branch:Basic:4", "branch:Hospitals:5", "category:Deathcare:2"]);
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
});

describe("a tab's picture", () => {
  it("fills its slot by its long side, and stays square until its size is known", () => {
    const fit = fitIcon(890, 757);

    assert.equal(fit.width, 1);
    assert.ok(Math.abs(fit.height - 0.8506) < 0.0001, String(fit.height));
    assert.deepEqual(fitIcon(0, 0), SQUARE);
    assert.deepEqual(fitIcon(Number.NaN, 10), SQUARE);
  });
});
