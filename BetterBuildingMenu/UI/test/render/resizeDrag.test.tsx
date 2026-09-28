import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import {
  ASSET_MENU_MAX_HEIGHT,
  ASSET_MENU_MIN_HEIGHT,
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
} from "../../src/domain/assetMenuLayout";
import { AssetMenuResizeHandle, useAssetMenuHeight, type AssetMenuHeight } from "../../src/mods/AssetMenuResizeHandle/AssetMenuResizeHandle";

// A frame clock the test advances by hand, so "one per frame" can be counted.
const globals = globalThis as unknown as Record<string, unknown>;
let frames: Array<(() => void) | null> = [];
const nextFrame = () => act(() => {
  const due = frames;
  frames = [];
  for (const callback of due) callback?.();
});

let assetMenu: AssetMenuHeight;
const Probe = () => {
  assetMenu = useAssetMenuHeight();
  return assetMenu.blocker;
};

const heights = () => triggers.filter((call) => call.name === "SetAssetMenuHeight").map((call) => call.args[0]);
const names = () => triggers.map((call) => call.name);

describe("dragging the asset menu's height", () => {
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
    act(() => assetMenu.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 14 }) } }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const move = (clientY: number) => act(() => root!.root.find((node) => node.props.onMouseMove).props.onMouseMove({ clientY }));
  const release = () => act(() => root!.root.find((node) => node.props.onMouseUp).props.onMouseUp());
  const expected = (clientY: number) => draggedAssetMenuHeight(clampAssetMenuHeight(420), 500, clientY, 1);

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
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
  });
});

describe("the asset menu's height between drags", () => {
  let root: ReactTestRenderer | undefined;
  const mount = () => act(() => {
    root = create(<Probe />);
  });
  const blocker = () => root!.root.findAll((node) => node.props.onMouseUp !== undefined);
  const begin = () => act(() => assetMenu.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 14 }) } }));

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
    setBinding("BetterBuildingMenu", "AssetMenuHeight", 5000);
    mount();
    assert.equal(assetMenu.height, ASSET_MENU_MAX_HEIGHT);

    act(() => setBinding("BetterBuildingMenu", "AssetMenuHeight", 10));
    assert.equal(assetMenu.height, ASSET_MENU_MIN_HEIGHT);
  });

  it("covers the screen only while a drag is on", () => {
    mount();
    assert.equal(assetMenu.blocker, null);
    assert.equal(assetMenu.isResizing, false);

    begin();
    assert.equal(blocker().length, 1);
    assert.equal(assetMenu.isResizing, true);

    act(() => blocker()[0].props.onMouseUp());
    assert.equal(assetMenu.blocker, null);
  });

  it("ends the drag when the mouse leaves the screen, as a release does", () => {
    mount();
    begin();
    act(() => blocker()[0].props.onMouseMove({ clientY: 480 }));
    act(() => blocker()[0].props.onMouseLeave());

    assert.deepEqual(names(), ["SetAssetMenuHeight", "CommitAssetMenuHeight"]);
    assert.equal(assetMenu.isResizing, false);
  });

  it("sends nothing after the asset menu goes away mid-drag", () => {
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
    create(<AssetMenuResizeHandle active={active} onBeginResize={onBeginResize} />);

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
