import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MenuShare } from "../src/domain/bodyChoice";
import { menusOpeningOnAll, type OnAllInput } from "../src/domain/opensOnAll";

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

  it("count the slots All's labels take: a menu whose rows fit but whose rows and labels do not opens on its tab", () => {
    // 19 rows fit the list's 20; under two labels they take 21.
    const twoTabs = (groupRows: number[]) => input({ shares: [{ ...share("Two Tabs", 19), groupRows }] });

    assert.deepEqual(menusOpeningOnAll(twoTabs([])), ["Two Tabs"]);
    assert.deepEqual(menusOpeningOnAll(twoTabs([10, 9])), []);
    // The same in the tiles, which hold 20 at Tile size 64.
    assert.deepEqual(menusOpeningOnAll({ ...twoTabs([10, 9]), views: [{ menu: "Two Tabs", value: "tiles" }] }), []);
  });

  it("count a label on a line of its own as the whole line, under the Block labels knob's own line", () => {
    // 12 rows in two tabs: 14 slots in line, which the list grows to hold; on lines of their own, 4 lines
    // of labels and 4 of rows, past its 5.
    const twoTabs = (blockLabels: string) =>
      input({ shares: [{ ...share("Two Tabs", 12), groupRows: [6, 6] }], tuning: { listPlateHeight: 27.25, nameLines: 0, smallMenusGrow: true, blockLabels } });

    assert.deepEqual(menusOpeningOnAll(twoTabs("inline")), ["Two Tabs"]);
    assert.deepEqual(menusOpeningOnAll(twoTabs("ownLine")), []);
  });

  it("name nothing before C# has counted a menu, and never an empty one", () => {
    assert.deepEqual(menusOpeningOnAll(input({ shares: [] })), []);
    assert.deepEqual(menusOpeningOnAll(input({ shares: [share("Empty", 0)] })), []);
  });
});
