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
const FAKED = ["window", "document", "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"] as const;
/** A rectangle as the page reports it, in pixels on a 1,080-pixel screen, where a rem is a pixel. */
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

describe("the hover card", () => {
  let root: ReactTestRenderer | undefined;
  let frames = new Map<number, () => void>();
  let timers = new Map<number, { run: () => void; delay: number }>();
  let handles = 0;
  const saved = new Map(FAKED.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  // The box at the first Width step, with one list plate drawn in it.
  const plate = { getBoundingClientRect: () => rect(612, 805, 171, 27.25) };
  const box = { getBoundingClientRect: () => rect(604, 746, 706, 208), querySelectorAll: () => [plate] };
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
  const point = (id = 1) => act(() => setPointed({ entry: entry(id, { name: "Elementary School" }), cell: { x: 612, y: 805, w: 171, h: 27.25 } }));
  const card = () => root!.root.findAll((node) => node.type === "div" && node.props["data-bbm-hovercard"] === "pointer");

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    frames = new Map();
    timers = new Map();
    handles = 0;
    globals.window = { innerWidth: 1920, innerHeight: 1080 };
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
