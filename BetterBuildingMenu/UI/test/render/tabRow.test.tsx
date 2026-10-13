import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Profiler } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { clearPointed, getAssetMenuView, resetAssetMenuView, setDrawnForm, setPointed } from "../../src/domain/assetMenuViewStore";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
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

/** The page's Image, as far as a picture's probe uses it: every one made, to fail by hand. */
class FakeImage {
  static made: FakeImage[] = [];
  onerror: (() => void) | null = null;
  src = "";

  constructor() {
    FakeImage.made.push(this);
  }
}

/** The row mounted, as the game mounts it. */
function mount(width = 706): ReactTestRenderer {
  let root: ReactTestRenderer | undefined;
  act(() => {
    root = create(<TabRow width={width} />);
  });
  return root!;
}

/** The cell a player would press, found by what it says. */
const press = (root: ReactTestRenderer, label: string) =>
  act(() => root.root.find((node) => node.props["aria-label"] === label && typeof node.props.onSelect === "function").props.onSelect());

/** How a cell's picture is drawn in the markup: its slot's background, whole at its own aspect. */
const picture = (src: string) => `style="background-image:url(&quot;${src}&quot;)"`;

describe("the tab row", () => {
  beforeEach(() => resetBindings());

  it("starts with the All cell: the menu's icon on its plate, over the menu's count", () => {
    seedRoads();
    const html = render();

    assert.ok(html.includes(`<span class="iconSlot"><span class="picture plate" ${picture("Media/Game/Icons/Roads.svg")}>`), html);
    assert.ok(html.indexOf('class="picture plate"') < html.indexOf("SmallRoads.svg"), "All comes first");
    assert.match(html, /aria-label="All · 779"/);
  });

  it("draws each game tab as its own picture over its count", () => {
    seedRoads();
    const html = render();

    assert.ok(html.includes(`<span class="picture" ${picture("Media/Game/Icons/SmallRoads.svg")}></span></span><span class="count">30</span>`), html);
  });

  it("names the tab whose picture is the menu's own, and draws no empty picture", () => {
    seedRoads();
    const html = render();

    assert.match(html, /<span class="name">Highways<\/span><span class="count">0<\/span>/);
    assert.ok(!html.includes(picture("")), "an empty picture");
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

    assert.match(html, /aria-label="SmallRoads"><span class="iconSlot"><span class="picture" [^>]*><\/span><\/span><span class="count"><\/span><\/button>/);
    assert.doesNotMatch(html, /class="cell[^"]*empty/);
  });

  it("draws Education's tab and its levels as one plate, the levels worded", () => {
    seedEducation();
    const html = render();

    assert.match(html, /class="segment">.*url\(&quot;Media\/Game\/Icons\/Education\.svg&quot;\).*<span class="name">Elementary School<\/span><span class="count">22<\/span>/s);
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

  it("draws a picture whose name has a space or a quote as one address", () => {
    seedRoads();
    set("AssetMenuCategories", [category("SmallRoads", 'coui://ail/BuildingPrefab.JP_Wastewater Treatment "2".png'), category("MediumRoads")]);

    assert.ok(render().includes(picture('coui://ail/BuildingPrefab.JP_Wastewater Treatment \\&quot;2\\&quot;.png')));
  });

  it("names each tab beside its picture above the first Width step, when every tab fits named", () => {
    seedRoads();
    const html = renderHtml(<TabRow width={893} />);

    assert.match(html, /data-tab-form="named"/);
    // All: the menu's picture on its plate, then its name, then the count.
    assert.ok(
      html.includes(`<span class="iconSlot iconInline"><span class="picture plate" ${picture("Media/Game/Icons/Roads.svg")}></span></span><span class="name">All</span><span class="count">779</span>`),
      html,
    );
    assert.ok(
      html.includes(`${picture("Media/Game/Icons/SmallRoads.svg")}></span></span><span class="name">SmallRoads</span><span class="count">30</span>`),
      html,
    );
    // Highways already says its name: it keeps its name beside its count, and draws no picture.
    assert.ok(
      html.includes('<button class="cell inline empty" data-has-select="true" aria-label="Highways · 0"><span class="name">Highways</span><span class="count">0</span></button>'),
      html,
    );
  });

  it("keeps Education's plate in its own form when the row is named", () => {
    seedEducation();
    const html = renderHtml(<TabRow width={893} />);

    assert.match(html, /data-tab-form="named"/);
    assert.ok(html.includes(`${picture("Media/Game/Icons/Research.svg")}></span></span><span class="name">Research</span>`), html);
    // The plate's tab: its picture over its count, as at the first step.
    assert.ok(
      html.includes(`<span class="iconSlot"><span class="picture" ${picture("Media/Game/Icons/Education.svg")}></span></span><span class="count">65</span>`),
      html,
    );
    assert.doesNotMatch(html, /<span class="name">Education<\/span>/);
  });

  it("keeps each picture over its count at a wide step while the developer knob says Never", () => {
    seedRoads();
    set("AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: false });
    const html = renderHtml(<TabRow width={893} />);

    assert.match(html, /data-tab-form="stack"/);
    assert.doesNotMatch(html, /<span class="name">SmallRoads<\/span>/);
  });

  it("reads a tuning without the knob as names on", () => {
    seedRoads();
    set("AssetMenuTuning", { developerMode: true, interfaceStyles: true });

    assert.match(renderHtml(<TabRow width={893} />), /data-tab-form="named"/);
  });

  it("keeps each picture over its count at the first step", () => {
    seedRoads();
    const html = render();

    assert.match(html, /data-tab-form="stack"/);
    assert.doesNotMatch(html, /<span class="name">SmallRoads<\/span>/);
  });
});

describe("a picture that will not load", () => {
  beforeEach(() => {
    resetBindings();
    FakeImage.made = [];
    (globalThis as { Image?: unknown }).Image = FakeImage;
  });
  afterEach(() => delete (globalThis as { Image?: unknown }).Image);

  it("gives way to the menu's icon, and the tab says its name", () => {
    seedRoads();
    // Rows other tests left mounted probe their own pictures too.
    const first = FakeImage.made.length;
    const root = mount();
    const named = () => root.root.findAll((node) => node.type === "span" && node.props.className === "name").map((node) => node.props.children);

    assert.deepEqual(named(), ["Highways"]);
    act(() => FakeImage.made.slice(first).find((probe) => probe.src === "Media/Game/Icons/SmallRoads.svg")!.onerror!());

    assert.deepEqual(named(), ["SmallRoads", "Highways"]);
    act(() => root.unmount());
  });
});

describe("the readout", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seedRoads();
  });

  it("names the lit tab over the window the list holds, with the true total", () => {
    set("BuildingCatalog", { items: Array.from({ length: 100 }, (_, id) => ({ id })), totalCount: 779 });

    assert.match(render(), /data-readout="full"><span class="place">MediumRoads<\/span><span class="line"><span class="range">1–100 of 779<\/span><\/span>/);
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

    assert.match(render(), /data-readout="range"><span class="line"><span class="range">64<\/span><\/span><\/div>/);
  });

  it("keeps its range at 150% text", () => {
    setBinding("options", "textScale", 1.5);
    set("BuildingCatalog", { items: [], totalCount: 64 });

    assert.match(render(), /data-readout="range"><span class="line"><span class="range">64<\/span>/);
  });

  it("says a value most of the view's open rows share once, by its glyph, and tells the rows it said it", () => {
    const road = (id: number, speedLimit: number) => ({ id, name: `Road ${id}`, speedLimit, costIsPerDistance: true, constructionCost: 5000 + id });
    set("BuildingCatalog", {
      items: [road(1, 100), road(2, 100), road(3, 80), road(4, 100)],
      totalCount: 34,
      facts: { sharedValues: [{ kind: "speed", value: 100, depth: 0 }], keyKind: "speed" },
    });
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(<TabRow width={1091} />);
    });
    const html = JSON.stringify(root!.toJSON());

    assert.match(html, /"className":"saidGlyph","style":\{"maskImage":"url\(gauge\.svg\)"\}/);
    assert.match(html, /"className":"saidText"[^\]]*\["100 km\/h unless shown"\]/);
    assert.deepEqual(getAssetMenuView().said, [{ kind: "speed", value: 100, depth: 0 }]);
    // Gone, it tells the rows to print every value again.
    act(() => root!.unmount());
    assert.deepEqual(getAssetMenuView().said, []);
  });

  it("names the key kind by its glyph where nothing is said once, and says nothing of a value the cards do not show", () => {
    set("BuildingCatalog", { items: [{ id: 1, speedLimit: 100 }], totalCount: 1, facts: { sharedValues: [], keyKind: "speed" } });
    assert.match(render(), /<span class="saidText">Speed limit<\/span>/);

    set("AssetMenuViews", [{ menu: "Roads", value: "cards" }]);
    set("BuildingCatalog", { items: [{ id: 1, speedLimit: 100 }], totalCount: 1, facts: { sharedValues: [{ kind: "speed", value: 100, depth: 0 }], keyKind: "speed" } });
    assert.doesNotMatch(render(), /class="said"/);
  });

  it("tells the rows nothing is said where the legend has no room, so they print every value", () => {
    set("BuildingCatalog", {
      items: [{ id: 1, speedLimit: 100 }, { id: 2, speedLimit: 100 }, { id: 3, speedLimit: 100 }],
      totalCount: 3,
      facts: { sharedValues: [{ kind: "speed", value: 100, depth: 0 }], keyKind: "speed" },
    });
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(<TabRow width={260} />);
    });
    const html = JSON.stringify(root!.toJSON());
    const said = getAssetMenuView().said;
    act(() => root!.unmount());

    assert.doesNotMatch(html, /"className":"said"/);
    assert.deepEqual(said, []);
  });

  it("explains the key number on the plates the list draws: none on a one-line plate, the kind on a grown small menu's big plate", () => {
    setBinding("options", "textScale", 1.3);
    set("BuildingCatalog", { items: [{ id: 1, speedLimit: 100 }], totalCount: 1, facts: { sharedValues: [], keyKind: "speed" } });
    assert.doesNotMatch(render(), /class="said"/);

    setDrawnForm("big");
    assert.match(render(), /<span class="saidText">Speed limit<\/span>/);
  });

  it("draws the All count blank before C# sends it", () => {
    set("AssetMenuAllCount", -1);

    assert.match(render(), /<span class="count"><\/span>/);
  });

  it("draws no count and no total while the catalog is still being indexed", () => {
    // During a load the index has counted nothing yet, so a 0 there would be a claim it cannot make.
    set("CurrentSearch", "four");
    set("BuildingCatalog", { items: [], totalCount: 0, status: "indexing" });
    const html = render();

    assert.match(html, /<span class="range"><\/span>/);
    assert.doesNotMatch(html, /<span class="count">[^<]/);
    assert.doesNotMatch(html, / here</);
    assert.match(html, /aria-label="SmallRoads"/);
  });
});

