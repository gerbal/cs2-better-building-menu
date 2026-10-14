import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml, entry, catalogPage, count } from "../harness/render";
import { setBinding, resetBindings, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { GROUP_DIMENSIONS } from "../../src/domain/buildingGroups";
import { toggleList, type OpenList } from "../../src/domain/topRow";
import { ControlPane } from "../../src/mods/ControlPane/ControlPane";
import { FilterPanel } from "../../src/mods/Pickers/FilterPanel";
import { GroupList } from "../../src/mods/Pickers/GroupList";
import { SortList } from "../../src/mods/Pickers/SortList";
import { ViewList } from "../../src/mods/Pickers/ViewList";

const facets = (selected: boolean) => ({
  groups: [{ id: "role", label: "Role", options: [{ id: "Hospital", label: "Hospital", selected }] }],
  hasSelection: selected,
});

const seed = (menu = "Roads") => {
  setBinding("BetterBuildingMenu", "AssetMenu", menu);
  setBinding("BetterBuildingMenu", "BuildingCatalogGroupBy", "menuCategory");
  setBinding("BetterBuildingMenu", "AssetMenuGroupDimensions", GROUP_DIMENSIONS.map((d) => d.id));
  setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Name");
  setBinding("BetterBuildingMenu", "BuildingCatalogSortDescending", false);
  setBinding("BetterBuildingMenu", "CurrentSearch", "");
  setBinding("BetterBuildingMenu", "AssetMenuFacets", facets(false));
  setBinding("BetterBuildingMenu", "BuildingCatalogMetricRanges", null);
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], { reorderableSortColumns: ["Name", "ConstructionCost"] }));
};

// The pane as the box holds it: the one open list, which the box shares with the top row.
const Pane = () => {
  const [open, setOpen] = useState<OpenList | null>(null);

  return (
    <ControlPane
      open={open?.home === "pane" ? open.kind : null}
      onToggle={(kind) => setOpen((current) => toggleList(current, { home: "pane", kind }))}
      onClose={() => setOpen(null)}
    />
  );
};

