import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MenuShare } from "../src/domain/bodyChoice";
import { menusDrawingNoGroups, menusOpeningOnAll, type OnAllInput } from "../src/domain/opensOnAll";

const share = (menu: string, rows: number, costOrCapacity = rows): MenuShare => ({ menu, rows, costOrCapacity, capacity: costOrCapacity, locked: 0 });
const input = (over: Partial<OnAllInput> = {}): OnAllInput => ({
  shares: [share("Garbage Management", 7), share("Electricity", 17), share("Communications", 21), share("Areas", 3, 0), share("Zones", 96, 0)],
  views: [],
  defaultView: "auto",
  // The knobs as they ship.
  tuning: { listPlateHeight: 27.25, nameLines: 0, smallMenusGrow: true },
  tileSize: 64,
  atLargeText: "moreBuildings",
  ...over,
});

describe("the small menus, which open on All", () => {
  it("are the menus whose rows all fit one screen of their body at 100% text and the first Width step", () => {
    // The list holds 20 there, the tiles 20 at Tile size 64.
    assert.deepEqual(menusOpeningOnAll(input()), ["Areas", "Electricity", "Garbage Management"]);
  });

  it("follow each menu's body: Tile size 100 holds 6 a screen", () => {
    const views = [{ menu: "Electricity", value: "tiles" }, { menu: "Garbage Management", value: "tiles" }];

    assert.deepEqual(menusOpeningOnAll(input({ views, tileSize: 100 })), ["Areas"]);
  });

  it("leave out a menu whose view is Cards, which opens on All whatever its size", () => {
    assert.deepEqual(menusOpeningOnAll(input({ views: [{ menu: "Garbage Management", value: "cards" }] })), ["Areas", "Electricity"]);
    assert.deepEqual(menusOpeningOnAll(input({ defaultView: "cards" })), []);
  });

  it("count the slots All's labels take where they draw: a menu whose rows fit but whose rows and labels do not opens on its tab", () => {
    // 19 rows fit the list's 20; under two labels they take 21. The labels draw in the tiles, and in a
    // list that does not grow.
    const twoTabs = (groupRows: number[], over: Partial<OnAllInput> = {}) => input({ shares: [{ ...share("Two Tabs", 19), groupRows }], ...over });
    const tiles = { views: [{ menu: "Two Tabs", value: "tiles" }] };
    const noGrowth = { tuning: { listPlateHeight: 27.25, nameLines: 0, smallMenusGrow: false } };

    assert.deepEqual(menusOpeningOnAll(twoTabs([], noGrowth)), ["Two Tabs"]);
    assert.deepEqual(menusOpeningOnAll(twoTabs([10, 9], noGrowth)), []);
    // The same in the tiles, which hold 20 at Tile size 64.
    assert.deepEqual(menusOpeningOnAll(twoTabs([10, 9], tiles)), []);
  });

  it("count a label on a line of its own as the whole line, under the Block labels knob's own line", () => {
    // 12 rows in two tabs: 14 slots in line; on lines of their own, 4 lines of labels and 4 of rows,
    // past the list's 5.
    const twoTabs = (blockLabels: string) =>
      input({ shares: [{ ...share("Two Tabs", 12), groupRows: [6, 6] }], tuning: { listPlateHeight: 27.25, nameLines: 0, smallMenusGrow: false, blockLabels } });

    assert.deepEqual(menusOpeningOnAll(twoTabs("inline")), ["Two Tabs"]);
    assert.deepEqual(menusOpeningOnAll(twoTabs("ownLine")), []);
  });

  it("name nothing before C# has counted a menu, and never an empty one", () => {
    assert.deepEqual(menusOpeningOnAll(input({ shares: [] })), []);
    assert.deepEqual(menusOpeningOnAll(input({ shares: [share("Empty", 0)] })), []);
  });
});

describe("the small menus whose list draws no groups unless picked", () => {
  // Electricity's 17 rows under its 8 development branches take 25 slots, past the list's 20.
  const electricity = { ...share("Electricity", 17), groupRows: [10, 1, 1, 1, 1, 1, 1, 1] };

  it("are the small menus of one tab drawn as a list with Small menus grow on, whose labels then take no slot", () => {
    const branches = input({ shares: [share("Garbage Management", 7), electricity, share("Communications", 21), share("Areas", 3, 0)] });

    assert.deepEqual(menusDrawingNoGroups(branches), ["Electricity", "Garbage Management"]);
    assert.deepEqual(menusOpeningOnAll(branches), ["Areas", "Electricity", "Garbage Management"]);
  });

  it("leave out a small menu with tabs of its own, which keeps All's tab labels and counts their slots", () => {
    // 19 rows in two tabs: under their two labels 21 slots, past the list's 20, so it opens on its tab.
    const twoTabs = (tabs: number) => input({ shares: [{ ...share("Two Tabs", 19), groupRows: [10, 9], tabs }] });

    assert.deepEqual(menusDrawingNoGroups(twoTabs(2)), []);
    assert.deepEqual(menusOpeningOnAll(twoTabs(2)), []);
    // The same rows in one tab, under its development branches: no labels, and they fit.
    assert.deepEqual(menusDrawingNoGroups(twoTabs(1)), ["Two Tabs"]);
    assert.deepEqual(menusOpeningOnAll(twoTabs(1)), ["Two Tabs"]);
  });

  it("leave out a menu whose rows do not fit one screen", () => {
    assert.deepEqual(menusDrawingNoGroups(input({ shares: [share("Communications", 21), share("Zones", 96)] })), []);
  });

  it("leave out a small menu drawn as tiles, whose labels count", () => {
    const tiles = input({ shares: [electricity], views: [{ menu: "Electricity", value: "tiles" }] });

    assert.deepEqual(menusDrawingNoGroups(tiles), []);
    assert.deepEqual(menusOpeningOnAll(tiles), []);
  });

  it("leave out every menu with Small menus grow off, where the labels count again", () => {
    const off = input({ shares: [share("Garbage Management", 7), electricity], tuning: { listPlateHeight: 27.25, nameLines: 0, smallMenusGrow: false } });

    assert.deepEqual(menusDrawingNoGroups(off), []);
    assert.deepEqual(menusOpeningOnAll(off), ["Garbage Management"]);
  });
});
