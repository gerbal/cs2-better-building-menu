import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Profiler } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { linesOf, plannedNames } from "../harness/huggingNames";
import { entry } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { bodyGrid, nearLines, screenSlots, type BodyGridInput } from "../../src/domain/bodyGeometry";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { planName, plansWorkedOut } from "../../src/domain/namePlan";
import { bandWork } from "../../src/domain/tileBands";
import { IconsBody } from "../../src/mods/Bodies/IconsBody";
import { ListBody } from "../../src/mods/Bodies/ListBody";
import { namesDrawn } from "../../src/mods/Bodies/PlannedName";
import { TilesBody } from "../../src/mods/Bodies/TilesBody";

/** The base game's names, each with its distinguishing word in its menu. */
const names: [string, string][] = JSON.parse(readFileSync(new URL("../fixtures/baseGameNames.json", import.meta.url), "utf8"));

/**
 * `count` rows of the base game's names, each made its own with a word after it, so no two plan alike
 * and no plan of another case is found kept; `typed` keeps only the names holding it, as a search would.
 */
const result = (count: number, mark: string, typed = ""): BuildingCatalogEntry[] => {
  const matching = names.filter(([name]) => name.toLowerCase().includes(typed));
  return Array.from({ length: count }, (_, at) => {
    const [name, distinctWord] = matching[at % matching.length];
    return entry(at + 1, { name: `${name} ${mark}${Math.floor(at / matching.length)}`, distinctWord, constructionCost: 12_500 });
  });
};

const at150 = (body: "list" | "tiles", over: Partial<BodyGridInput> = {}) => bodyGrid({
  body, boxWidth: 706, bodyHeight: 144.25, textScale: 1.5, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, ...over,
});

