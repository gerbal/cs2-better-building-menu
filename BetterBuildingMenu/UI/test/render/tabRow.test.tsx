import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { TabRow } from "../../src/mods/TabRow/TabRow";

const set = (name: string, value: unknown) => setBinding("BetterBuildingMenu", name, value);
const category = (id: string, icon = `Media/Game/Icons/${id}.svg`) => ({ id, name: id, icon, priority: 0 });

/** Roads with three tabs, Medium Roads lit and Highways emptied by a filter; its picture is the menu's own. */
function seedRoads(): void {
  set("AssetMenu", "Roads");
  set("AssetMenus", [category("Roads", "Media/Game/Icons/Roads.svg")]);
  set("AssetMenuCategories", [category("SmallRoads"), category("MediumRoads"), category("Highways", "Media/Game/Icons/Roads.svg")]);
  set("AssetMenuCategoryCounts", [{ id: "SmallRoads", count: 30 }, { id: "MediumRoads", count: 34 }, { id: "Highways", count: 0 }]);
  set("AssetMenuAllCount", 779);
  set("AssetMenuCategory", "MediumRoads");
}

/** Education, its four levels under the Education tab. */
function seedEducation(): void {
  set("AssetMenu", "Education & Research");
  set("AssetMenus", [category("Education & Research", "Media/Game/Icons/EducationResearch.svg")]);
  set("AssetMenuCategories", [category("Education"), category("Research")]);
  set("AssetMenuCategoryCounts", [{ id: "Education", count: 65 }, { id: "Research", count: 5 }]);
  set("AssetMenuAllCount", 70);
  set("AssetMenuCategory", "");
  set("AssetMenuTierBracket", {
    parentCategory: "Education",
    parentCount: 65,
    tiers: [
      { id: "1", count: 22, icon: "", label: "Elementary School" },
      { id: "2", count: 23, icon: "", label: "High School" },
    ],
  });
}

const render = () => renderHtml(<TabRow width={706} />);

/** The row mounted, as the game mounts it. */
function mount(): ReactTestRenderer {
  let root: ReactTestRenderer | undefined;
  act(() => {
    root = create(<TabRow width={706} />);
  });
  return root!;
}

/** The cell a player would press, found by what it says. */
const press = (root: ReactTestRenderer, label: string) =>
  act(() => root.root.find((node) => node.props["aria-label"] === label && typeof node.props.onSelect === "function").props.onSelect());

/** A picture the row draws, found by its source. */
const imageOf = (root: ReactTestRenderer, src: string) => root.root.find((node) => node.type === "img" && node.props.src === src);

