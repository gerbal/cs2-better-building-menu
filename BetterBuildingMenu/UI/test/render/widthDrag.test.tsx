import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { ASSET_MENU_CATALOG_DEFAULT, ASSET_MENU_CATALOG_FULL, ASSET_MENU_WIDTH_HANDLE_WIDTH, draggedCatalogWidth } from "../../src/domain/assetMenuLayout";
import {
  AssetMenuWidthHandle,
  DOUBLE_PRESS_MS,
  useAssetMenuWidthDrag,
  type AssetMenuWidthDrag,
} from "../../src/mods/AssetMenuWidthHandle/AssetMenuWidthHandle";

// The band at the reference resolution; with the pane shown the room is 1,091.
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
const Probe = ({ width, paneShown }: { width: number; paneShown: boolean }) => {
  drag = useAssetMenuWidthDrag({ menuWidth: width, bandWidth: BAND, paneShown }, () => clock);
  return drag.blocker;
};

const widths = () => triggers.filter((call) => call.name === "SetAssetMenuCatalogWidth").map((call) => call.args[0]);
const names = () => triggers.map((call) => call.name);
// The strip is drawn as many pixels wide as it is rem, so a pixel is a rem here.
const press = (clientX = 500, button = 0) =>
  act(() => drag.beginResize({ button, clientX, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_WIDTH }) } }));

describe("dragging the build menu's width", () => {
  let root: ReactTestRenderer | undefined;
  const mount = (width = 900, paneShown = true) => act(() => {
    root = create(<Probe width={width} paneShown={paneShown} />);
  });
  const blocker = () => root!.root.find((node) => node.props.onMouseUp !== undefined);
  const move = (clientX: number, buttons = 1) => act(() => blocker().props.onMouseMove({ clientX, buttons }));
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

  it("stores fill when the drag ends against the room", () => {
    mount();
    press();
    move(5000);
    release();

    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_DEFAULT]);
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
    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_DEFAULT]);
    assert.equal(drag.isResizing, false, "the second press starts no drag");
  });

  it("keeps a press that wobbles less than the threshold a click", () => {
    mount();
    press();
    move(502);
    release();

    assert.deepEqual(names(), []);
  });

  it("fills the whole band on a double press with the pane hidden", () => {
    mount(900, false);
    press();
    release();
    clock += 100;
    press();

    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_FULL]);
  });

  it("stores full when a drag with the pane hidden ends against the room", () => {
    mount(900, false);
    press();
    move(5000);
    release();

    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_FULL]);
  });

  it("starts a drag on a press that comes a double press's time after a click", () => {
    mount();
    press();
    release();
    clock += DOUBLE_PRESS_MS;
    press();

    assert.equal(drag.isResizing, true);
    assert.deepEqual(names(), []);
  });

  it("sends nothing after a release, not even the frame the drag had asked for", () => {
    mount();
    press();
    move(480);
    release();
    assert.deepEqual(names(), ["SetAssetMenuCatalogWidth", "CommitAssetMenuCatalogWidth"]);

    nextFrame();
    assert.equal(names().length, 2);
  });

  it("leaves a press with any button but the left alone", () => {
    mount();
    press(500, 2);

    assert.equal(drag.isResizing, false);
  });

  it("takes no right press for the first half of a double press", () => {
    mount();
    press(500, 2);
    clock += 100;
    press();

    assert.equal(drag.isResizing, true, "the left press starts a drag");
    assert.deepEqual(widths(), []);
  });

  it("ends the drag where the button was last held when a move says none is", () => {
    // A release the blocker never saw, such as one outside the window.
    mount();
    press();
    move(480);
    move(470, 0);

    assert.deepEqual(names(), ["SetAssetMenuCatalogWidth", "CommitAssetMenuCatalogWidth"]);
    assert.deepEqual(widths(), [880]);
    assert.equal(drag.isResizing, false);
  });

  it("fills the room on a double press even when the first click wobbled", () => {
    mount();
    press();
    move(502);
    release();
    clock += 300;
    press();

    assert.deepEqual(widths(), [ASSET_MENU_CATALOG_DEFAULT]);
    assert.equal(drag.isResizing, false);
  });

  it("does not take a drag pinned at the minimum for the first half of a double press", () => {
    mount(735);
    press();
    move(400);
    release();
    clock += 100;
    press();

    assert.equal(drag.isResizing, true, "the second press starts a drag");
    assert.ok(!widths().includes(ASSET_MENU_CATALOG_DEFAULT), "nothing filled");
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

  it("ends the drag where it was when the asset menu goes away mid-drag, as a release does", () => {
    // Closed by a key or by the game: saved, so the binding and the setting
    // agree and a later save of another setting has nothing to snap back.
    mount();
    press();
    move(480);
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(names(), ["SetAssetMenuCatalogWidth", "CommitAssetMenuCatalogWidth"]);
    assert.deepEqual(widths(), [880]);
    nextFrame();
    assert.equal(names().length, 2, "nothing after the menu has gone");
  });

  it("saves nothing when the asset menu goes away after a press that never moved", () => {
    mount();
    press();
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(names(), []);
  });
});

describe("the width strip", () => {
  const strip = (active: boolean, onBeginResize: (event: unknown) => void = () => undefined) =>
    create(<AssetMenuWidthHandle active={active} onBeginResize={onBeginResize} />);

  it("says what it is for in the game's own tooltip, and shows the grip pressed while a drag is on", () => {
    const idle = strip(false).root;
    // The game draws no title attribute, so the hint goes through its Tooltip.
    assert.equal(idle.findByProps({ className: "widthHandle" }).props.title, undefined);
    assert.deepEqual(idle.findByProps({ "data-tooltip": "true" }).children, ["Drag to resize, double-click to fill the space"]);
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
