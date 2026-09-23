import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import {
  BUILDING_LENS_MAX_HEIGHT,
  BUILDING_LENS_MIN_HEIGHT,
  clampBuildingLensHeight,
  draggedBuildingLensHeight,
} from "../../src/domain/buildingLensLayout";
import { LensResizeHandle, useLensPanelHeight, type LensPanelHeight } from "../../src/mods/LensResizeHandle/LensResizeHandle";

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

describe("the panel's height between drags", () => {
  let root: ReactTestRenderer | undefined;
  const mount = () => act(() => {
    root = create(<Probe />);
  });
  const blocker = () => root!.root.findAll((node) => node.props.onMouseUp !== undefined);
  const begin = () => act(() => panel.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 14 }) } }));

  beforeEach(() => {
    resetBindings();
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) frames[handle - 1] = null;
    };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("is the saved height, held inside what the layout can take", () => {
    setBinding("BetterBuildingMenu", "BuildingLensPanelHeight", 5000);
    mount();
    assert.equal(panel.height, BUILDING_LENS_MAX_HEIGHT);

    act(() => setBinding("BetterBuildingMenu", "BuildingLensPanelHeight", 10));
    assert.equal(panel.height, BUILDING_LENS_MIN_HEIGHT);
  });

  it("covers the screen only while a drag is on", () => {
    mount();
    assert.equal(panel.blocker, null);
    assert.equal(panel.isResizing, false);

    begin();
    assert.equal(blocker().length, 1);
    assert.equal(panel.isResizing, true);

    act(() => blocker()[0].props.onMouseUp());
    assert.equal(panel.blocker, null);
  });

  it("ends the drag when the mouse leaves the screen, as a release does", () => {
    mount();
    begin();
    act(() => blocker()[0].props.onMouseMove({ clientY: 480 }));
    act(() => blocker()[0].props.onMouseLeave());

    assert.deepEqual(names(), ["SetBuildingLensPanelHeight", "CommitBuildingLensPanelHeight"]);
    assert.equal(panel.isResizing, false);
  });

  it("sends nothing after the panel goes away mid-drag", () => {
    mount();
    begin();
    act(() => blocker()[0].props.onMouseMove({ clientY: 480 }));
    act(() => root!.unmount());
    root = undefined;

    nextFrame();
    assert.deepEqual(names(), []);
  });
});

describe("the resize strip", () => {
  const strip = (active: boolean, onBeginResize: (event: unknown) => void = () => undefined) =>
    create(<LensResizeHandle active={active} onBeginResize={onBeginResize} />);

  it("says what it is for, and shows the grip pressed while a drag is on", () => {
    const idle = strip(false).root;
    assert.equal(idle.findByProps({ className: "resizeHandle" }).props.title, "Drag to resize");
    assert.equal(idle.findAll((node) => node.props.className === "resizeGrip").length, 1);

    assert.equal(strip(true).root.findAll((node) => node.props.className === "resizeGrip resizeGripActive").length, 1);
  });

  it("starts the drag on a press", () => {
    const pressed: unknown[] = [];
    const event = { clientY: 12 };
    strip(false, (received) => pressed.push(received)).root.findByProps({ className: "resizeHandle" }).props.onMouseDown(event);

    assert.deepEqual(pressed, [event]);
  });
});