describe("the tab row as the pointer crosses the cells", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  for (const form of ["pointer", "slot"]) {
    it(`draws nothing again as the pointer crosses cell after cell under the hover card's ${form} form`, () => {
      // Only Status line only says the pointed building in the row; under the others the row never reads it.
      seedRoads();
      set("AssetMenuHoverCard", form);
      let commits = 0;
      let root: ReactTestRenderer | undefined;
      act(() => {
        root = create(
          <Profiler id="tabRow" onRender={() => { commits += 1; }}>
            <TabRow width={706} />
          </Profiler>,
        );
      });
      const mounted = commits;

      for (const id of [1, 2, 3]) {
        act(() => setPointed({ entry: { id } as BuildingCatalogEntry, cell: { x: 612 + id * 66, y: 805, w: 64, h: 64 } }));
        act(() => clearPointed(id));
      }

      assert.ok(mounted > 0);
      assert.equal(commits, mounted);
      act(() => root!.unmount());
    });
  }

  it("draws again as the pointer crosses cells under Status line only, the one form whose row says the building", () => {
    seedRoads();
    set("AssetMenuHoverCard", "status");
    let commits = 0;
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(
        <Profiler id="tabRow" onRender={() => { commits += 1; }}>
          <TabRow width={706} />
        </Profiler>,
      );
    });
    const mounted = commits;

    act(() => setPointed({ entry: { id: 1 } as BuildingCatalogEntry, cell: { x: 678, y: 805, w: 64, h: 64 } }));

    assert.ok(commits > mounted);
    act(() => clearPointed(1));
    act(() => root!.unmount());
  });
});

