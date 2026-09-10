import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry, catalogPage, count } from "../harness/render";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetLensView } from "../../src/domain/lensViewStore";
import { GROUP_DIMENSIONS } from "../../src/domain/buildingGroups";
import { LensControlPane } from "../../src/mods/LensControlPane/LensControlPane";

const facets = (selected: boolean) => ({
  groups: [{ id: "role", label: "Role", options: [{ id: "Hospital", label: "Hospital", selected }] }],
  hasSelection: selected,
});

const seed = (menu = "Roads") => {
  setBinding("BetterBuildingMenu", "BuildingLensMenu", menu);
  setBinding("BetterBuildingMenu", "BuildingCatalogGroupBy", "menuCategory");
  setBinding("BetterBuildingMenu", "BuildingLensGroupDimensions", GROUP_DIMENSIONS.map((d) => d.id));
  setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Name");
  setBinding("BetterBuildingMenu", "BuildingCatalogSortDescending", false);
  setBinding("BetterBuildingMenu", "CurrentSearch", "");
  setBinding("BetterBuildingMenu", "BuildingLensFacets", facets(false));
  setBinding("BetterBuildingMenu", "BuildingCatalogMetricRanges", null);
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], { reorderableSortColumns: ["Name", "ConstructionCost"] }));
};

const render = () => renderHtml(<LensControlPane />);
// The labels the pane draws, with the menu's own name (the breadcrumb chip)
// factored out so two menus can be compared.
const ariaLabels = (html: string, menu: string): string[] =>
  (html.match(/aria-label="[^"]*"/g) ?? []).map((label) => label.replace(menu, "<menu>")).sort();

describe("the control pane", () => {
  beforeEach(() => {
    resetBindings();
    resetLensView();
    seed();
  });

  it("carries grouping, sorting and view mode", () => {
    // A band inside the panel would be gated on `expanded`, so every control
    // it carried would be missing exactly when the panel is smallest and the
    // player needs them most.
    const html = render();

    assert.equal(count(html, /class="pickerSummary"/), 2, "a group picker and a sort picker");
    assert.match(html, /class="pickerLabel">Category</);
    assert.match(html, /Sort by/);
    for (const mode of ["Grid", "List", "Cards", "Table"]) {
      assert.match(html, new RegExp(`title="${mode}"`), `view mode ${mode}`);
    }
  });

  it("carries the filters and their chips", () => {
    setBinding("BetterBuildingMenu", "BuildingLensFacets", facets(true));
    const html = render();

    assert.match(html, /class="rail"/);
    assert.match(html, /aria-label="Remove Hospital"/);
  });

  it("draws no facet chip while nothing narrows the set", () => {
    // The menu itself is always a chip — the breadcrumb the scope row shows —
    // so only a facet chip says something has been narrowed.
    const html = render();

    assert.match(html, /aria-label="Remove Roads"/);
    assert.doesNotMatch(html, /aria-label="Remove Hospital"/);
  });

  it("still says what a search is for, where the search box is not", () => {
    setBinding("BetterBuildingMenu", "CurrentSearch", "road");

    assert.match(render(), /class="searchContext" title="road">Results for road</);
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

    for (const gone of [/aria-label="Lock/, /aria-label="Close/, /aria-label="Expand/, /aria-label="Collapse/]) {
      assert.doesNotMatch(html, gone);
    }
  });
});
