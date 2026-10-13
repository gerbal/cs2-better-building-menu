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

  it("name nothing before C# has counted a menu, and never an empty one", () => {
    assert.deepEqual(menusOpeningOnAll(input({ shares: [] })), []);
    assert.deepEqual(menusOpeningOnAll(input({ shares: [share("Empty", 0)] })), []);
  });
});
