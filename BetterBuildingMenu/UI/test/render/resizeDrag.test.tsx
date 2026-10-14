import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import {
  ASSET_MENU_DEFAULT_HEIGHT,
  ASSET_MENU_MAX_HEIGHT,
  ASSET_MENU_MIN_HEIGHT,
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
  drawnBodyHeight,
  TOP_EDGE_HEIGHT,
} from "../../src/domain/assetMenuLayout";
import { AssetMenuResizeHandle, useAssetMenuHeight, type AssetMenuHeight, type TopEdgeRules } from "../../src/mods/AssetMenuResizeHandle/AssetMenuResizeHandle";

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
  const expected = (clientY: number) => draggedAssetMenuHeight(clampAssetMenuHeight(ASSET_MENU_DEFAULT_HEIGHT), 500, clientY, 1);

  it("sends one height per frame, the latest", () => {
    move(490);
    move(480);
    move(470);
    assert.deepEqual(heights(), [], "nothing before the frame");

    nextFrame();

    assert.deepEqual(heights(), [expected(470)]);
  });

  it("ends the drag where the button was last held when a move says none is", () => {
    move(490);
    act(() => root!.root.find((node) => node.props.onMouseMove).props.onMouseMove({ clientY: 480, buttons: 0 }));

    assert.deepEqual(heights(), [expected(490)]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
    assert.equal(assetMenu.isResizing, false);
  });

  it("leaves a press with any button but the left alone", () => {
    release();
    act(() => assetMenu.beginResize({ button: 2, clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 14 }) } }));

    assert.equal(assetMenu.isResizing, false);
  });

  it("sends where the drag ended before it commits", () => {
    move(490);
    nextFrame();
    move(460);
    release();

    assert.deepEqual(heights(), [expected(490), expected(460)]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
  });

  it("measures a press on the top edge against the edge's own height", () => {
    release();
    // The edge is drawn 8px tall here, so a pixel is a rem against its 8 rem.
    act(() => assetMenu.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 8 }) } }, TOP_EDGE_HEIGHT));
    move(490);
    nextFrame();

    assert.equal(heights().at(-1), expected(490));
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

  it("ends the drag as a release does when the asset menu goes away mid-drag", () => {
    // Closed by a key or by the game: saved, so the binding and the setting
    // agree, and nothing is sent once the menu has gone.
    mount();
    begin();
    act(() => blocker()[0].props.onMouseMove({ clientY: 480 }));
    act(() => root!.unmount());
    root = undefined;

    nextFrame();
    assert.deepEqual(names(), ["SetAssetMenuHeight", "CommitAssetMenuHeight"]);
    assert.deepEqual(heights(), [ASSET_MENU_DEFAULT_HEIGHT + 20]);
  });
});

describe("the resize strip", () => {
  const strip = (active: boolean, onBeginResize: (event: unknown) => void = () => undefined) =>
    create(<AssetMenuResizeHandle active={active} onBeginResize={onBeginResize} />);

  it("says what it is for, and shows the grip pressed while a drag is on", () => {
    const idle = strip(false).root;
    // The game draws no title attribute, so the hint goes through its Tooltip.
    assert.equal(idle.findByProps({ className: "resizeHandle" }).props.title, undefined);
    assert.deepEqual(idle.findByProps({ "data-tooltip": "true" }).children, ["Drag to resize"]);
    assert.equal(idle.findAll((node) => node.props.className === "resizeGrip").length, 1);

    assert.equal(strip(true).root.findAll((node) => node.props.className === "resizeGrip resizeGripActive").length, 1);
  });

  it("marks the strip itself as held while a drag is on", () => {
    assert.equal(strip(true).root.findAll((node) => node.props.className === "resizeHandle resizeHandleActive").length, 1);
  });

  it("starts the drag on a press", () => {
    const pressed: unknown[] = [];
    const event = { clientY: 12 };
    strip(false, (received) => pressed.push(received)).root.findByProps({ className: "resizeHandle" }).props.onMouseDown(event);

    assert.deepEqual(pressed, [event]);
  });
});

