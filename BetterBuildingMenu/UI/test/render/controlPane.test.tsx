import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { renderHtml, entry, catalogPage, count } from "../harness/render";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { mountEach } from "../harness/mount";
import { seed as seedBinding } from "../harness/seed";
import { loadLocale, resetLocale } from "../harness/stubs/cs2-l10n";
import { getAssetMenuView, resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { GROUP_DIMENSIONS } from "../../src/domain/buildingGroups";
import { ControlPane } from "../../src/mods/ControlPane/ControlPane";
import {
  AssetMenu$,
  AssetMenuFacets$,
  AssetMenuGroupDimensions$,
  AssetMenuViewMode$,
  BuildingCatalog$,
  AssetMenuAutoThenBy$,
  BuildingCatalogGroupBy$,
  BuildingCatalogThenBy$,
  BuildingCatalogMetricRanges$,
  BuildingCatalogSortColumn$,
  BuildingCatalogSortDescending$,
  CurrentSearch$,
} from "../../src/mods/bindings";

const facets = (selected: boolean) => ({
  groups: [{ id: "role", label: "Role", options: [{ id: "Hospital", label: "Hospital", selected }] }],
  hasSelection: selected,
});

const seed = (menu = "Roads") => {
  seedBinding(AssetMenu$, menu);
  seedBinding(BuildingCatalogGroupBy$, "menuCategory");
  seedBinding(AssetMenuGroupDimensions$, GROUP_DIMENSIONS.map((d) => d.id));
  seedBinding(BuildingCatalogThenBy$, "");
  seedBinding(AssetMenuAutoThenBy$, ["progression"]);
  seedBinding(BuildingCatalogSortColumn$, "Name");
  seedBinding(BuildingCatalogSortDescending$, false);
  seedBinding(CurrentSearch$, "");
  seedBinding(AssetMenuFacets$, facets(false));
  seedBinding(BuildingCatalogMetricRanges$, null);
  seedBinding(BuildingCatalog$, catalogPage([entry(1)], { reorderableSortColumns: ["Name", "ConstructionCost"] }));
};

const render = () => renderHtml(<ControlPane />);
// The labels the pane draws, with the menu's own name (the breadcrumb chip)
// factored out so two menus can be compared.
const ariaLabels = (html: string, menu: string): string[] =>
  (html.match(/aria-label="[^"]*"/g) ?? []).map((label) => label.replace(menu, "<menu>")).sort();

describe("the control pane", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed();
  });

  afterEach(() => resetLocale());

  it("carries grouping, sorting and view mode", () => {
    // A band inside the asset menu would be gated on `expanded`, so every control
    // it carried would be missing exactly when the asset menu is smallest and the
    // player needs them most.
    const html = render();

    assert.equal(count(html, /class="pickerSummary"/), 3, "two group pickers and a sort picker");
    assert.match(html, /class="pickerLabel">Category</);
    assert.match(html, /Sort by/);
    for (const mode of ["Grid", "List", "Cards", "Table"]) {
      assert.match(html, new RegExp(`title="${mode}"`), `view mode ${mode}`);
    }
  });

  it("carries the filters and their chips", () => {
    seedBinding(AssetMenuFacets$, facets(true));
    const html = render();

    assert.match(html, /class="rail"/);
    assert.match(html, /aria-label="Remove Hospital"/);
  });

  it("writes a range chip in the player's own number marks", () => {
    loadLocale({ "Common.THOUSANDS_SEPARATOR": ".", "Common.DECIMAL_SEPARATOR": "," });
    seedBinding(BuildingCatalogMetricRanges$, {
      minCost: 1234.5, maxCost: 98765,
      minUpkeep: null, maxUpkeep: null,
      minWorkers: null, maxWorkers: null,
      minCapacity: null, maxCapacity: null,
      minLotWidth: null, maxLotWidth: null,
      minLotDepth: null, maxLotDepth: null,
      hasSelection: true,
    });

    assert.match(render(), /class="chipText">Cost 1\.234,5–98\.765</);
  });

  it("draws no facet chip while nothing narrows the set", () => {
    // The menu itself is always a chip — the breadcrumb the scope row shows —
    // so only a facet chip says something has been narrowed.
    const html = render();

    assert.match(html, /aria-label="Remove Roads"/);
    assert.doesNotMatch(html, /aria-label="Remove Hospital"/);
  });

  it("still says what a search is for, where the search box is not", () => {
    seedBinding(CurrentSearch$, "road");

    assert.match(render(), /class="searchContext" title="road">Results for road</);
    seedBinding(CurrentSearch$, "   ");
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

    for (const gone of [/aria-label="Lock/, /aria-label="Close/, /aria-label="Expand/, /aria-label="Collapse/]) {
      assert.doesNotMatch(html, gone);
    }
  });
});

