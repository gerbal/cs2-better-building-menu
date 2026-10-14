import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "../../src/domain/buildingCatalog";
import { getAssetMenuView, resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { TilesBody } from "../../src/mods/Bodies/TilesBody";

const grid = (over: Partial<BodyGridInput> = {}) => bodyGrid({
  body: "tiles", boxWidth: 706, bodyHeight: 144.25, textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, ...over,
});
const rows = (n: number, over: (id: number) => Partial<BuildingCatalogEntry> = () => ({})) =>
  Array.from({ length: n }, (_, at) => entry(at + 1, over(at + 1)));
const body = (entries: BuildingCatalogEntry[], over: Partial<BodyGridInput> = {}) =>
  <TilesBody entries={entries} grid={grid(over)} onPlace={() => undefined} footer={<div className="loadMoreRow" />} />;
const render = (entries: BuildingCatalogEntry[], over: Partial<BodyGridInput> = {}) => renderHtml(body(entries, over));

describe("the tiles", () => {
  beforeEach(() => resetBindings());

  it("draw each building on a 64 tile at its slot, ten across from 16 in and two down", () => {
    const html = render(rows(11));

    assert.equal(count(html, /data-bbm-item="true"/), 11);
    assert.match(html, /left:16rem;top:0rem;width:64rem;height:64rem[^>]*data-catalog-entry="1"/);
    assert.match(html, /left:16rem;top:66rem;width:64rem;height:64rem[^>]*data-catalog-entry="11"/);
    assert.match(html, /data-bbm-view="tiles"/);
    // The menu's one hover card says each building: no tile carries a tooltip of its own.
    assert.equal(count(html, /data-tooltip/), 0);
  });

  it("draw the picture inset 2 on every side", () => {
    assert.match(render(rows(1)), /<img class="picture" src="[^"]*" style="width:60rem;height:60rem"[^>]*data-bbm-pic="true"/);
  });

  it("put the cost on a tag at the tile's foot, and a locked building's milestone there with a padlock", () => {
    const html = render([entry(1, { constructionCost: 1000 }), entry(2, { isLocked: true, unlockMilestone: 4 } as Partial<BuildingCatalogEntry>)]);

    assert.match(html, /<span class="tag" style="max-width:62rem" data-bbm-fact="true">¢1[^<]*000<\/span>/);
    assert.match(html, /<span class="tag milestone" style="max-width:62rem" data-bbm-fact="true">MS 4<\/span>/);
    assert.equal(count(html, /LockRaster\.png/), 1);
    assert.match(render([entry(3, { isLocked: true, unlockMilestone: 0 } as Partial<BuildingCatalogEntry>)]), /<span class="tag milestone"[^>]*>Locked<\/span>/);
    assert.match(html, /class="tile unplaceable"[^>]*data-catalog-entry="2"[^>]*data-vector-thumb="false"/);
  });

  it("say the locked word on the tag once the city has reached the building's milestone", () => {
    setBinding("milestone", "achievedMilestone", 4);

    assert.match(render([entry(1, { isLocked: true, unlockMilestone: 4 } as Partial<BuildingCatalogEntry>)]), /<span class="tag milestone"[^>]*>Locked<\/span>/);
  });

  it("say a cost too wide for the tag in millions, at 100% text and above it", () => {
    assert.match(render([entry(1, { constructionCost: 12_500_000 })]), /<span class="tag"[^>]*>¢12\.5M<\/span>/);
    setBinding("options", "textScale", 1.3);
    assert.match(render([entry(1, { constructionCost: 1_200_000 })]), /<span class="tag"[^>]*>¢1\.2M<\/span>/);
    assert.match(render([entry(1, { constructionCost: 48_000 })]), /<span class="tag"[^>]*>¢48[^<]*000<\/span>/);
  });

  it("say a road's cost per cell on the tag, whole at 130% and 150% text", () => {
    setBinding("options", "textScale", 1.3);
    assert.match(render([entry(1, { constructionCost: 5_500, costIsPerDistance: true })]), /<span class="tag"[^>]*>¢44\/c<\/span>/);
    setBinding("options", "textScale", 1.5);
    assert.match(render([entry(1, { constructionCost: 16_500, costIsPerDistance: true })]), /<span class="tag"[^>]*>¢132\/c<\/span>/);
  });

  it("bound the tag to the tile on a larger Tile size too", () => {
    assert.match(render(rows(1), { tileSize: 80 }), /<span class="tag" style="max-width:78rem"/);
  });

  it("say the value sorted by on the tag under a sort by a value, as 0.2.x's Grid did, and the cost again under the cost", () => {
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Capacity");
    const sorted = render([entry(1, { capacity: 300 })]);

    // The unit word does not fit beside it on a 64 tile, so the whole number stands alone.
    assert.match(sorted, /<span class="tag"[^>]*>300<\/span>/);
    assert.doesNotMatch(sorted, /<span class="tag"[^>]*>¢/);
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "ConstructionCost");
    assert.match(render([entry(1, { capacity: 300 })]), /<span class="tag"[^>]*>¢1[^<]*000<\/span>/);
  });

  it("in Plates, say the value sorted by on the tag with its unit, and no tag where the unit does not fit", () => {
    setBinding("BetterBuildingMenu", "AssetMenuLook", "plates");
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Workers");
    assert.match(render([entry(1, { workers: 20 })], { tileNameLine: false }), /<span class="tag pill"[^>]*>20 jobs<\/span>/);
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "Capacity");
    assert.doesNotMatch(render([entry(1, { capacity: 300 })], { tileNameLine: false }), /class="tag/);
  });

  it("draw no name on a tile that has no look-alike drawn with it, only its tag: the name is the line's under them", () => {
    const named = rows(2, (id) => ({ name: id === 1 ? "Clinic" : "Hospital" }));
    const tiles = [...render(named).matchAll(/<button class="tile[^"]*"[^>]*>(.*?)<\/button>/g)].map(([, inner]) => inner.replace(/<[^>]*>/g, ""));

    assert.equal(tiles.length, 2);
    for (const text of tiles) assert.match(text, /^¢1[^A-Za-z]*000$/);
  });

  it("tag look-alikes at their top with the word that tells each apart, a whole name where it fits", () => {
    const zones = [
      { name: "NA Low Density Cabin Housing", distinctWord: "Cabin" },
      { name: "NA Low Density Country Housing", distinctWord: "Country" },
      { name: "NA Pack", distinctWord: "Pack" },
      { name: "Stone Terrace Rowhomes" },
    ];
    const html = render(rows(4, (id) => zones[id - 1]));

    assert.equal(count(html, /class="lookAlike"/), 3);
    // Marked, so the live check and the render tests can count them.
    assert.match(html, /<span class="lookAlike" style="max-width:62rem" data-bbm-tag="true">Cabin<\/span>/);
    assert.match(html, /<span class="lookAlike" style="max-width:62rem" data-bbm-tag="true">NA Pack<\/span>/);
    assert.doesNotMatch(html, /lookAlike" [^>]*>Stone/);
  });

  it("in Plates, name each look-alike on a band across its top and round the cost tag's ends", () => {
    setBinding("BetterBuildingMenu", "AssetMenuLook", "plates");
    const zones = [
      { name: "NA Pack", distinctWord: "Pack" },
      { name: "NA Trailer Homes", distinctWord: "Trailer", isLocked: true },
      { name: "Stone Terrace Rowhomes" },
    ];
    const html = render(rows(3, (id) => zones[id - 1] as Partial<BuildingCatalogEntry>), { tileSize: 100, tileNameLine: false });

    assert.equal(count(html, /class="band"/), 2);
    assert.match(html, /<span class="band" style="width:98rem" data-bbm-tag="true" data-bbm-band="true">NA Pack<\/span>/);
    assert.match(html, /<span class="band" style="width:81rem" data-bbm-tag="true" data-bbm-band="true">[^<]*Trailer[^<]*<\/span>/);
    assert.doesNotMatch(html, /class="lookAlike"/);
    assert.match(html, /class="tag pill"/);
    assert.doesNotMatch(html, /class="nameLine"/);
  });

  it("keep a locked look-alike's tag clear of its lock glyph, measured in the room left beside it", () => {
    const html = render(rows(2, (id) => ({ name: id === 1 ? "NA Pack" : "NA Trailer Homes", distinctWord: id === 1 ? "Pack" : "Trailer", isLocked: id === 1 } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /<img class="lockGlyph"[^>]*><span class="lookAlike" style="max-width:45rem" data-bbm-tag="true">Pack<\/span>/);
    assert.match(html, /<span class="lookAlike" style="max-width:62rem" data-bbm-tag="true">Trailer<\/span>/);
  });

  it("keep the game's unique mark on a unique tile, shown on hover as 0.2.x's grid did", () => {
    const html = render(rows(1, () => ({ isUnique: true } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /<img class="mark uniqueMark" src="Media\/Game\/Icons\/Unique\.svg"/);
    assert.doesNotMatch(html, /class="tile unplaceable"/);
  });

  it("mark a unique the city already holds as built and unplaceable, and no other tile", () => {
    const html = render(rows(1, () => ({ isUnique: true, isAlreadyBuilt: true } as Partial<BuildingCatalogEntry>)));

    assert.match(html, /<img class="mark builtMark" src="Media\/Game\/Icons\/AlreadyBuilt\.svg"/);
    assert.match(html, /class="tile unplaceable"/);
    assert.match(html, /aria-disabled="true"/);
    assert.doesNotMatch(render(rows(2)), /class="mark /);
  });

  it("fill the armed tile, and only it", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 2);

    assert.equal(count(render(rows(3)), /class="tile armed"/), 1);
  });

  it("name the armed tile on the line under them, with the numbers a tile does not show", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 2);
    const html = render(rows(3));

    assert.match(html, /class="nameLine" style="height:14\.25rem"/);
    assert.match(html, /<span class="line">Building 2<\/span>/);
    assert.match(html, /class="lineFacts">20[^<]* · /);
  });

  it("keep the tiles' own lines in the window above the name line", () => {
    assert.match(render(rows(3)), /class="window" style="height:130rem"/);
  });

  it("drop the name line where 68 tiles leave too little under them, and by the Tile name line knob", () => {
    assert.doesNotMatch(render(rows(3), { tileSize: 68 }), /class="nameLine"/);
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, tileNameLine: false });
    assert.doesNotMatch(render(rows(3)), /class="nameLine"/);
  });

  it("draw no title, which Cohtml never shows", () => {
    assert.doesNotMatch(render(rows(2)), / title="/);
  });

  it("draw a group's label in a tile's slot, its name over its count, and the tiles after it a slot on", () => {
    const sections: CatalogSection[] = [
      { id: "group:0", kind: "group", label: "Residential", labelId: "", start: 0, count: 62, collapsed: false },
      { id: "group:1", kind: "group", label: "Commercial", labelId: "", start: 1, count: 20, collapsed: false },
    ];
    const html = renderHtml(<TilesBody entries={rows(2)} grid={grid()} sections={sections} onPlace={() => undefined} />);

    assert.match(html, /<div class="label stacked" style="left:16rem;top:0rem;width:64rem;height:64rem" data-bbm-label="group"><span class="planned labelText"><span class="line">RES…TIAL<\/span><\/span><span class="labelCount">62<\/span><\/div>/);
    assert.match(html, /left:82rem;top:0rem;width:64rem;height:64rem[^>]*data-catalog-entry="1"/);
    assert.match(html, /left:148rem;top:0rem[^>]*data-bbm-label="group"/);
  });

  it("plan a tab's name in a label's square over two lines, a word wider than the square cut inside it", () => {
    const sections: CatalogSection[] = [
      { id: "group:0", kind: "group", label: "Intersections", labelId: "", start: 0, count: 81, collapsed: false },
      { id: "group:1", kind: "group", label: "Elementary School", labelId: "", start: 1, count: 22, collapsed: false },
    ];
    const html = renderHtml(<TilesBody entries={rows(2)} grid={grid()} sections={sections} onPlace={() => undefined} />);

    // Tracked caps wider than the square: each word cut inside it, the other word whole, never mid-letter at its edge.
    assert.match(html, /<span class="planned labelText"><span class="line">INT…IONS<\/span><\/span>/);
    assert.match(html, /<span class="planned labelText"><span class="line">ELE…ARY<\/span><span class="line">SCHOOL<\/span><\/span>/);
  });

  it("draw the Locked label in a tile's square as a plate that can be pressed, its word over its count", () => {
    const locked: CatalogSection = { id: "locked", kind: "locked", label: "", labelId: "", start: 1, count: 9, collapsed: false };
    const html = renderHtml(<TilesBody entries={rows(2)} grid={grid()} sections={[locked]} onPlace={() => undefined} />);

    assert.match(html, /<button class="label lockedLabel stacked" style="left:82rem;top:0rem;width:64rem;height:64rem" data-has-select="true" aria-expanded="true" data-bbm-label="locked">/);
  });

  it("draw an own-line label across the whole line, its name beside its count", () => {
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, blockLabels: "ownLine" });
    const sections: CatalogSection[] = [
      { id: "group:0", kind: "group", label: "Residential", labelId: "", start: 0, count: 1, collapsed: false },
      { id: "group:1", kind: "group", label: "Commercial", labelId: "", start: 1, count: 1, collapsed: false },
    ];
    const html = renderHtml(<TilesBody entries={rows(2)} grid={grid()} sections={sections} onPlace={() => undefined} />);

    // Ten tiles across: the label spans them, and the tile after it starts the next line.
    assert.match(html, /<div class="label" style="left:16rem;top:0rem;width:658rem;height:64rem" data-bbm-label="group">/);
    assert.match(html, /left:16rem;top:66rem;width:64rem;height:64rem[^>]*data-catalog-entry="1"/);
  });
});

describe("the tiles' name line under the pointer", () => {
  let root: ReactTestRenderer | undefined;
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: Record<string, unknown>;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    saved = { requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  it("names the tile the pointer is on over the armed one, and the armed one again once it leaves, as the hover card reads it", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 1);
    act(() => { root = create(body(rows(3))); });
    const named = () => root!.root.findAll((node) => node.props.className === "line").map((node) => node.children.join(""));
    // The tile, and the element the stub draws for it, which the enter reaches too: the tile's own.
    const [tile] = root!.root.findAll((node) => node.props["data-catalog-entry"] === 3 && typeof node.props.onMouseEnter === "function");

    act(() => tile.props.onMouseEnter({ currentTarget: null }));
    assert.deepEqual(named(), ["Building 3"]);
    assert.equal(getAssetMenuView().pointed?.entry.id, 3);

    act(() => tile.props.onMouseLeave());
    assert.deepEqual(named(), ["Building 1"]);
    assert.equal(getAssetMenuView().pointed, null);
  });
});
