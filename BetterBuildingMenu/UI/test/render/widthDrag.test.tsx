import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { ASSET_MENU_WIDTH_HANDLE_REACH, ASSET_MENU_WIDTH_HANDLE_WIDTH } from "../../src/domain/assetMenuLayout";
import { snapTargets, type WidthSnap } from "../../src/domain/widthSteps";
import {
  AssetMenuWidthHandle,
  AssetMenuWidthReach,
  useAssetMenuWidthDrag,
  type AssetMenuWidthDrag,
} from "../../src/mods/AssetMenuWidthHandle/AssetMenuWidthHandle";

// 16:9 at the game's own text size: beside the pane the edge snaps to 706, 893 and 1,091.
const BESIDE_THE_PANE = snapTargets({ aspect: 16 / 9, textScale: 1, paneShown: true });
const PANE_HIDDEN = snapTargets({ aspect: 16 / 9, textScale: 1, paneShown: false });
const globals = globalThis as unknown as Record<string, unknown>;
let frames: Array<(() => void) | null> = [];
const nextFrame = () => act(() => {
  const due = frames;
  frames = [];
  for (const callback of due) callback?.();
});

let drag: AssetMenuWidthDrag;
const Probe = ({ width, step, snaps }: { width: number; step: number; snaps: readonly WidthSnap[] }) => {
  drag = useAssetMenuWidthDrag({ menuWidth: width, step, snaps });
  return drag.blocker;
};

const steps = () => triggers.filter((call) => call.name === "SetAssetMenuWidthStep").map((call) => call.args[0]);
const names = () => triggers.map((call) => call.name);
// The strip is drawn as many pixels wide as it is rem, so a pixel is a rem here.
const press = (clientX = 500, button = 0) =>
  act(() => drag.beginResize({ button, clientX, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_WIDTH }) } }));

describe("dragging the build menu's right edge", () => {
  let root: ReactTestRenderer | undefined;
  const mount = (width = 706, step = 1, snaps: readonly WidthSnap[] = BESIDE_THE_PANE) => act(() => {
    root = create(<Probe width={width} step={step} snaps={snaps} />);
  });
  const update = (width: number, step: number) => act(() => {
    root!.update(<Probe width={width} step={step} snaps={BESIDE_THE_PANE} />);
  });
  const blocker = () => root!.root.find((node) => node.props.onMouseUp !== undefined);
  const move = (clientX: number, buttons = 1) => act(() => blocker().props.onMouseMove({ clientX, buttons }));
  const release = () => act(() => blocker().props.onMouseUp());

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

  it("moves the box with the pointer, once a frame, and sends nothing until the release", () => {
    mount();
    press();
    move(560);
    move(580);
    assert.equal(drag.liveWidth, null, "nothing before the frame");

    nextFrame();
    assert.equal(drag.liveWidth, 786);
    assert.deepEqual(names(), []);
  });

  it("holds the box between the narrowest and the widest step it can snap to", () => {
    mount();
    press();
    move(5000);
    nextFrame();
    assert.equal(drag.liveWidth, 1091);

    move(-5000);
    nextFrame();
    assert.equal(drag.liveWidth, 706);
  });

  it("sends the nearest step once, on release", () => {
    mount();
    press();
    move(650);
    release();

    assert.deepEqual(names(), ["SetAssetMenuWidthStep"]);
    assert.deepEqual(steps(), [2]);
  });

  it("sends the narrower step for a release halfway between two", () => {
    mount();
    press();
    move(593.5);
    release();

    assert.deepEqual(steps(), [1]);
  });

  it("snaps to the widest step with the pane hidden", () => {
    mount(706, 1, PANE_HIDDEN);
    press();
    move(5000);
    release();

    assert.deepEqual(steps(), [5]);
  });

  it("holds the snapped width until the stored step comes back, then draws the step", () => {
    mount();
    press();
    move(650);
    release();
    assert.equal(drag.liveWidth, 893, "the box does not flash back to 706 for the round trip");

    update(893, 2);
    assert.equal(drag.liveWidth, null);
  });

  it("draws the stored width at once when the release lands on the step already stored", () => {
    mount(893, 2);
    press();
    move(510);
    release();

    assert.deepEqual(steps(), [2]);
    assert.equal(drag.liveWidth, null);
  });

  it("draws nothing from a frame queued before the release: the snapped width holds, then the stored step", () => {
    mount();
    press();
    move(580);
    move(650);
    release();
    nextFrame();
    assert.equal(drag.liveWidth, 893, "the queued frame does not pull the box back to the pointer");

    update(893, 2);
    nextFrame();
    assert.equal(drag.liveWidth, null);
  });

  it("starts a new drag from the width the box shows", () => {
    mount();
    press();
    move(650);
    release();
    press(500);
    move(510);
    nextFrame();

    assert.equal(drag.liveWidth, 903, "from the snapped 893, not the stored 706");
  });

  it("changes nothing on a press and release that never moved", () => {
    mount();
    press();
    release();

    assert.deepEqual(names(), []);
    assert.equal(drag.liveWidth, null);
  });

  it("keeps a press that wobbles less than the threshold a click", () => {
    mount();
    press();
    move(502);
    release();

    assert.deepEqual(names(), []);
  });

  it("measures a press on the reach beside the pane against the reach's own width", () => {
    mount();
    act(() => drag.beginResize(
      { button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_REACH }) } },
      ASSET_MENU_WIDTH_HANDLE_REACH
    ));
    move(520);
    nextFrame();

    assert.equal(drag.liveWidth, 726);
  });

  it("ends the drag where the button was last held when a move says none is", () => {
    // A release the blocker never saw, such as one outside the window.
    mount();
    press();
    move(650);
    move(640, 0);

    assert.deepEqual(steps(), [2]);
    assert.equal(drag.isResizing, false);
  });

  it("ends the drag when the mouse leaves the screen, as a release does", () => {
    mount();
    press();
    move(650);
    act(() => blocker().props.onMouseLeave());

    assert.deepEqual(steps(), [2]);
    assert.equal(drag.isResizing, false);
  });

  it("sends the nearest step when the asset menu goes away mid-drag, and nothing after", () => {
    // Closed by a key or by the game: the step the player dragged to is kept.
    mount();
    press();
    move(650);
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(steps(), [2]);
    nextFrame();
    assert.equal(names().length, 1, "nothing after the menu has gone");
  });

  it("sends nothing when the asset menu goes away after a press that never moved", () => {
    mount();
    press();
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(names(), []);
  });

  it("leaves a press with any button but the left alone", () => {
    mount();
    press(500, 2);

    assert.equal(drag.isResizing, false);
  });
});