describe("dragging the build menu's top edge from a stored height above the room under the top HUD", () => {
  let root: ReactTestRenderer | undefined;
  let menu: AssetMenuHeight;
  // The build menu's own hook: the drag starts from, and stops at, the body as drawn.
  const DrawnProbe = () => {
    menu = useAssetMenuHeight(drawnBodyHeight);
    return menu.blocker;
  };

  beforeEach(() => {
    resetBindings();
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) frames[handle - 1] = null;
    };
    setBinding("BetterBuildingMenu", "AssetMenuHeight", 900);
    act(() => {
      root = create(<DrawnProbe />);
    });
    // The edge is drawn as many pixels tall as it is rem, so a pixel is a rem here.
    act(() => menu.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: TOP_EDGE_HEIGHT }) } }, TOP_EDGE_HEIGHT));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const move = (clientY: number) => act(() => root!.root.find((node) => node.props.onMouseMove).props.onMouseMove({ clientY, buttons: 1 }));
  const release = () => act(() => root!.root.find((node) => node.props.onMouseUp).props.onMouseUp());

  it("is drawn at the room, 830.25, so the drag starts there", () => {
    assert.equal(drawnBodyHeight(900), 830.25);
  });

  it("moves the edge at once from where it is drawn, and the release writes where it lands", () => {
    move(510);
    nextFrame();
    assert.deepEqual(heights(), [820.25], "10 rem down from the drawn 830.25, not from the stored 900");

    release();
    assert.deepEqual(heights(), [820.25]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
  });

  it("holds a drag up at the room's height", () => {
    move(490);
    nextFrame();
    release();

    assert.deepEqual(heights(), [830.25]);
  });
});

describe("dragging the build menu's top edge under its rules", () => {
  let root: ReactTestRenderer | undefined;
  let menu: AssetMenuHeight;
  // Whole tens stand for whole lines here: what the hook does with the rule, not the rule.
  const rules: TopEdgeRules = { snap: (height) => Math.round(height / 10) * 10 };
  const EdgeProbe = () => {
    menu = useAssetMenuHeight(drawnBodyHeight, rules);
    return menu.blocker;
  };

  beforeEach(() => {
    resetBindings();
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = (handle: number) => {
      if (handle > 0) frames[handle - 1] = null;
    };
    act(() => {
      root = create(<EdgeProbe />);
    });
    // The edge is drawn as many pixels tall as it is rem, so a pixel is a rem here.
    act(() => menu.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: TOP_EDGE_HEIGHT }) } }, TOP_EDGE_HEIGHT));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const move = (clientY: number) => act(() => root!.root.find((node) => node.props.onMouseMove).props.onMouseMove({ clientY, buttons: 1 }));
  const release = () => act(() => root!.root.find((node) => node.props.onMouseUp).props.onMouseUp());

  it("sends nothing for a click, nor for a press that moves less than three pixels", () => {
    move(498);
    nextFrame();
    release();

    assert.deepEqual(names(), []);
    assert.equal(menu.isResizing, false);
  });

  it("follows the pointer each frame, then lands the release on whole lines and saves it", () => {
    move(470);
    nextFrame();
    assert.deepEqual(heights(), [174.25], "the edge under the pointer, 30 rem up from 144.25");
    assert.equal(menu.dragged, 174.25);

    release();
    assert.deepEqual(heights(), [174.25, 170]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
    assert.equal(menu.dragged, null);
  });

  it("lands a release from a move the frame has not sent yet", () => {
    move(470);
    move(463);
    release();

    assert.deepEqual(heights(), [180]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
  });

  it("lands as a release does when the menu goes away mid-drag", () => {
    move(470);
    nextFrame();
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(heights(), [174.25, 170]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
  });

  it("sends nothing when the menu goes away after a press that never moved", () => {
    act(() => root!.unmount());
    root = undefined;

    assert.deepEqual(names(), []);
  });
});

describe("the upgrades panel's drag, which keeps no rules of the build menu's", () => {
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
    act(() => assetMenu.beginResize({ clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: 14 }) } }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("moves at the first pixel and saves where it ends, on no line", () => {
    act(() => root!.root.find((node) => node.props.onMouseMove).props.onMouseMove({ clientY: 499 }));
    act(() => root!.root.find((node) => node.props.onMouseUp).props.onMouseUp());

    assert.deepEqual(heights(), [ASSET_MENU_DEFAULT_HEIGHT + 1]);
    assert.equal(names().at(-1), "CommitAssetMenuHeight");
    assert.equal(assetMenu.dragged, null);
  });
});