describe("the names planned for a long result: those on or near the screen", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const FAKED = ["window", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver"] as const;
  let root: ReactTestRenderer | undefined;
  let saved: Record<string, unknown>;
  const frames = new Map<number, () => void>();
  let handles = 0;
  /** How far the body's scroller is scrolled, in pixels, a rem a pixel. */
  let scrollTop = 0;
  /** The body's element, under which the scroller is found from the last row, as the game lays it out. */
  const scroller = { scrollHeight: 100_000, clientHeight: 144, get scrollTop() { return scrollTop; }, parentElement: null as unknown };
  const bodyElement = { querySelectorAll: () => [{ parentElement: scroller }] };
  scroller.parentElement = bodyElement;
  const mock = (element: { type: unknown; props: Record<string, unknown> }) =>
    (element.type === "div" && typeof element.props["data-bbm-view"] === "string" ? bodyElement : null);
  /** The page's clock, which the body's scroll reading waits on. */
  let clock = 0;
  const now = Date.now;
  /** Runs the frames due once, a tenth of a second on: the body reads its scroll. */
  const frame = () => {
    clock += 100;
    const due = [...frames.values()];
    frames.clear();
    act(() => due.forEach((run) => run()));
  };

  beforeEach(() => {
    resetBindings();
    setBinding("options", "textScale", 1.5);
    saved = Object.fromEntries(FAKED.map((name) => [name, globals[name]]));
    frames.clear();
    scrollTop = 0;
    Date.now = () => clock;
    globals.window = { innerHeight: 1080 };
    globals.requestAnimationFrame = (run: () => void) => { handles += 1; frames.set(handles, run); return handles; };
    globals.cancelAnimationFrame = (handle: number) => frames.delete(handle);
    globals.ResizeObserver = class { observe() { return undefined; } disconnect() { return undefined; } };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
    Date.now = now;
  });

  it("plans only the names near the screen on a first keystroke over 741 rows at 150% text, about two screens, the page pass included", () => {
    const grid = at150("list");
    const rows = result(741, "Keystroke", "b");
    const before = plansWorkedOut();
    act(() => { root = create(<ListBody entries={rows} grid={grid} typed="b" enterId={rows[0].id} onPlace={() => undefined} />, { createNodeMock: mock }); });
    frame();

    // The plates near the top: two screens and a half, as the lines near the screen move by half screens.
    const near = nearLines(grid, 0).to * grid.cols;
    const planned = plansWorkedOut() - before;
    assert.ok(near <= 3 * screenSlots(grid), `${near} plates near the top`);
    assert.ok(planned <= 1.5 * near, `${planned} plans for ${near} plates near the screen`);
    // Every plate still draws a name, none wider than its room.
    assert.equal(plannedNames(root!).filter((name) => linesOf(name).length > 0).length, rows.length);
  });

  it("plans the names a scroll brings near the screen, as the planner plans them", () => {
    const grid = at150("list");
    const rows = result(300, "Scroll");
    act(() => { root = create(<ListBody entries={rows} grid={grid} enterId={null} onPlace={() => undefined} />, { createNodeMock: mock }); });
    frame();
    const last = () => plannedNames(root!).at(-1)!;
    const room = { width: last().props.width as number, lines: last().props.lines as number, font: last().props.font as number };
    const before = plansWorkedOut();
    const plan = planName(rows.at(-1)!.name, room, { keep: [rows.at(-1)!.distinctWord ?? ""], typed: [""] }).lines;
    assert.equal(plansWorkedOut(), before + 1, "the last row's name is not planned away from the screen");

    // To the end of the list.
    scrollTop = grid.y0 + grid.pitchY * Math.ceil(rows.length / grid.cols);
    frame();

    assert.deepEqual(linesOf(last()), plan);
  });

  it("works out a Load more step's tags and bands only for the tiles near the screen, in Plates at 150% text", () => {
    setBinding("BetterBuildingMenu", "AssetMenuLook", "plates");
    const grid = at150("tiles");
    const rows = result(1_700, "Load");
    act(() => { root = create(<TilesBody entries={rows.slice(0, 1_600)} grid={grid} onPlace={() => undefined} />, { createNodeMock: mock }); });
    // The player at the bottom of the 1,600 loaded, as a Load more asks.
    scrollTop = grid.y0 + grid.pitchY * (Math.ceil(1_600 / grid.cols) - grid.lines);
    frame();
    const [planned, worked] = [plansWorkedOut(), bandWork()];

    act(() => root!.update(<TilesBody entries={rows} grid={grid} onPlace={() => undefined} />));
    frame();

    // The tiles near the screen at most: a screen behind, the screen, a screen and a half ahead.
    const near = 3.5 * screenSlots(grid);
    assert.ok(bandWork().indexed - worked.indexed <= near, `${bandWork().indexed - worked.indexed} tiles indexed, ${near} near`);
    assert.ok(plansWorkedOut() - planned <= near, `${plansWorkedOut() - planned} plans, ${near} near`);
  });

  it("draws again on a move of the near window only the names that come near or go from it", () => {
    const grid = at150("list");
    const rows = result(600, "Move");
    act(() => { root = create(<ListBody entries={rows} grid={grid} enterId={null} onPlace={() => undefined} />, { createNodeMock: mock }); });
    frame();
    frame();
    const nearBefore = plannedNames(root!).map((name) => name.props.near);
    const before = namesDrawn();

    // Three half screens down: the window moves.
    scrollTop = grid.y0 + grid.pitchY * 3 * Math.ceil(grid.lines / 2);
    frame();
    frame();
    const moved = plannedNames(root!).filter((name, at) => name.props.near !== nearBefore[at]).length;
    // A plate that came near and was drawn alike draws again a frame on with the page pass's hints, twice,
    // as new hints start its room from the estimate again.
    const hinted = plannedNames(root!).filter((name, at) => name.props.near !== nearBefore[at] && name.props.apart !== undefined).length;

    assert.ok(moved > 0, "the window moved");
    assert.ok(namesDrawn() - before <= moved + 2 * hinted, `${namesDrawn() - before} names drawn again for ${moved} that came near or went, ${hinted} told apart`);
  });

  it("draws nothing again as icons without names scroll, and plans icons' names only near the screen", () => {
    const grid = bodyGrid({ body: "icons", boxWidth: 706, bodyHeight: 144.25, textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0 });
    const rows = result(1_200, "Icon");
    let commits = 0;
    const icons = (named: boolean) => <Profiler id="icons" onRender={() => { commits += 1; }}><IconsBody entries={rows} grid={grid} named={named} onPlace={() => undefined} /></Profiler>;
    act(() => { root = create(icons(false), { createNodeMock: mock }); });
    frame();
    const mounted = commits;

    scrollTop = grid.y0 + grid.pitchY * 20;
    frame();
    frame();
    assert.equal(commits, mounted, "no commit as the icons scroll");

    act(() => root!.unmount());
    scrollTop = 0;
    const before = plansWorkedOut();
    act(() => { root = create(icons(true), { createNodeMock: mock }); });
    frame();
    const near = nearLines(grid, 0).to * grid.cols;
    assert.ok(plansWorkedOut() - before <= near, `${plansWorkedOut() - before} plans for ${near} icons near the screen`);
  });

  it("plans the names on screen in the first frame a new result draws, the scroll back at its top, not a poll later", () => {
    const grid = at150("list");
    const body = (rows: BuildingCatalogEntry[]) => <ListBody entries={rows} grid={grid} enterId={null} onPlace={() => undefined} />;
    act(() => { root = create(body(result(300, "Before")), { createNodeMock: mock }); });
    scrollTop = grid.y0 + grid.pitchY * 40;
    frame();
    assert.equal(plannedNames(root!)[0].props.near, false, "the first plate is far from the screen");

    // A keystroke's new result, the scroller back at its top: drawn before any frame runs.
    scrollTop = 0;
    act(() => root!.update(body(result(300, "After"))));

    assert.equal(plannedNames(root!)[0].props.near, true, "the first plate, on screen, is planned");
  });
});