describe("the control pane's view", () => {
  const tree = mountEach();
  const sent = () => triggers.filter((call) => call.name === "SetAssetMenuViewMode").map((call) => call.args);
  const selected = () => tree.root.find((node) => node.props.selected === true && typeof node.props.onSelect === "function").props.tooltip;
  const press = (label: string) =>
    act(() => tree.root.find((node) => node.props.tooltip === label && typeof node.props.onSelect === "function").props.onSelect());

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed();
  });

  it("opens on the view C# kept while nothing was picked this session", () => {
    seedBinding(AssetMenuViewMode$, "list");
    tree.mount(<ControlPane />);

    assert.equal(selected(), "List");
    assert.deepEqual(sent(), [], "reading the kept view sends nothing back");
  });

  it("draws a pick at once and sends it to C# once", () => {
    seedBinding(AssetMenuViewMode$, "list");
    tree.mount(<ControlPane />);
    press("Table");

    assert.equal(selected(), "Table");
    assert.deepEqual(sent(), [["table"]]);

    // C#'s echo of the same value redraws nothing and sends nothing.
    act(() => seedBinding(AssetMenuViewMode$, "table"));
    assert.equal(selected(), "Table");
    assert.deepEqual(sent(), [["table"]]);
  });

  it("keeps the session's pick over a stale value C# pushes later", () => {
    tree.mount(<ControlPane />);
    press("Grid");
    act(() => seedBinding(AssetMenuViewMode$, "list"));

    assert.equal(selected(), "Grid");
  });

  it("goes back to Cards on Reset menu and keeps no view for the next session", () => {
    seedBinding(AssetMenuViewMode$, "list");
    tree.mount(<ControlPane />);
    act(() => tree.root.find((node) => node.type === "button" && node.props.className === "resetButton").props.onClick());

    assert.equal(selected(), "Cards");
    assert.equal(getAssetMenuView().viewMode, "cards");
    assert.deepEqual(sent(), [[""]]);
  });
});

describe("the control pane's second grouping", () => {
  const tree = mountEach();
  const sent = () => triggers.filter((call) => call.name === "SetBuildingCatalogThenBy").map((call) => call.args);
  const summary = (title: string) => tree.root.find((node) => node.props.title === title && typeof node.props.onSelect === "function");

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed();
  });

  it("sits beside the first, naming what Auto groups by", () => {
    const html = render();

    assert.match(html, /class="pickerLabel">Category<\/span>[\s\S]*class="pickerLabel">Progression</);
    assert.doesNotMatch(html, /Auto/);
  });

  it("reads None, not an empty Auto, under a first choice with no second level", () => {
    seedBinding(AssetMenuAutoThenBy$, []);
    tree.mount(<ControlPane />);
    act(() => summary("None").props.onSelect());

    const options = tree.root.findAll((node) => node.props.className?.includes?.("pickerOption") && typeof node.props.onSelect === "function");
    assert.equal(options.filter((node) => node.props["aria-label"] === "None").length, 1, "one None");
    assert.ok(options.find((node) => node.props["aria-label"] === "None")!.props.className.includes("pickerOptionSelected"));
  });

  it("sends the dimension the player picks", () => {
    tree.mount(<ControlPane />);
    act(() => summary("Progression").props.onSelect());
    act(() => tree.root.find((node) => node.props["aria-label"] === "Theme" && typeof node.props.onSelect === "function").props.onSelect());

    assert.deepEqual(sent(), [["theme"]]);
  });

  it("names a picked dimension, and stays shown but disabled while nothing is grouped", () => {
    seedBinding(BuildingCatalogThenBy$, "theme");
    tree.mount(<ControlPane />);
    assert.equal(summary("Theme").props.disabled, false);

    act(() => seedBinding(BuildingCatalogGroupBy$, "none"));
    tree.mount(<ControlPane />);
    assert.equal(summary("Theme").props.disabled, true);
  });
});

