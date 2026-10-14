import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { FakeElement } from "../harness/fakeElement";
import { Notch, type NotchProps } from "../../src/mods/Notch/Notch";

const globals = globalThis as unknown as Record<string, unknown>;
const LIT = ".vanilla-toolbarButtonStrip button.selected";
/** The globals the notch reaches for, faked here and put back after each case. */
const FAKED = ["document", "window", "HTMLElement", "requestAnimationFrame", "cancelAnimationFrame"] as const;

describe("the notch", () => {
  let root: ReactTestRenderer | undefined;
  /** The page as the game's 1280 × 720 UI draws it: a screen is 1,080 rem tall. */
  let page = { innerWidth: 1280, innerHeight: 720 };
  /** The frame clock: each queued frame by its handle, and how many frames have run. */
  let queued = new Map<number, () => void>();
  let handles = 0;
  let ran = 0;
  let toolbar = new FakeElement(["vanilla-toolbar"]);
  let box = new FakeElement(["toolContainer"]);
  let boxRef = { current: box } as unknown as RefObject<HTMLElement>;
  let props: Omit<NotchProps, "boxRef"> = { boxWidth: 706, offset: 0 };
  const saved = new Map(FAKED.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

  /** A rem in pixels on the page as it stands. */
  const px = (rem: number) => (rem * page.innerHeight) / 1080;
  /** Runs the queued frames once, as the engine runs one frame. */
  const step = () =>
    act(() => {
      const due = [...queued.values()];
      queued.clear();
      due.forEach((frame) => {
        ran += 1;
        frame();
      });
    });
  /** Runs frames until none is queued, up to a bound well past the notch's own. */
  const flush = () => {
    for (let pass = 0; pass < 100 && queued.size > 0; pass++) step();
  };
  /** The bar lights a button whose left edge is at this x, in rem. */
  const light = (leftRem: number) => {
    toolbar.found[LIT] = new FakeElement(["selected"], [], { left: px(leftRem), width: px(38.4) });
  };
  /** The box's rectangle: its left edge and its width, in rem. */
  const place = (leftRem: number, widthRem: number) => {
    box.rect = { left: px(leftRem), width: px(widthRem) };
  };
  const drawn = () => root!.root.findAll((node) => node.type === "div" && node.props.className === "notch");
  const left = () => Number.parseFloat(String(drawn()[0]?.props.style?.left));
  const near = (expected: number) => assert.ok(drawn().length === 1 && Math.abs(left() - expected) < 1e-6, `left ${left()}, not ${expected}`);

  beforeEach(() => {
    resetBindings();
    page = { innerWidth: 1280, innerHeight: 720 };
    queued = new Map();
    handles = 0;
    ran = 0;
    props = { boxWidth: 706, offset: 0 };
    toolbar = new FakeElement(["vanilla-toolbar"]);
    box = new FakeElement(["toolContainer"]);
    boxRef = { current: box } as unknown as RefObject<HTMLElement>;
    place(604, 706);
    const screen = new FakeElement(["vanilla-gameMainScreen"], [toolbar]);
    globals.HTMLElement = FakeElement;
    globals.window = page;
    globals.document = { querySelector: (selector: string) => (selector === ".vanilla-gameMainScreen" ? screen : null) };
    globals.requestAnimationFrame = (frame: () => void) => {
      handles += 1;
      queued.set(handles, frame);
      return handles;
    };
    globals.cancelAnimationFrame = (handle: number) => queued.delete(handle);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    // Put back what was there, and leave nothing behind where nothing was.
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globals[name];
    }
  });

  const element = () => <Notch boxRef={boxRef} {...props} />;
  const mount = () =>
    act(() => {
      root = create(element());
    });
  /** The box re-renders the notch with these props. */
  const update = (changed: Partial<typeof props> = {}) => {
    props = { ...props, ...changed };
    act(() => root!.update(element()));
  };

  it("hangs under the lit bar button once a frame has read the bar", () => {
    light(900.2);
    mount();
    assert.equal(drawn().length, 0, "nothing before a frame reads the bar");

    flush();

    near(296.2);
  });

  it("draws nothing while no bar button is lit", () => {
    mount();
    flush();

    assert.equal(drawn().length, 0);
  });

  it("follows the lit button to the next menu", () => {
    light(900.2);
    mount();
    flush();

    light(1100);
    act(() => setBinding("toolbar", "selectedAssetMenu", { index: 7, version: 1 }));
    flush();

    // The button's left less the box's: its 38.4 is the notch's top.
    near(496);
  });

  it("reads the bar for ten frames after a change, then stops", () => {
    light(900.2);
    mount();
    flush();

    assert.equal(queued.size, 0, "no frame left queued");
    assert.equal(ran, 10);
  });

  it("leaves no frame queued once the box goes", () => {
    light(900.2);
    mount();
    step();
    assert.equal(queued.size, 1, "still reading");

    act(() => root!.unmount());
    root = undefined;

    assert.equal(queued.size, 0);
  });

  it("keeps a notch while the bar relights, and clears it once ten frames find no lit button", () => {
    light(900.2);
    mount();
    flush();

    delete toolbar.found[LIT];
    act(() => setBinding("toolbar", "selectedAssetMenu", { index: 7, version: 1 }));
    step();
    near(296.2);

    flush();

    assert.equal(drawn().length, 0);
  });

  it("stays in the box's span as its rectangle measures it", () => {
    // Drawn narrower than its width says: the measured span holds the notch.
    place(604, 500);
    light(1400);
    mount();
    flush();

    near(500 - 38.4);
  });

  const moves: Array<[string, () => void]> = [
    ["the box's width", () => {
      place(604, 800);
      update({ boxWidth: 800 });
    }],
    ["the box's place", () => {
      place(614, 706);
      light(1110);
      update({ offset: 10 });
    }],
    ["the text scale", () => act(() => setBinding("options", "textScale", 1.25))],
    ["the screen's height", () => {
      page.innerHeight = 1080;
      place(604, 706);
      light(1100);
      update();
    }],
    ["the screen's width", () => {
      page.innerWidth = 1920;
      update();
    }],
  ];

  for (const [change, move] of moves) {
    it(`reads the bar again when ${change} changes`, () => {
      light(900.2);
      mount();
      flush();

      // The bar moves under a notch that has stopped reading: nothing follows it yet.
      light(1100);
      update();
      flush();
      near(296.2);

      move();
      flush();

      near(496);
    });
  }
});
