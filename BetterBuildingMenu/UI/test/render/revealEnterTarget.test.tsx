import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useRevealEnterTarget } from "../../src/mods/BuildingCatalog/useRevealEnterTarget";

const globals = globalThis as unknown as Record<string, unknown>;

/** A 144-tall scroller at y 100 holding rows of 27 on a 29.25 pitch, one of which is the target; frames run when told. */
function fakeList(targetLine: number) {
  const scroller = { clientHeight: 144, scrollHeight: 2000, scrollTop: 0, parentElement: null as unknown, getBoundingClientRect: () => ({ top: 100, height: 144 }) };
  const row = { parentElement: scroller, getBoundingClientRect: () => ({ top: 100 + targetLine * 29.25 - scroller.scrollTop, height: 27 }) };
  const root = { scrollHeight: 144, clientHeight: 144, parentElement: null, querySelectorAll: (selector: string) => (selector === '[data-catalog-entry="7"]' ? [row] : []) };
  scroller.parentElement = root;
  return { ref: { current: root } as unknown as RefObject<HTMLElement>, scroller };
}

const Probe = ({ list, target, step }: { list: RefObject<HTMLElement>; target: number | null; step: number }) => {
  useRevealEnterTarget(list, target, step);
  return null;
};

describe("Enter's target brought on screen", () => {
  let root: ReactTestRenderer | undefined;
  let frames: (() => void)[] = [];
  let saved: Record<string, unknown>;

  beforeEach(() => {
    frames = [];
    saved = { requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  const flush = () => {
    while (frames.length > 0) frames.shift()!();
  };

  it("scrolls a moved target below the screen up into it, its bottom at the list's foot", () => {
    const list = fakeList(8);
    act(() => { root = create(<Probe list={list.ref} target={7} step={3} />); });
    flush();

    // Line 8's bottom is 8 × 29.25 + 27 = 261 below the top; the screen shows 144 of it.
    assert.equal(list.scroller.scrollTop, 117);
  });

  it("leaves the list alone for the best match itself, which a typed search puts on top", () => {
    const list = fakeList(8);
    act(() => { root = create(<Probe list={list.ref} target={7} step={0} />); });
    flush();

    assert.equal(list.scroller.scrollTop, 0);
  });

  it("leaves the list alone for a target the window does not hold", () => {
    const list = fakeList(8);
    act(() => { root = create(<Probe list={list.ref} target={99} step={2} />); });
    flush();

    assert.equal(list.scroller.scrollTop, 0);
  });
});
