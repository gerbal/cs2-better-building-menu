import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { clampBuildingLensHeight, draggedBuildingLensHeight } from "../../src/domain/buildingLensLayout";
import { useLensPanelHeight, type LensPanelHeight } from "../../src/mods/LensResizeHandle/LensResizeHandle";

// A frame clock the test advances by hand, so "one per frame" can be counted.
const globals = globalThis as unknown as Record<string, unknown>;
let frames: Array<(() => void) | null> = [];
const nextFrame = () => act(() => {
  const due = frames;
  frames = [];
  for (const callback of due) callback?.();
});

let panel: LensPanelHeight;
const Probe = () => {
  panel = useLensPanelHeight();
  return panel.blocker;
};

const heights = () => triggers.filter((call) => call.name === "SetBuildingLensPanelHeight").map((call) => call.args[0]);
const names = () => triggers.map((call) => call.name);

describe("dragging the panel's height", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) frames[handle - 1] = null;
    };
    act(() => {
      root = create(<Probe />);
    });
    // The strip is drawn 14px tall, so a pixel is a rem here.
    act(() => panel.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 14 }) } }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const move = (clientY: number) => act(() => root!.root.find((node) => node.props.onMouseMove).props.onMouseMove({ clientY }));
  const release = () => act(() => root!.root.find((node) => node.props.onMouseUp).props.onMouseUp());
  const expected = (clientY: number) => draggedBuildingLensHeight(clampBuildingLensHeight(420), 500, clientY, 1);

  it("sends one height per frame, the latest", () => {
    move(490);
    move(480);
    move(470);
    assert.deepEqual(heights(), [], "nothing before the frame");

    nextFrame();

    assert.deepEqual(heights(), [expected(470)]);
  });

  it("sends where the drag ended before it commits", () => {
    move(490);
    nextFrame();
    move(460);
    release();

    assert.deepEqual(heights(), [expected(490), expected(460)]);
    assert.equal(names().at(-1), "CommitBuildingLensPanelHeight");
  });
});
