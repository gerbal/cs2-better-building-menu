import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { Button } from "../harness/stubs/cs2-ui";
import { ChipRow } from "../../src/mods/ChipRow/ChipRow";

// The translate stub answers every vanilla key with null, so a menu or a
// category reads as its raw id here.
const category = (id: string, priority: number) => ({ id, name: id, icon: `${id}.svg`, priority });

const seed = ({ menu = "Roads", menuCategory = "", categories = 2 } = {}) => {
  setBinding("BetterBuildingMenu", "BuildingLensMenu", menu);
  setBinding("BetterBuildingMenu", "BuildingLensMenuCategory", menuCategory);
  setBinding("BetterBuildingMenu", "BuildingLensMenuCategories", [category("Highways", 2), category("SmallRoads", 1)].slice(0, categories));
  setBinding("BetterBuildingMenu", "BuildingLensMenus", [category("Zones", 2), category("Roads", 1), category("Parks", 3)]);
};

const sent = () => triggers.map((call) => [call.name, ...call.args]);

describe("the chip row", () => {
  let root: ReactTestRenderer | undefined;

  const render = () => act(() => {
    root = create(<ChipRow />);
  });
  const buttons = (): ReactTestInstance[] => root!.root.findAllByType(Button);
  const button = (label: string): ReactTestInstance => {
    const found = buttons().filter((node) => node.props["aria-label"] === label);
    assert.equal(found.length, 1, `one button labelled ${label}; found ${buttons().map((node) => node.props["aria-label"]).join(", ")}`);
    return found[0];
  };
  const press = (label: string) => act(() => button(label).props.onSelect());
  const pickerItems = (): string[] =>
    buttons().filter((node) => node.props.className.startsWith("pickerItem")).map((node) => node.props["aria-label"]);
  const chosen = (): string[] =>
    buttons().filter((node) => node.props.className === "pickerItem pickerItemSelected").map((node) => node.props["aria-label"]);

  beforeEach(() => {
    resetBindings();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("names the scoped menu, and offers to drop it", () => {
    seed();
    render();

    button("Roads");
    press("Remove Roads");

    assert.deepEqual(sent(), [["ClearBuildingLensMenuScope"]]);
  });

  it("says All menus, with nothing to drop, when no menu is scoped", () => {
    seed({ menu: "" });
    render();

    button("All menus");
    assert.equal(buttons().filter((node) => node.props["aria-label"]?.startsWith("Remove")).length, 0);
  });

  it("draws the category chip only for a menu with more than one category", () => {
    seed({ categories: 1 });
    render();
    assert.equal(buttons().filter((node) => node.props["aria-label"] === "All").length, 0);

    act(() => root!.unmount());
    seed({ categories: 2 });
    render();
    button("All");
  });

  it("names the chosen category, and dropping it goes back to all of them", () => {
    seed({ menuCategory: "Highways" });
    render();

    press("Remove Highways");

    assert.deepEqual(sent(), [["SetBuildingLensMenuCategory", ""]]);
  });

  it("opens a menu picker in the game's order, the current menu marked, and closes it on a second press", () => {
    seed();
    render();
    assert.deepEqual(pickerItems(), [], "closed until pressed");

    // The index sends the menus in the bottom bar's order, toolbar group first,
    // so the picker keeps it rather than re-sorting by priority.
    press("Roads");
    assert.deepEqual(pickerItems(), ["Zones", "Roads", "Parks"]);
    assert.deepEqual(chosen(), ["Roads"]);

    // The chip and the picker item share a label; the chip is the first.
    act(() => buttons()[0].props.onSelect());
    assert.deepEqual(pickerItems(), []);
  });

  it("sends the menu picked, and closes the picker", () => {
    seed();
    render();

    press("Roads");
    act(() => buttons().find((node) => node.props["aria-label"] === "Parks")!.props.onSelect());

    assert.deepEqual(sent(), [["SetBuildingLensMenu", "Parks"]]);
    assert.deepEqual(pickerItems(), []);
  });

  it("picks a category from the category chip, not a menu", () => {
    seed({ menuCategory: "Highways" });
    render();

    press("Highways");
    assert.deepEqual(pickerItems(), ["SmallRoads", "Highways"]);
    assert.deepEqual(chosen(), ["Highways"]);

    act(() => buttons().find((node) => node.props["aria-label"] === "SmallRoads")!.props.onSelect());
    assert.deepEqual(sent(), [["SetBuildingLensMenuCategory", "SmallRoads"]]);
  });

  it("leaves out a category the strip hides for having nothing in it", () => {
    seed({ menuCategory: "Highways" });
    setBinding("BetterBuildingMenu", "BuildingLensMenuCategories", [
      category("Highways", 2), category("SmallRoads", 1), category("Roundabouts", 3),
    ]);
    setBinding("BetterBuildingMenu", "BuildingLensMenuCategoryCounts", [
      { id: "SmallRoads", count: 4 }, { id: "Highways", count: 2 }, { id: "Roundabouts", count: 0 },
    ]);
    render();

    press("Highways");
    assert.deepEqual(pickerItems(), ["SmallRoads", "Highways"]);
  });

  it("lists every category until the counts arrive", () => {
    seed({ menuCategory: "Highways" });
    setBinding("BetterBuildingMenu", "BuildingLensMenuCategoryCounts", []);
    render();

    press("Highways");
    assert.deepEqual(pickerItems(), ["SmallRoads", "Highways"]);
  });
});
