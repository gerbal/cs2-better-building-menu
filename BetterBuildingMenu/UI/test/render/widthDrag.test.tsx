import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { ASSET_MENU_WIDTH_HANDLE_REACH, ASSET_MENU_WIDTH_HANDLE_WIDTH } from "../../src/domain/assetMenuLayout";
import { WIDTH_DRAG_DEAD_ZONE, drawnStep as drawnStepOf, drawnStepWidth, snapTargets, type WidthSnap, type WidthStepScreen } from "../../src/domain/widthSteps";
import {
  AssetMenuWidthHandle,
  AssetMenuWidthReach,
  useAssetMenuWidthDrag,
  type AssetMenuWidthDrag,
} from "../../src/mods/AssetMenuWidthHandle/AssetMenuWidthHandle";

// 16:9 at the game's own text size: beside the pane the edge snaps to 706, 893 and 1,091.
const SCREEN_BESIDE_THE_PANE: WidthStepScreen = { aspect: 16 / 9, textScale: 1, paneShown: true };
const SCREEN_PANE_HIDDEN: WidthStepScreen = { aspect: 16 / 9, textScale: 1, paneShown: false };
const BESIDE_THE_PANE = snapTargets(SCREEN_BESIDE_THE_PANE);
const PANE_HIDDEN = snapTargets(SCREEN_PANE_HIDDEN);
const globals = globalThis as unknown as Record<string, unknown>;
let frames: Array<(() => void) | null> = [];
const nextFrame = () => act(() => {
  const due = frames;
  frames = [];
  for (const callback of due) callback?.();
});

let drag: AssetMenuWidthDrag;
interface ProbeProps {
  width: number;
  step: number;
  drawnStep?: number;
  snaps: readonly WidthSnap[];
  screen?: WidthStepScreen;
}

const Probe = ({ width, step, drawnStep = step, snaps, screen = SCREEN_BESIDE_THE_PANE }: ProbeProps) => {
  drag = useAssetMenuWidthDrag({ menuWidth: width, step, drawnStep, snaps, screen });
  return drag.blocker;
};

const steps = () => triggers.filter((call) => call.name === "SetAssetMenuWidthStep").map((call) => call.args[0]);
const names = () => triggers.map((call) => call.name);
// The strip is drawn as many pixels wide as it is rem, so a pixel is a rem here.
const press = (clientX = 500, button = 0) =>
  act(() => drag.beginResize({ button, clientX, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_WIDTH }) } }));