describe("the width strip", () => {
  const strip = (active: boolean, onBeginResize: (event: unknown) => void = () => undefined) =>
    create(<AssetMenuWidthHandle active={active} onBeginResize={onBeginResize} />);

  it("says it snaps in the game's own tooltip, and shows the grip pressed while a drag is on", () => {
    const idle = strip(false).root;
    // The game draws no title attribute, so the hint goes through its Tooltip.
    assert.equal(idle.findByProps({ className: "widthHandle" }).props.title, undefined);
    assert.deepEqual(idle.findByProps({ "data-tooltip": "true" }).children, ["Drag to resize; the edge snaps to the nearest set width"]);
    assert.equal(idle.findAll((node) => node.props.className === "widthGrip").length, 1);

    assert.equal(strip(true).root.findAll((node) => node.props.className === "widthGrip widthGripActive").length, 1);
  });

  it("marks the strip itself as held while a drag is on", () => {
    assert.equal(strip(true).root.findAll((node) => node.props.className === "widthHandle widthHandleActive").length, 1);
    assert.equal(strip(false).root.findAll((node) => node.props.className === "widthHandle").length, 1);
  });

  it("marks the reach beside the pane as held while a drag is on", () => {
    const reach = (active: boolean) => create(<AssetMenuWidthReach active={active} onBeginResize={() => undefined} />).root;

    assert.equal(reach(true).findAll((node) => node.props.className === "widthReach widthReachActive").length, 1);
    assert.equal(reach(false).findAll((node) => node.props.className === "widthReach").length, 1);
  });

  it("starts the drag on a press", () => {
    const pressed: unknown[] = [];
    const event = { clientX: 12 };
    strip(false, (received) => pressed.push(received)).root.findByProps({ className: "widthHandle" }).props.onMouseDown(event);

    assert.deepEqual(pressed, [event]);
  });
});

describe("the width strip and its reach under the mouse", () => {
  let hook: AssetMenuWidthDrag;
  const Both = () => {
    hook = useAssetMenuWidthDrag({ menuWidth: 706, step: 1, snaps: BESIDE_THE_PANE });
    return (
      <>
        <AssetMenuWidthHandle active={hook.isResizing} hovered={hook.isHovered} hoverProps={hook.hoverProps} onBeginResize={hook.beginResize} />
        <AssetMenuWidthReach active={hook.isResizing} hovered={hook.isHovered} hoverProps={hook.hoverProps} onBeginResize={hook.beginResize} />
      </>
    );
  };
  const classOf = (root: ReactTestRenderer, name: string) =>
    String(root.root.find((node) => typeof node.props.className === "string" && node.props.className.split(" ")[0] === name).props.className);

  it("lights both as one handle, wherever the mouse is on them", () => {
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = create(<Both />);
    });
    const reach = root!.root.find((node) => String(node.props.className ?? "").startsWith("widthReach"));

    act(() => reach.props.onMouseEnter());
    assert.equal(classOf(root!, "widthHandle"), "widthHandle widthHandleHovered");
    assert.equal(classOf(root!, "widthGrip"), "widthGrip widthGripHovered");
    assert.equal(classOf(root!, "widthReach"), "widthReach widthReachHovered");

    act(() => reach.props.onMouseLeave());
    assert.equal(classOf(root!, "widthHandle"), "widthHandle");
    assert.equal(classOf(root!, "widthReach"), "widthReach");
    act(() => root?.unmount());
  });

  it("gives the reach the strip's hint", () => {
    const reach = create(<AssetMenuWidthReach active={false} onBeginResize={() => undefined} />).root;
    assert.deepEqual(reach.findByProps({ "data-tooltip": "true" }).children, ["Drag to resize; the edge snaps to the nearest set width"]);
  });
});
