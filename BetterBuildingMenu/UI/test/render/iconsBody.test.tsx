import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "../../src/domain/buildingCatalog";
import { IconsBody } from "../../src/mods/Bodies/IconsBody";

const grid = (over: Partial<BodyGridInput> = {}) => bodyGrid({
  body: "icons", boxWidth: 706, bodyHeight: 144.25, textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, ...over,
});
const rows = (n: number, over: (id: number) => Partial<BuildingCatalogEntry> = () => ({})) =>
  Array.from({ length: n }, (_, at) => entry(at + 1, over(at + 1)));
const render = (entries: BuildingCatalogEntry[], props: { sections?: CatalogSection[]; named?: boolean } = {}) =>
  renderHtml(<IconsBody entries={entries} grid={grid()} onPlace={() => undefined} {...props} />);
const boulder = (id: number): Partial<BuildingCatalogEntry> => ({ name: `Boulder 0${id}`, familyKey: "Boulder", familyToken: `0${id}` });

describe("the icons", () => {
  beforeEach(() => resetBindings());

  it("draw each building's picture alone on a 44 plate at its slot, fifteen across from 1 in and three down, 4.125 from the top", () => {
    const html = render(rows(46));

    assert.equal(count(html, /data-bbm-item="true"/), 46);
    assert.match(html, /data-bbm-view="icons"/);
    assert.match(html, /left:1rem;top:4\.125rem;width:44rem;height:44rem[^>]*data-catalog-entry="1"/);
    assert.match(html, /left:645rem;top:96\.125rem;width:44rem;height:44rem[^>]*data-catalog-entry="45"/);
    assert.match(html, /<img class="picture" src="[^"]*" style="width:42rem;height:42rem"[^>]*data-bbm-pic="true"/);
    // No name, cost or tag: the hover card says them.
    assert.equal(count(html, /data-bbm-name=/), 0);
    assert.equal(count(html, /data-bbm-fact=/), 0);
    assert.equal(count(html, /data-tooltip/), 0);
    // Cohtml never draws a title.
    assert.doesNotMatch(html, / title="/);
  });

  it("put a family member's varying word on a pill at its foot, and alternate the plate's tone with each family run", () => {
    const html = render([entry(1, { name: "Rock Random" }), ...[1, 2, 3].map((id) => entry(id + 1, boulder(id))), entry(5, { name: "Old Mill Ruins" })]);

    assert.equal(count(html, /data-bbm-pill="true"/), 3);
    assert.match(html, /<span class="pillWord" data-bbm-pill="true">02<\/span>/);
    assert.match(html, /class="icon"[^>]*data-catalog-entry="1"/);
    assert.match(html, /class="icon alt"[^>]*data-catalog-entry="2"/);
    assert.match(html, /class="icon alt"[^>]*data-catalog-entry="4"/);
    assert.match(html, /class="icon"[^>]*data-catalog-entry="5"/);
  });

  it("draw a locked icon dark, its lock over the milestone it waits for", () => {
    const html = render([entry(1, { isLocked: true, unlockMilestone: 4 } as Partial<BuildingCatalogEntry>)]);

    assert.match(html, /class="icon unplaceable"[^>]*data-catalog-entry="1"/);
    assert.equal(count(html, /LockRaster\.png/), 1);
    assert.match(html, /<span class="milestone" data-bbm-fact="true">MS 4<\/span>/);
  });

  it("fill the armed icon solid", () => {
    setBinding("BetterBuildingMenu", "ActivePrefabId", 2);

    assert.match(render(rows(2)), /class="icon armed"[^>]*data-catalog-entry="2"/);
  });

  it("give a label two icons' slots, its name over its count, and move it to the next line rather than split it", () => {
    const sections: CatalogSection[] = [
      { id: "group:0", kind: "group", label: "Props Park", labelId: "", start: 0, count: 12, collapsed: false },
      { id: "group:12", kind: "group", label: "Props Nature", labelId: "", start: 12, count: 2, collapsed: false },
    ];
    const html = render(rows(14), { sections });

    assert.match(html, /class="label stacked" style="left:1rem;top:4\.125rem;width:90rem;height:44rem"/);
    // The first label and 12 icons take 14 of the line's 15 slots: the second label starts the next line.
    assert.match(html, /class="label stacked" style="left:1rem;top:50\.125rem;width:90rem;height:44rem"/);
    assert.match(html, /left:93rem;top:50\.125rem;width:44rem;height:44rem[^>]*data-catalog-entry="13"/);
  });

  it("draw each name planned over two lines in place of the pill, for the icons with names", () => {
    const html = render([1, 2, 3].map((id) => entry(id, boulder(id))), { named: true });

    assert.equal(count(html, /data-bbm-pill="true"/), 0);
    assert.equal(count(html, /class="nameBand"/), 3);
    assert.match(html, /data-bbm-name="10"/);
  });
});
