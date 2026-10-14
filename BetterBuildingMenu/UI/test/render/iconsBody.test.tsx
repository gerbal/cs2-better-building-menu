import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { huggingNames, linesOf, plannedNames, settleFrames } from "../harness/huggingNames";
import { assertCellsTellThePointer } from "../harness/pointing";
import { count, entry, renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "../../src/domain/buildingCatalog";
import { planName } from "../../src/domain/namePlan";
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

  it("tell the hover card the icon the pointer enters and leaves, and the icon that goes from under it", () => {
    assertCellsTellThePointer((entries) => <IconsBody entries={entries} grid={grid()} onPlace={() => undefined} />);
  });

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

  it("plan a label's name in the lines its plate holds over its count: one at 125% and 150% text", () => {
    const sections: CatalogSection[] = [{ id: "group:0", kind: "group", label: "Props Nature", labelId: "", start: 0, count: 2, collapsed: false }];

    for (const scale of [1.25, 1.5]) {
      setBinding("options", "textScale", scale);
      assert.match(render(rows(2), { sections }), /<span class="planned labelText"><span class="line">[^<]*<\/span><\/span><span class="labelCount">2<\/span>/, `at ${scale}`);
    }
  });

  it("keep a locked family member's lock clear of its pill, its word whole or left off, at every text scale", () => {
    const locked = (id: number, milestone: number) => entry(id, { ...boulder(id), isLocked: true, unlockMilestone: milestone } as Partial<BuildingCatalogEntry>);
    const at = (scale: number) => {
      setBinding("options", "textScale", scale);
      return render([locked(1, 4), locked(2, 0)]);
    };

    const normal = at(1);
    assert.equal(count(normal, /data-bbm-pill="true"/), 2);
    assert.match(normal, /<span class="milestone" data-bbm-fact="true">Locked<\/span>/);
    for (const scale of [1.25, 1.5]) {
      const large = at(scale);
      // The pill gives way to the lock and "MS 4"; "Locked" is wider than the icon, so that lock stands
      // alone, and the pill under it clears it.
      assert.equal(count(large, /data-bbm-pill="true"/), 1, `at ${scale}`);
      assert.match(large, /data-catalog-entry="2"[^>]*>(?:(?!<\/button>).)*data-bbm-pill="true">02</, `at ${scale}`);
      assert.match(large, /<span class="milestone" data-bbm-fact="true">MS 4<\/span>/, `at ${scale}`);
      assert.equal(count(large, /data-bbm-fact="true"/), 1, `at ${scale}`);
      assert.equal(count(large, /LockRaster\.png/), 2, `at ${scale}`);
    }
  });

  it("give up a band line under a locked icon's lock row at 150% text, for the icons with names", () => {
    setBinding("options", "textScale", 1.5);
    const html = render([entry(1, { ...boulder(1), isLocked: true, unlockMilestone: 4 } as Partial<BuildingCatalogEntry>)], { named: true });

    assert.match(html, /<span class="nameBand"><span class="planned"[^>]*>(<span class="line">[^<]*<\/span>){1}<\/span><\/span>/);
  });

  it("draw each name planned over two lines in place of the pill, for the icons with names", () => {
    const html = render([1, 2, 3].map((id) => entry(id, boulder(id))), { named: true });

    assert.equal(count(html, /data-bbm-pill="true"/), 0);
    assert.equal(count(html, /class="nameBand"/), 3);
    assert.match(html, /data-bbm-name="10"/);
  });
});

describe("the icons with names, as the game lays out a band", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const FAKED = ["window", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver"] as const;
  let root: ReactTestRenderer | undefined;
  let saved: Record<string, unknown>;
  const frames = new Map<number, () => void>();
  let handles = 0;

  beforeEach(() => {
    resetBindings();
    saved = Object.fromEntries(FAKED.map((name) => [name, globals[name]]));
    frames.clear();
    // A rem a pixel.
    globals.window = { innerHeight: 1080 };
    globals.requestAnimationFrame = (run: () => void) => { handles += 1; frames.set(handles, run); return handles; };
    globals.cancelAnimationFrame = (handle: number) => frames.delete(handle);
    globals.ResizeObserver = class { observe() { return undefined; } disconnect() { return undefined; } };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  for (const scale of [1, 1.3]) {
    it(`keep each name as planned in its band's room at ${scale * 100}% text, the band only as wide as its lines`, () => {
      setBinding("options", "textScale", scale);
      const names = ["Boulder 01", "Stone Head 03", "Concession Kiosk 2"];
      act(() => {
        root = create(<IconsBody entries={names.map((name, at) => entry(at + 1, { name }))} grid={grid({ textScale: scale })} onPlace={() => undefined} named />, { createNodeMock: huggingNames(() => root!) });
      });
      settleFrames(frames);

      const drawn = plannedNames(root!);
      assert.equal(drawn.length, names.length);
      for (const name of drawn) {
        const room = { width: name.props.width as number, lines: name.props.lines as number, font: name.props.font as number };
        assert.deepEqual(linesOf(name), planName(name.props.name as string, room, { keep: [""], typed: [""] }).lines, name.props.name as string);
        assert.ok(linesOf(name).length > 0, name.props.name as string);
      }
    });
  }
});
