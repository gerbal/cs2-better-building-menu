import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "../../src/domain/buildingCatalog";
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

  it("shorten a road's rate on the tag at 130% and 150% text rather than cut it", () => {
    setBinding("options", "textScale", 1.3);
    assert.match(render([entry(1, { constructionCost: 5_500, costIsPerDistance: true })]), /<span class="tag"[^>]*>¢6k\/km<\/span>/);
    setBinding("options", "textScale", 1.5);
    assert.match(render([entry(1, { constructionCost: 16_500, costIsPerDistance: true })]), /<span class="tag"[^>]*>¢16\.5k<\/span>/);
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

  it("draw no name on a tile, only its tag: the name is the line's under them", () => {
    const tiles = [...render(rows(2)).matchAll(/<button class="tile[^"]*"[^>]*>(.*?)<\/button>/g)].map(([, inner]) => inner.replace(/<[^>]*>/g, ""));

    assert.equal(tiles.length, 2);
    for (const text of tiles) assert.match(text, /^¢1[^A-Za-z]*000$/);
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

    assert.match(html, /<div class="label stacked" style="left:16rem;top:0rem;width:64rem;height:64rem" data-bbm-label="group"><span class="labelText"><span class="labelWords">Residential<\/span><\/span><span class="labelCount">62<\/span><\/div>/);
    assert.match(html, /left:82rem;top:0rem;width:64rem;height:64rem[^>]*data-catalog-entry="1"/);
    assert.match(html, /left:148rem;top:0rem[^>]*data-bbm-label="group"/);
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
    saved = { requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  it("names the tile the pointer is on over the armed one, and the armed one again once it leaves", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 1);
    act(() => { root = create(body(rows(3))); });
    const named = () => root!.root.findAll((node) => node.props.className === "line").map((node) => node.children.join(""));
    const tile = root!.root.find((node) => node.props["data-catalog-entry"] === 3 && typeof node.props.onMouseEnter === "function");

    act(() => tile.props.onMouseEnter());
    assert.deepEqual(named(), ["Building 3"]);

    act(() => tile.props.onMouseLeave());
    assert.deepEqual(named(), ["Building 1"]);
  });
});