describe("dragging the build menu's right edge", () => {
  let root: ReactTestRenderer | undefined;
  const mount = (width = 706, step = 1, snaps: readonly WidthSnap[] = BESIDE_THE_PANE, drawnStep = step, screen = SCREEN_BESIDE_THE_PANE) => act(() => {
    root = create(<Probe width={width} step={step} drawnStep={drawnStep} snaps={snaps} screen={screen} />);
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
    // Beside the pane step 2's edge is at 1,487: 83.5 rem back puts it at 1,403.5, a box 799.5 wide
    // from the slot's 604, halfway to 706.
    mount(893, 2);
    press();
    move(416.5);
    release();

    assert.deepEqual(steps(), [1]);
  });

  it("snaps to the widest step with the pane hidden", () => {
    mount(706, 1, PANE_HIDDEN, 1, SCREEN_PANE_HIDDEN);
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

  it("sends nothing when the release lands on the step the box already draws", () => {
    mount(893, 2);
    press();
    move(490);
    release();

    assert.deepEqual(steps(), []);
    assert.equal(drag.liveWidth, null);
  });

  it("keeps a stored step the pane hides when a nudge lands on the step it draws as", () => {
    // Stored 5 draws as 3 beside the pane; a few pixels on the edge must not store 3 over it.
    mount(1091, 5, BESIDE_THE_PANE, 3);
    press();
    move(510);
    release();

    assert.deepEqual(steps(), []);
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
    move(480);
    nextFrame();

    assert.equal(drag.liveWidth, 863, "from the snapped 893, whose edge is at 1,487, not the stored 706");
  });

  it("puts the drawn right edge under the pointer, where the box grows left to hold its edge", () => {
    // Pane hidden on 16:9: step 1's edge is at 1,310, the box grows left to hold its edge at 1,500,
    // and 4 and 5 run on to 1,676 and 1,871.
    mount(706, 1, PANE_HIDDEN, 1, SCREEN_PANE_HIDDEN);
    press();
    move(500 + 366);
    nextFrame();

    assert.equal(drag.liveWidth, 1280, "step 4's box, whose edge is the pointer's");
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

  it("sends nothing when the menu goes away after a drag back onto the step it draws", () => {
    mount(1091, 5, BESIDE_THE_PANE, 3);
    press();
    move(450);
    move(500);
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(names(), []);
  });

  describe("a nudge at the widest drawn step", () => {
    // Under the dead zone the box keeps the step it draws, either way, at 100% and 130% text.
    const widest: Array<[string, number, boolean, number]> = [
      ["a stored 5 drawn as 3 beside the pane", 5, true, 1],
      ["step 3 beside the pane", 3, true, 1],
      ["step 3 with the pane hidden", 3, false, 1],
      ["a stored 5 drawn as 3 beside the pane at 130% text", 5, true, 1.3],
      ["step 3 with the pane hidden at 130% text", 3, false, 1.3],
    ];

    for (const [name, stored, paneShown, textScale] of widest) {
      const screen: WidthStepScreen = { aspect: 16 / 9, textScale, paneShown };
      const drawnStep = drawnStepOf(stored, screen);
      const nudge = (travelled: number) => {
        mount(drawnStepWidth(drawnStep, screen), stored, snapTargets(screen), drawnStep, screen);
        press();
        move(500 + travelled);
        release();
      };

      it(`keeps ${name} under a ${WIDTH_DRAG_DEAD_ZONE} rem nudge either way`, () => {
        for (const travelled of [-(WIDTH_DRAG_DEAD_ZONE - 1), -3, 3, WIDTH_DRAG_DEAD_ZONE - 1]) {
          nudge(travelled);
          assert.deepEqual(steps(), [], `${travelled} rem`);
          assert.equal(drag.liveWidth, null);
          act(() => root!.unmount());
          root = undefined;
        }
      });

      it(`follows ${name} once the pointer is past the dead zone`, () => {
        nudge(-WIDTH_DRAG_DEAD_ZONE - 1);

        assert.deepEqual(steps(), [2]);
      });
    }
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
    hook = useAssetMenuWidthDrag({ menuWidth: 706, step: 1, drawnStep: 1, snaps: BESIDE_THE_PANE, screen: SCREEN_BESIDE_THE_PANE });
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

describe("dragging the build menu's left edge", () => {
  let root: ReactTestRenderer | undefined;
  const blocker = () => root!.root.find((node) => node.props.onMouseUp !== undefined);
  const move = (clientX: number) => act(() => blocker().props.onMouseMove({ clientX, buttons: 1 }));

  beforeEach(() => {
    resetBindings();
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) frames[handle - 1] = null;
    };
    act(() => {
      root = create(<Probe width={706} step={1} snaps={PANE_HIDDEN} screen={SCREEN_PANE_HIDDEN} />);
    });
    act(() => drag.beginResize({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_WIDTH }) } }, ASSET_MENU_WIDTH_HANDLE_WIDTH, "left"));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("says which edge it holds while it is on", () => {
    assert.equal(drag.activeEdge, "left");
    act(() => blocker().props.onMouseUp());
    assert.equal(drag.activeEdge, null);
  });

  it("widens the box as the pointer moves left, a rem for a rem, and says the width it follows", () => {
    move(470);
    nextFrame();

    assert.equal(drag.liveWidth, 736);
    assert.equal(drag.dragged, 736);
  });

  it("lands the release on the nearest step and sends it once", () => {
    move(400);
    act(() => blocker().props.onMouseUp());

    assert.deepEqual(steps(), [2]);
    assert.equal(drag.dragged, null);
  });
});