const render = () => renderHtml(<Pane />);
// The labels the pane draws, with the menu's own name factored out so two menus can be compared.
const ariaLabels = (html: string, menu: string): string[] =>
  (html.match(/aria-label="[^"]*"/g) ?? []).map((label) => label.replace(menu, "<menu>")).sort();
// A pane row's summary, found by the label it opens with: "View · Cards".
const summaryOf = (root: ReactTestRenderer, label: string) =>
  root.root.find((node) => String(node.props["aria-label"] ?? "").startsWith(`${label} · `) && typeof node.props.onSelect === "function");

describe("the control pane", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed();
  });

  it("carries Group by, Sort by and View as summaries of the top row's lists, and no title", () => {
    const html = render();

    assert.equal(count(html, /class="pickerSummary"/), 3, "a summary each for Group by, Sort by and View");
    assert.match(html, /class="pickerLabel">By tab</);
    assert.match(html, /class="pickerLabel">Name ▲</);
    assert.match(html, /class="pickerLabel">List</);
    // The game draws no title attribute: the summaries carry their labels as aria-labels.
    assert.doesNotMatch(html, / title="/);
  });

  it("carries the filters, and their chips in a row of their own", () => {
    setBinding("BetterBuildingMenu", "AssetMenuFacets", facets(true));
    const html = render();

    assert.match(html, /class="rail"/);
    assert.match(html, /class="rowLabel">Active</);
    assert.match(html, /aria-label="Remove Hospital"/);
    // On the pane's body, which follows the game's style, in the body's inks.
    assert.match(html, /class="chips onBody"/);
  });

  it("draws no chip and no Active row while nothing narrows the set, and none for the menu itself", () => {
    // A chip records a filter; the menu is no filter, and the search reaches other menus.
    const html = render();

    assert.doesNotMatch(html, /aria-label="Remove /);
    assert.doesNotMatch(html, />Active</);
  });

  it("still says what a search is for, where the search box is not", () => {
    setBinding("BetterBuildingMenu", "CurrentSearch", "road");

    assert.match(render(), /class="searchContext">Results for road</);
    setBinding("BetterBuildingMenu", "CurrentSearch", "   ");
    assert.doesNotMatch(render(), /class="searchContext"/);
  });

  it("gives the Zones menu the same controls as every other menu", () => {
    const roads = ariaLabels(render(), "Roads");
    resetBindings();
    seed("Zones");

    assert.ok(roads.length > 0);
    assert.deepEqual(ariaLabels(render(), "Zones"), roads);
  });

  it("draws no panel-level controls of its own", () => {
    // The game's own slot mounts and unmounts this, so the pane draws no
    // panel-level controls of its own.
    const html = render();

    for (const gone of [/aria-label="Lock/, /aria-label="Close/, /aria-label="Expand/, /aria-label="Collapse/, /Reset menu/]) {
      assert.doesNotMatch(html, gone);
    }
  });

  it("draws the same Filter, Group, Sort and View lists the top row's popovers show, one open at a time", () => {
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(<Pane />);
    });

    assert.equal(root!.root.findAllByType(FilterPanel).length, 1, "the filters inline");
    act(() => summaryOf(root!, "Group by").props.onSelect());
    assert.equal(root!.root.findAllByType(GroupList).length, 1);
    act(() => summaryOf(root!, "Sort by").props.onSelect());
    assert.equal(root!.root.findAllByType(SortList).length, 1);
    assert.equal(root!.root.findAllByType(GroupList).length, 0, "switching, not stacking");
    act(() => summaryOf(root!, "View").props.onSelect());
    assert.equal(root!.root.findAllByType(ViewList).length, 1);
    act(() => summaryOf(root!, "View").props.onSelect());
    assert.equal(root!.root.findAllByType(ViewList).length, 0, "a second press closes it");
    act(() => root!.unmount());
  });

  it("carries the look on its own root, so the lists' tokens resolve beside the box", () => {
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(<Pane />);
    });
    const pane = root!.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("pane"));

    assert.deepEqual(String(pane.props.className).split(" ").sort(), ["followStyle", "pane", "standard"]);
    act(() => setBinding("BetterBuildingMenu", "AssetMenuLook", "plates"));
    assert.deepEqual(String(pane.props.className).split(" ").sort(), ["followStyle", "pane", "plates"]);
    assert.equal(pane.props.style["--bbm-a-head"], "0.96");
    assert.equal(pane.props.style["--bbm-a-body"], "0.92");
    assert.equal(pane.props.style["--bbm-a-popBg"], "0.97");
    act(() => root!.unmount());
  });
});

describe("the control pane's view", () => {
  let root: ReactTestRenderer | undefined;
  const sent = () => triggers.filter((call) => call.name === "SetAssetMenuView").map((call) => call.args);
  const shown = () => String(summaryOf(root!, "View").props["aria-label"]).slice("View · ".length);
  const pick = (label: string) => {
    act(() => summaryOf(root!, "View").props.onSelect());
    act(() => root!.root.find((node) => node.props["aria-label"] === label && typeof node.props.onSelect === "function").props.onSelect());
  };

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed();
  });

  it("opens on the menu's own pick, and sends nothing back for reading it", () => {
    setBinding("BetterBuildingMenu", "AssetMenuViews", [{ menu: "Roads", value: "tiles" }]);
    act(() => { root = create(<Pane />); });

    assert.equal(shown(), "Tiles");
    assert.deepEqual(sent(), [], "reading the pick sends nothing back");
    act(() => root?.unmount());
  });

  it("sends a pick to C# once and closes the list, and draws it when C# keeps it", () => {
    act(() => { root = create(<Pane />); });
    pick("Cards");

    assert.deepEqual(sent(), [["cards"]]);
    assert.equal(root!.root.findAllByType(ViewList).length, 0);

    // C#'s answer, the menu's pick kept, redraws the control.
    act(() => setBinding("BetterBuildingMenu", "AssetMenuViews", [{ menu: "Roads", value: "cards" }]));
    assert.equal(shown(), "Cards");
    assert.deepEqual(sent(), [["cards"]]);
    act(() => root?.unmount());
  });
});
