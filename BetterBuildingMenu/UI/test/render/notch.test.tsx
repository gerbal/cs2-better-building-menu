import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { FakeElement } from "../harness/fakeElement";
import { Notch } from "../../src/mods/Notch/Notch";

const globals = globalThis as unknown as Record<string, unknown>;
/** A rem in a 720-pixel-tall page, as the game's 1280 × 720 UI draws it. */
const px = (rem: number) => (rem * 720) / 1080;

const LIT = ".vanilla-toolbarButtonStrip button.selected";

describe("the notch", () => {
  let root: ReactTestRenderer | undefined;
  let frames: Array<() => void> = [];
  let toolbar = new FakeElement(["vanilla-toolbar"]);
  // The box at its first step.
  const box = new FakeElement(["toolContainer"], [], { left: px(604), width: px(706) });
  const saved = {
    document: globals.document,
    window: globals.window,
    HTMLElement: globals.HTMLElement,
    requestAnimationFrame: globals.requestAnimationFrame,
    cancelAnimationFrame: globals.cancelAnimationFrame,
  };

  /** The frames the notch asks for, run as the engine runs them, up to a bound. */
  const flush = () =>
    act(() => {
      for (let pass = 0; pass < 30 && frames.length > 0; pass++) {
        const due = frames;
        frames = [];
        due.forEach((frame) => frame());
      }
    });
  /** The bar lights a button whose left edge is at this x, in rem. */
  const light = (leftRem: number) => {
    toolbar.found[LIT] = new FakeElement(["selected"], [], { left: px(leftRem), width: px(38.4) });
  };
  const drawn = () => root!.root.findAll((node) => node.type === "div" && node.props.className === "notch");
  const left = () => Number.parseFloat(String(drawn()[0]?.props.style?.left));

  beforeEach(() => {
    resetBindings();
    frames = [];
    toolbar = new FakeElement(["vanilla-toolbar"]);
    const screen = new FakeElement(["vanilla-gameMainScreen"], [toolbar]);
    globals.HTMLElement = FakeElement;
    globals.window = { innerHeight: 720 };
    globals.document = { querySelector: (selector: string) => (selector === ".vanilla-gameMainScreen" ? screen : null) };
    globals.requestAnimationFrame = (frame: () => void) => frames.push(frame);
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  const mount = () =>
    act(() => {
      root = create(<Notch boxRef={{ current: box } as unknown as RefObject<HTMLElement>} boxWidth={706} offset={0} />);
    });

  it("hangs under the lit bar button once a frame has read the bar", () => {
    light(900.2);
    mount();
    assert.equal(drawn().length, 0, "nothing before a frame reads the bar");

    flush();

    assert.equal(drawn().length, 1);
    assert.ok(Math.abs(left() - 296.2) < 1e-6, `left ${left()}`);
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
    assert.ok(Math.abs(left() - 496) < 1e-6, `left ${left()}`);
  });
});
