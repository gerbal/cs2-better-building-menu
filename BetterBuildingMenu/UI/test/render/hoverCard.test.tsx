import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry, showBody } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { clearPointed, getAssetMenuView, resetAssetMenuView, setPointed } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { HoverCard } from "../../src/mods/HoverCard/HoverCard";

const globals = globalThis as unknown as Record<string, unknown>;
/** The globals the card reaches for, faked here and put back after each case. */
const FAKED = ["window", "document", "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "ResizeObserver"] as const;
/** A rectangle as the page reports it, in pixels on a 1,080-pixel screen, where a rem is a pixel. */
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

describe("the hover card", () => {
  let root: ReactTestRenderer | undefined;
  let frames = new Map<number, () => void>();
  let timers = new Map<number, { run: () => void; delay: number }>();
  let handles = 0;
  const saved = new Map(FAKED.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  /** The plates drawn, by entry id, where the page reports each: a test moves one as a scroll or a new page would. */
  let plates = new Map<number, { x: number; y: number }>();
  /** What the box and the window listen for, by event, and what the observer watches. */
  let heard = new Map<string, () => void>();
  let observers = new Set<() => void>();
  // The box at the first Width step, with list plates drawn in its body's scroller, 59 down and overflowing.
  const box = {
    getBoundingClientRect: () => rect(604, 746, 706, 208),
    scrollHeight: 208,
    clientHeight: 208,
    parentElement: null,
    querySelectorAll: (selector: string) => {
      const id = /data-catalog-entry="(\d+)"/.exec(selector)?.[1];
      return [...plates.keys()].filter((at) => id === undefined || at === Number(id)).map(plate);
    },
    addEventListener: (type: string, run: () => void) => heard.set(`box ${type}`, run),
    removeEventListener: (type: string) => heard.delete(`box ${type}`),
  };
  const scroller = { getBoundingClientRect: () => rect(604, 805, 706, 144.25), scrollHeight: 400, clientHeight: 144.25, parentElement: box };
  const plate = (id: number) => ({ getBoundingClientRect: () => rect(plates.get(id)!.x, plates.get(id)!.y, 171, 27.25), parentElement: scroller });
  const boxRef = { current: box } as unknown as RefObject<HTMLElement>;

  const mount = (hidden = false) =>
    act(() => {
      root = create(<HoverCard boxRef={boxRef} hidden={hidden} />, { createNodeMock: () => ({ getBoundingClientRect: () => rect(0, 0, 240, 98), children: [], clientWidth: 0 }) });
    });
  /** Runs the timers due by this many milliseconds; it runs no frame, which `frame` does, one at a time. */
  const wait = (ms: number) =>
    act(() => {
      for (const [handle, timer] of [...timers]) if (timer.delay <= ms) { timers.delete(handle); timer.run(); }
    });
  const frame = () =>
    act(() => {
      const due = [...frames.values()];
      frames.clear();
      due.forEach((run) => run());
    });
  const pointed = (id: number, name = "Elementary School") => ({ entry: entry(id, { name }), cell: { ...plates.get(id) ?? { x: 612, y: 805 }, w: 171, h: 27.25 } });
  const point = (id = 1, name?: string) => act(() => setPointed(pointed(id, name)));
  const card = () => root!.root.findAll((node) => node.type === "div" && node.props["data-bbm-hovercard"] === "pointer");
  /** Everything drawn, as one string: the card alone, mounted on its own. */
  const says = () => JSON.stringify(root!.toJSON());

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    frames = new Map();
    timers = new Map();
    handles = 0;
    plates = new Map([[1, { x: 612, y: 805 }]]);
    heard = new Map();
    observers = new Set();
    globals.window = {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: (type: string, run: () => void) => heard.set(`window ${type}`, run),
      removeEventListener: (type: string) => heard.delete(`window ${type}`),
    };
    globals.ResizeObserver = class {
      private readonly run: () => void;
      constructor(run: () => void) { this.run = run; observers.add(run); }
      observe() { return undefined; }
      disconnect() { observers.delete(this.run); }
    };
    globals.requestAnimationFrame = (run: () => void) => { handles += 1; frames.set(handles, run); return handles; };
    globals.cancelAnimationFrame = (handle: number) => frames.delete(handle);
    globals.setTimeout = (run: () => void, delay: number) => { handles += 1; timers.set(handles, { run, delay }); return handles; };
    globals.clearTimeout = (handle: number) => timers.delete(handle);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globals[name];
    }
  });

  it("shows the building pointed at once the pointer has rested the Hover delay, unseen until two frames have placed it above the box", () => {
    mount();
    point();
    assert.equal(card().length, 0);

    wait(150);
    assert.equal(card().length, 1);
    assert.match(String(card()[0].props.className), /unplaced/);

    frame();
    frame();
    // Its bottom 6 rem over the box's top, on the plate's left edge, in the box's own rem.
    assert.deepEqual(card()[0].props.style, { left: "8rem", top: "-104rem" });
    assert.doesNotMatch(String(card()[0].props.className), /unplaced/);
    // Cohtml never draws a title: the card says everything itself.
    assert.equal(root!.root.findAll((node) => typeof node.props.title === "string").length, 0);
  });

  it("waits the Hover delay knob's time", () => {
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: true, tabNames: true, hoverDelay: 400 });
    mount();
    point();

    wait(150);
    assert.equal(card().length, 0);
    wait(400);
    assert.equal(card().length, 1);
  });

  it("goes at once when the pointer leaves, and while a list is open draws none", () => {
    mount();
    point();
    wait(150);
    // The leave the bodies send, for the cell pointed at.
    act(() => clearPointed(1));
    assert.equal(card().length, 0);

    act(() => root!.update(<HoverCard boxRef={boxRef} hidden />));
    point(2);
    wait(150);
    assert.equal(card().length, 0);
  });

  it("goes at once when the pointer crosses to the next cell, and says that one once it has rested there", () => {
    plates.set(2, { x: 785, y: 805 });
    mount();
    point(1);
    wait(150);
    assert.match(says(), /Elementary School/);

    // React sends a cell's leave and the next one's enter from one mouseout, in one batch.
    act(() => {
      clearPointed(1);
      setPointed(pointed(2, "High School"));
    });
    assert.equal(card().length, 0);

    wait(150);
    assert.match(says(), /High School/);
  });

  it("counts only the cells drawn in the body's field, so a plate scrolled away above the body moves no card", () => {
    // Scrolled out above the body, over the box's top edge, where the card's first place is.
    plates.set(9, { x: 612, y: 690 });
    mount();
    point();
    wait(150);
    frame();
    frame();

    assert.deepEqual(card()[0].props.style, { left: "8rem", top: "-104rem" });
  });

  for (const [trigger, run] of [
    ["a wheel over the box", () => heard.get("box wheel")!()],
    ["a screen resize", () => heard.get("window resize")!()],
    ["the box or the card resizing", () => observers.forEach((run) => run())],
  ] as const) {
    it(`places itself again on ${trigger}, against the pointed cell where it is drawn now`, () => {
      mount();
      point();
      wait(150);
      frame();
      frame();
      assert.equal(card()[0].props.style.left, "8rem");

      plates.set(1, { x: 785, y: 805 });
      act(() => run());
      frame();
      frame();

      assert.equal(card()[0].props.style.left, "181rem");
    });
  }

  it("says the page's own building and places itself again when the page changes under a resting pointer", () => {
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1, { name: "Elementary School" })]));
    mount();
    point();
    wait(150);
    frame();
    frame();
    assert.match(says(), /¢1\D?000"/);

    // A new page puts the building, still drawn under the pointer, in another slot, at a new cost.
    plates.set(1, { x: 785, y: 805 });
    act(() => setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(2), entry(1, { name: "Elementary School", constructionCost: 2000 })])));
    frame();
    frame();

    assert.match(says(), /¢2\D?000"/);
    assert.equal(card()[0].props.style.left, "181rem");
  });

  it("draws the game's detail slot, the game's card beside a 150 picture, above the box at its left edge", () => {
    setBinding("BetterBuildingMenu", "AssetMenuHoverCard", "slot");
    mount();
    point();
    wait(150);
    const slot = () => root!.root.findAll((node) => node.type === "div" && node.props["data-bbm-hovercard"] === "slot");

    assert.equal(slot().length, 1);
    assert.equal(root!.root.findAll((node) => node.props.className === "cardName")[0].children.join(""), "Elementary School");
    frame();
    frame();
    // The node mock draws it 98 tall: its bottom 6 rem over the box, at the box's left edge.
    assert.deepEqual(slot()[0].props.style, { left: "0rem", top: "-104rem" });
    // No cell's marks, which the drawn-cells reading and the body's scroller walk find cells by.
    assert.equal(slot()[0].findAll((node) => node.props["data-catalog-entry"] !== undefined || node.props["data-bbm-item"] !== undefined).length, 0);
  });

  it("draws a slot card's footprints and packs with no title, which Cohtml never draws", () => {
    setBinding("BetterBuildingMenu", "AssetMenuHoverCard", "slot");
    mount();
    act(() => setPointed({
      entry: entry(1, { name: "Elementary School", assetPacks: ["Modern Architecture"], footprints: [{ width: 2, depth: 3 }] }),
      cell: { x: 612, y: 805, w: 171, h: 27.25 },
    }));
    wait(150);

    assert.equal(root!.root.findAll((node) => typeof node.props["aria-label"] === "string" && node.props["aria-label"] === "2 by 3").length, 1);
    assert.match(says(), /Modern Architecture/);
    assert.equal(root!.root.findAll((node) => typeof node.props.title === "string").length, 0);
  });

  it("draws no card for Status line only, whose readout says the building", () => {
    setBinding("BetterBuildingMenu", "AssetMenuHoverCard", "status");
    mount();
    point();
    wait(150);

    assert.equal(card().length, 0);
  });

  it("goes when the pointed tile goes from under a resting pointer, as typing turns the tiles into the list", () => {
    // A cell that goes sends no leave: it takes its own building away as it goes.
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
    showBody("tiles");
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2), entry(3)]));
    act(() => {
      root = create(
        <div>
          <BuildingCatalogComponent />
          <HoverCard boxRef={boxRef} hidden={false} />
        </div>,
        { createNodeMock: () => ({ getBoundingClientRect: () => rect(0, 0, 240, 98), children: [], clientWidth: 0 }) },
      );
    });
    const [tile] = root!.root.findAll((node) => node.props["data-catalog-entry"] === 2 && typeof node.props.onMouseEnter === "function");
    act(() => tile.props.onMouseEnter({ currentTarget: null }));
    wait(150);
    assert.equal(card().length, 1);

    act(() => setBinding("BetterBuildingMenu", "CurrentSearch", "four"));

    assert.match(String(root!.root.findAll((node) => node.props["data-bbm-view"] !== undefined)[0]?.props["data-bbm-view"]), /list/);
    assert.equal(getAssetMenuView().pointed, null);
    assert.equal(card().length, 0);
  });

  it("leaves nothing pointed at once the menu closes", () => {
    mount();
    point();
    act(() => root!.unmount());
    root = undefined;

    assert.equal(getAssetMenuView().pointed, null);
  });
});
