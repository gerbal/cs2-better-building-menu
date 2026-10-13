import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { entry, renderHtml } from "../harness/render";
import { resetBindings } from "../harness/stubs/cs2-api";
import { bodyGrid } from "../../src/domain/bodyGeometry";
import { ListBody } from "../../src/mods/Bodies/ListBody";
import { useRevealEnterTarget } from "../../src/mods/BuildingCatalog/useRevealEnterTarget";

const globals = globalThis as unknown as Record<string, unknown>;

/**
 * A 144-tall scroller at y 100 holding rows of 27 on a 29.25 pitch, one of which is the target; frames
 * run when told. A row height of 0 is a row not laid out yet.
 */
function fakeList(targetLine: number, clientHeight = 144, id = 7) {
  const scroller = { clientHeight, scrollHeight: 2000, scrollTop: 0, parentElement: null as unknown, getBoundingClientRect: () => ({ top: 100, height: 144 }) };
  const shape = { height: 27 };
  const row = { parentElement: scroller, getBoundingClientRect: () => ({ top: 100 + targetLine * 29.25 - scroller.scrollTop, height: shape.height }) };
  const root = { scrollHeight: 144, clientHeight: 144, parentElement: null, querySelectorAll: (selector: string) => (selector === `[data-catalog-entry="${id}"]` ? [row] : []) };
  scroller.parentElement = root;
  return { ref: { current: root } as unknown as RefObject<HTMLElement>, scroller, shape };
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
    resetBindings();
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

  it("brings the best match back on screen when the keys move the target back to it", () => {
    const list = fakeList(0);
    act(() => { root = create(<Probe list={list.ref} target={7} step={1} />); });
    flush();

    // PageDown took the list on, and Up moved the target back to step 0, the list's first row.
    list.scroller.scrollTop = 300;
    act(() => root!.update(<Probe list={list.ref} target={7} step={0} />));
    flush();

    assert.equal(list.scroller.scrollTop, 0);
  });

  it("stops waiting for the row once the list goes", () => {
    const cancelled: unknown[] = [];
    globals.cancelAnimationFrame = (handle: unknown) => cancelled.push(handle);
    const list = fakeList(8);
    list.shape.height = 0;
    act(() => { root = create(<Probe list={list.ref} target={7} step={2} />); });
    // The first frame finds the row unmeasured and asks for another.
    frames.shift()!();
    act(() => root!.unmount());
    root = undefined;

    list.shape.height = 27;
    flush();

    assert.deepEqual(cancelled, [1]);
    assert.equal(list.scroller.scrollTop, 0);
  });

  it("brings a search's target on screen at the line the list draws it on, beside the first four, not the row order's", () => {
    // Six columns where the first step has four, two lines a screen. The list places a search's
    // ninth result on the first line, beside the first four; the row order would put it on the second.
    const grid = bodyGrid({ body: "list", boxWidth: 1091, bodyHeight: 56.5, textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0 });
    const entries = Array.from({ length: 30 }, (_, at) => entry(at + 1));
    const html = renderHtml(<ListBody entries={entries} grid={grid} typed="building" enterId={null} onPlace={() => undefined} footer={<div />} />);
    const top = Number(/top:([\d.]+)rem[^>]*data-catalog-entry="9"/.exec(html)?.[1]);
    assert.equal(top, 0);

    const list = fakeList(top / 29.25, 56.5, 9);
    list.scroller.scrollTop = 58.5;
    act(() => { root = create(<Probe list={list.ref} target={9} step={8} />); });
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