describe("the readout under Status line only", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: Record<string, unknown>;
  let timers: (() => void)[] = [];
  let root: ReactTestRenderer | undefined;
  const readout = () => root!.root.find((node) => node.type === "div" && node.props["data-readout"] !== undefined);
  const text = (node: ReturnType<typeof readout>): string => node.children.map((child) => (typeof child === "string" ? child : text(child))).join("");

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seedRoads();
    set("AssetMenuHoverCard", "status");
    set("BuildingCatalog", { items: [], totalCount: 34, facts: { sharedValues: [], keyKind: "speed" } });
    timers = [];
    saved = { setTimeout: globals.setTimeout, clearTimeout: globals.clearTimeout };
    globals.setTimeout = (run: () => void) => timers.push(run);
    globals.clearTimeout = () => undefined;
    root = mount();
  });

  afterEach(() => {
    act(() => root?.unmount());
    Object.assign(globals, saved);
  });

  it("names the building pointed at and its figures once the pointer has rested, and says its own text again when it leaves", () => {
    const road = entry(9, { name: "Four-Lane Road", category: "Networks", constructionCost: 5_500, upkeep: 120, costIsPerDistance: true, speedLimit: 100, capacity: null, lotWidth: 0, lotDepth: 0 });
    act(() => setPointed({ entry: road, cell: { x: 0, y: 0, w: 171, h: 27.25 } }));
    act(() => timers.splice(0).forEach((run) => run()));

    assert.equal(readout().props["data-readout"], "status");
    assert.match(text(readout()), /^Four-Lane Road.*\/km.*100 km\/h/);

    act(() => clearPointed(9));
    assert.notEqual(readout().props["data-readout"], "status");
  });

  const road = (cost: number) =>
    entry(9, { name: "Four-Lane Road", category: "Networks", constructionCost: cost, upkeep: 120, costIsPerDistance: true, speedLimit: 100, capacity: null, lotWidth: 0, lotDepth: 0 });
  const pointAtRoad = (cost = 5_500) => {
    act(() => setPointed({ entry: road(cost), cell: { x: 0, y: 0, w: 171, h: 27.25 } }));
    act(() => timers.splice(0).forEach((run) => run()));
  };
  const named = () => root!.root.findAll((node) => node.type === "span" && node.props.className === "statusName");

  it("says the building as the page has it now, the pointed entry where the page no longer holds it", () => {
    set("BuildingCatalog", { items: [road(7_000)], totalCount: 34, facts: { sharedValues: [], keyKind: "speed" } });
    pointAtRoad(5_500);

    assert.match(text(readout()), /7\D000/);
    assert.doesNotMatch(text(readout()), /5\D500/);
  });

  it("leaves the rows their blanks while the building is named", () => {
    act(() => root!.unmount());
    const items = [1, 2, 3, 4].map((id) => ({ ...road(5_000 + id), id, speedLimit: id === 3 ? 80 : 100 }));
    set("BuildingCatalog", { items, totalCount: 34, facts: { sharedValues: [{ kind: "speed", value: 100, depth: 0 }], keyKind: "speed" } });
    root = mount(1091);
    const said = getAssetMenuView().said;
    assert.equal(said.length, 1);

    act(() => setPointed({ entry: items[0], cell: { x: 0, y: 0, w: 171, h: 27.25 } }));
    act(() => timers.splice(0).forEach((run) => run()));

    assert.equal(readout().props["data-readout"], "status");
    assert.deepEqual(getAssetMenuView().said, said);
  });

  for (const scale of [1, 1.3, 1.5]) {
    it(`draws the name over the figures at ${scale * 100}% text only where the two lines fit, else the name and the figures that fit in one line`, () => {
      setBinding("options", "textScale", scale);
      act(() => root!.unmount());
      root = mount(1091);
      pointAtRoad();

      assert.equal(readout().props["data-readout"], "status");
      assert.equal(named().length, 1);
      assert.equal(named()[0].parent!.props.className, scale > 1 ? "line" : "readout");
      assert.match(text(readout()), /^Four-Lane Road/);
      assert.match(text(readout()), /\/km/);
    });
  }

  it("shortens its one line at large text in a crowded row: the upkeep goes first, then the key number, the cost and the name kept", () => {
    // Thirteen worded tabs leave the readout less room at each text scale.
    const ids = Array.from({ length: 13 }, (_, at) => `Cat${at}`);
    set("AssetMenuCategories", ids.map((id) => category(id)));
    set("AssetMenuCategoryCounts", ids.map((id) => ({ id, count: 30 })));
    set("AssetMenuCategory", "Cat0");
    const figures = () => root!.root.findAll((node) => node.type === "span" && node.props.className === "statusFigure").map((node) => text(node));
    const said = [1, 1.3, 1.5].map((scale) => {
      setBinding("options", "textScale", scale);
      act(() => root!.unmount());
      root = mount();
      pointAtRoad();
      return { scale, name: text(named()[0]), figures: figures().map((figure) => figure.replace(/\s/g, " ")) };
    });

    assert.deepEqual(said, [
      { scale: 1, name: "Four-Lane Road", figures: ["¢5 500/km", "¢120/km/mo", "100 km/h"] },
      { scale: 1.3, name: "Four-Lane Road", figures: ["¢5 500/km", "100 km/h"] },
      { scale: 1.5, name: "Four-Lane Road", figures: ["¢5 500/km"] },
    ]);
  });

  it("keeps the readout's own text under the other forms", () => {
    set("AssetMenuHoverCard", "pointer");
    act(() => setPointed({ entry: entry(9), cell: { x: 0, y: 0, w: 171, h: 27.25 } }));
    act(() => timers.splice(0).forEach((run) => run()));

    assert.notEqual(readout().props["data-readout"], "status");
  });
});
