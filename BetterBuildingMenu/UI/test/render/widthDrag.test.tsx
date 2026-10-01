import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { ASSET_MENU_CATALOG_FILL, draggedCatalogWidth } from "../../src/domain/assetMenuLayout";
import {
  AssetMenuWidthHandle,
  DOUBLE_PRESS_MS,
  useAssetMenuWidthDrag,
  type AssetMenuWidthDrag,
} from "../../src/mods/AssetMenuWidthHandle/AssetMenuWidthHandle";

// The band at the reference resolution; the pane is shown, so the room is 1,091.
const BAND = 1476;
const globals = globalThis as unknown as Record<string, unknown>;
let frames: Array<(() => void) | null> = [];
const nextFrame = () => act(() => {
  const due = frames;
  frames = [];
  for (const callback of due) callback?.();
});
let clock = 1000;

let drag: AssetMenuWidthDrag;
const Probe = ({ width, minWidth = 735 }: { width: number; minWidth?: number }) => {
  drag = useAssetMenuWidthDrag({ menuWidth: width, bandWidth: BAND, paneShown: true, minWidth }, () => clock);
  return drag.blocker;
};

const widths = () => triggers.filter((call) => call.name === "SetAssetMenuCatalogWidth").map((call) => call.args[0]);
const names = () => triggers.map((call) => call.name);
// The strip is drawn 10px wide, so a pixel is a rem here.
const press = (clientX = 500) => act(() => drag.beginResize({ clientX, currentTarget: { getBoundingClientRect: () => ({ width: 10 }) } }));

describe("dragging the build menu's width", () => {
  let root: ReactTestRenderer | undefined;
  const mount = (width = 900, minWidth = 735) => act(() => {
    root = create(<Probe width={width} minWidth={minWidth} />);
  });
  const blocker = () => root!.root.find((node) => node.props.onMouseUp !== undefined);
  const move = (clientX: number) => act(() => blocker().props.onMouseMove({ clientX }));
  const release = () => act(() => blocker().props.onMouseUp());

  beforeEach(() => {
    resetBindings();
    frames = [];
    clock = 1000;
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) frames[handle - 1] = null;
    };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("sends one width per frame, the latest", () => {
    mount();
    press();
    move(510);
    move(520);
    assert.deepEqual(widths(), [], "nothing before the frame");

    nextFrame();
    assert.deepEqual(widths(), [draggedCatalogWidth(900, 500, 520, BAND, true, 1)]);
  });

  it("sends where the drag ended, then commits", () => {
    mount();
    press();
    move(450);
    release();

    assert.deepEqual(widths(), [850]);
    assert.equal(names().at(-1), "CommitAssetMenuCatalogWidth");
  });

  it("stops at the minimum it is given, as the table's is", () => {
    mount(1000, 944);
    press();
    move(-5000);
    release();

    assert.deepEqual(widths(), [944]);
  });

  it("stores fill when the drag ends against the room", () => {
    mount();
    press();
    move(5000);
    release();

    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_FILL]);
  });

  it("changes nothing on a press and release that never moved", () => {
    mount(1091);
    press();
    release();

    assert.deepEqual(names(), []);
  });

  it("fills the room on a second press soon after the first", () => {
    mount();
    press();
    release();
    clock += DOUBLE_PRESS_MS - 1;
    press();

    assert.deepEqual(names(), ["SetAssetMenuCatalogWidth", "CommitAssetMenuCatalogWidth"]);
    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_FILL]);
    assert.equal(drag.isResizing, false, "the second press starts no drag");
  });

  it("starts a new drag on a press soon after a drag that moved", () => {
    mount();
    press();
    move(450);
    release();
    clock += 100;
    press();

    assert.equal(drag.isResizing, true);
  });

  it("ends the drag when the mouse leaves the screen, as a release does", () => {
    mount();
    press();
    move(450);
    act(() => blocker().props.onMouseLeave());

    assert.deepEqual(names(), ["SetAssetMenuCatalogWidth", "CommitAssetMenuCatalogWidth"]);
    assert.equal(drag.isResizing, false);
  });

  it("sends nothing after the asset menu goes away mid-drag", () => {
    mount();
    press();
    move(480);
    act(() => root!.unmount());
    root = undefined;

    nextFrame();
    assert.deepEqual(names(), []);
  });
});

describe("the width strip", () => {
  const strip = (active: boolean, onBeginResize: (event: unknown) => void = () => undefined) =>
    create(<AssetMenuWidthHandle active={active} onBeginResize={onBeginResize} />);

  it("says what it is for, and shows the grip pressed while a drag is on", () => {
    const idle = strip(false).root;
    assert.equal(idle.findByProps({ className: "widthHandle" }).props.title, "Drag to resize, double-click to fill the space");
    assert.equal(idle.findAll((node) => node.props.className === "widthGrip").length, 1);

    assert.equal(strip(true).root.findAll((node) => node.props.className === "widthGrip widthGripActive").length, 1);
  });

  it("starts the drag on a press", () => {
    const pressed: unknown[] = [];
    const event = { clientX: 12 };
    strip(false, (received) => pressed.push(received)).root.findByProps({ className: "widthHandle" }).props.onMouseDown(event);

    assert.deepEqual(pressed, [event]);
  });
});