describe("the tab row", () => {
  beforeEach(() => resetBindings());

  it("starts with the All cell: the menu's icon on its plate, over the menu's count", () => {
    seedRoads();
    const html = render();

    assert.match(html, /class="iconSlot plate"><img class="icon" src="Media\/Game\/Icons\/Roads\.svg"/);
    assert.ok(html.indexOf('class="iconSlot plate"') < html.indexOf("SmallRoads.svg"), "All comes first");
    assert.match(html, /aria-label="All · 779"/);
  });

  it("draws each game tab as its own picture over its count", () => {
    seedRoads();
    const html = render();

    assert.match(html, /<img class="icon" src="Media\/Game\/Icons\/SmallRoads\.svg"[^>]*\/><\/span><span class="count">30<\/span>/);
  });

  it("names the tab whose picture is the menu's own, and draws no empty picture", () => {
    seedRoads();
    const html = render();

    assert.match(html, /<span class="name">Highways<\/span><span class="count">0<\/span>/);
    assert.doesNotMatch(html, /src=""/);
  });

  it("lights the picked tab and draws a tab the filters empty faint", () => {
    seedRoads();
    const html = render();

    assert.match(html, /class="cell lit"[^>]*aria-label="MediumRoads · 34"/);
    assert.match(html, /class="cell inline empty"[^>]*aria-label="Highways · 0"/);
  });

  it("draws a count that has not arrived blank, not a faint 0", () => {
    seedRoads();
    set("AssetMenuCategoryCounts", []);
    const html = render();

    assert.match(html, /aria-label="SmallRoads"><span class="iconSlot"><img [^>]*\/><\/span><span class="count"><\/span><\/button>/);
    assert.doesNotMatch(html, /class="cell[^"]*empty/);
  });

  it("draws Education's tab and its levels as one plate, the levels worded", () => {
    seedEducation();
    const html = render();

    assert.match(html, /class="segment">.*src="Media\/Game\/Icons\/Education\.svg".*<span class="name">Elementary School<\/span><span class="count">22<\/span>/s);
  });

  it("sends the pick each cell stands for: All, a tab, a level and a branch", () => {
    seedRoads();
    const roads = mount();
    press(roads, "All · 779");
    press(roads, "SmallRoads · 30");
    seedEducation();
    press(mount(), "High School · 23");
    set("AssetMenu", "Electricity");
    set("AssetMenuCategories", [category("Electricity")]);
    set("AssetMenuCategoryCounts", [{ id: "Electricity", count: 7 }]);
    set("AssetMenuStripTabs", [{ id: "Wind", count: 4, icon: "Wind.svg", label: "Wind" }, { id: "Gas", count: 3, icon: "Gas.svg", label: "Gas" }]);
    press(mount(), "Gas · 3");

    assert.deepEqual(
      triggers.map((call) => [call.name, ...call.args]),
      [["SetAssetMenuCategory", ""], ["SetAssetMenuCategory", "SmallRoads"], ["SetAssetMenuSchoolTier", 2], ["SetAssetMenuStripTab", "Gas"]]
    );
  });

  it("labels every cell through the game's Tooltip, with its name and count", () => {
    seedRoads();

    assert.match(render(), /data-tooltip="true">MediumRoads · 34</);
  });

  it("fits a picture that is not square by its long side once it loads", () => {
    seedRoads();
    const root = mount();

    act(() => imageOf(root, "Media/Game/Icons/SmallRoads.svg").props.onLoad({ currentTarget: { naturalWidth: 890, naturalHeight: 757 } }));

    assert.deepEqual(imageOf(root, "Media/Game/Icons/SmallRoads.svg").props.style, { width: "100%", height: "85.06%" });
  });

  it("draws a new menu's picture square until it loads, not at the last picture's fit", () => {
    seedRoads();
    const root = mount();
    act(() => imageOf(root, "Media/Game/Icons/Roads.svg").props.onLoad({ currentTarget: { naturalWidth: 890, naturalHeight: 757 } }));

    act(() => {
      set("AssetMenus", [category("Roads", "Media/Game/Icons/Roads.svg"), category("Electricity", "Media/Game/Icons/Electricity.svg")]);
      set("AssetMenu", "Electricity");
    });

    assert.deepEqual(imageOf(root, "Media/Game/Icons/Electricity.svg").props.style, { width: "100%", height: "100%" });
  });
});

describe("the readout", () => {
  beforeEach(() => {
    resetBindings();
    seedRoads();
  });

  it("names the lit tab over the window the list holds, with the true total", () => {
    set("BuildingCatalog", { items: Array.from({ length: 100 }, (_, id) => ({ id })), totalCount: 779 });

    assert.match(render(), /data-readout="full"><span class="place">MediumRoads<\/span><span class="range">1–100 of 779<\/span>/);
  });

  it("counts the matches here while a search is typed", () => {
    set("CurrentSearch", "four");
    set("AssetMenuAllCount", 37);
    set("BuildingCatalog", { items: [], totalCount: 37 });

    assert.match(render(), /<span class="place">37 here<\/span>/);
  });

  it("keeps one line, its range, from 110% text", () => {
    setBinding("options", "textScale", 1.1);
    set("BuildingCatalog", { items: [], totalCount: 64 });

    assert.match(render(), /data-readout="range"><span class="range">64<\/span><\/div>/);
  });

  it("keeps its range at 150% text", () => {
    setBinding("options", "textScale", 1.5);
    set("BuildingCatalog", { items: [], totalCount: 64 });

    assert.match(render(), /data-readout="range"><span class="range">64<\/span>/);
  });

  it("draws the All count blank before C# sends it", () => {
    set("AssetMenuAllCount", -1);

    assert.match(render(), /<span class="count"><\/span>/);
  });
});
