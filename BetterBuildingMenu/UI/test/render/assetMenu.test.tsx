import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_WIDTH_HANDLE_REACH } from "../../src/domain/assetMenuLayout";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";

// The widths AssetMenu writes inline, read off the markup by class.
const widthOf = (html: string, className: string): number =>
  Number(new RegExp(`class="${className}(?: [^"]*)?"[^>]*style="width:\\s*([0-9.]+)rem`).exec(html)?.[1]);
const render = () => renderHtml(<AssetMenu onClose={() => {}} />);

describe("the asset menu's row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("opens at the game's own width, the pane beside it, the strip on its edge", () => {
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 706);
    assert.equal(widthOf(html, "assetMenuRow"), 1091);
    assert.match(html, /class="pane"/);
    assert.match(html, /class="widthHandle"/);
  });

  it("draws step 3 as 0.2.4's row", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.equal(widthOf(html, "assetMenuRow"), 1476);
  });

  it("leaves the pane out when it is hidden, and keeps the menu's width", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1091);
    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.doesNotMatch(html, /class="pane"/);
  });

  it("gives the widest step the whole room when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1475);
    assert.equal(widthOf(html, "assetMenuRow"), 1475);
  });

  it("is no wider than the menu and the pane, so nothing beside a narrow menu takes the mouse", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 2);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 893);
    assert.equal(widthOf(html, "assetMenuRow"), 1278);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.equal(widthOf(render(), "assetMenuRow"), 893);
  });
});

describe("the asset menu's width strip", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    saved = globals.document;
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  it("starts the width drag on a press, which puts the blocker up", () => {
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    const strip = root!.root.find((node) => node.props.className === "widthHandle");
    assert.equal(root!.root.findAll((node) => node.props.className === "widthBlocker").length, 0);

    act(() => strip.props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: 10 }) } }));

    assert.equal(root!.root.findAll((node) => node.props.className === "widthBlocker").length, 1);
  });

  it("reaches into the gap beside the pane while it is shown, and a press there starts the drag", () => {
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    const content = root!.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("content"));
    const reach = root!.root.findAll((node) => node.props.className === "widthReach");

    assert.equal(reach.length, 1);
    assert.equal(content.findAll((node) => node.props.className === "widthReach").length, 0, "outside the catalog's clipped box");
    act(() => reach[0].props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: 6 }) } }));
    assert.equal(root!.root.findAll((node) => node.props.className === "widthBlocker").length, 1);
  });

  it("reaches nowhere past the menu while the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });

    assert.equal(root!.root.findAll((node) => node.props.className === "widthReach").length, 0);
  });

  it("draws the strip down the catalog's side, below the header", () => {
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    const content = root!.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("content"));

    assert.equal(content.findAll((node) => node.props.className === "widthHandle").length, 1);
  });
});

describe("a drag on the asset menu's right edge", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let frames: Array<() => void> = [];
  let root: ReactTestRenderer | undefined;
  const styleWidth = (className: string) =>
    String(root!.root.find((node) => String(node.props.className ?? "").split(" ")[0] === className).props.style.width);

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    saved = globals.document;
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = () => undefined;
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  it("moves the box with the pointer, measured against the gap's own width", () => {
    const reach = root!.root.find((node) => String(node.props.className ?? "").startsWith("widthReach"));
    // Drawn as many pixels wide as it is rem, so a pixel is a rem.
    act(() => reach.props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_REACH }) } }));
    const blocker = root!.root.find((node) => node.props.className === "widthBlocker");
    act(() => blocker.props.onMouseMove({ clientX: 520, buttons: 1 }));
    act(() => frames.splice(0).forEach((callback) => callback()));

    assert.equal(styleWidth("toolContainer"), "726rem");
    assert.equal(styleWidth("assetMenuRow"), "1111rem");
  });

  it("snaps to the nearest step on release, and keeps that width until the stored step comes back", () => {
    const strip = root!.root.find((node) => node.props.className === "widthHandle");
    act(() => strip.props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: 8 }) } }));
    const blocker = root!.root.find((node) => node.props.className === "widthBlocker");
    act(() => blocker.props.onMouseMove({ clientX: 650, buttons: 1 }));
    act(() => blocker.props.onMouseUp());

    assert.deepEqual(triggers.filter((call) => call.name === "SetAssetMenuWidthStep").map((call) => call.args[0]), [2]);
    assert.equal(styleWidth("toolContainer"), "893rem");

    act(() => setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 2));
    assert.equal(styleWidth("toolContainer"), "893rem");
  });
});

describe("the asset menu's look", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("puts the look's tokens on the box, following the game's style, at the look's own alphas", () => {
    assert.match(
      render(),
      /class="toolContainer standard followStyle" style="width:706rem;--bbm-a-head:0\.96;--bbm-a-body:0\.92;--bbm-a-popBg:0\.97"/
    );
  });

  it("follows the game's interface transparency", () => {
    setBinding("options", "interfaceTransparency", 1);

    assert.match(render(), /--bbm-a-head:0\.598;--bbm-a-body:0\.526;--bbm-a-popBg:0\.604/);
  });

  it("keeps the look's own colours under every style while the knob says so", () => {
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: false });

    assert.match(render(), /class="toolContainer standard" style=/);
  });
});

describe("the asset menu's tab row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("draws the tab row under the list, inside the box", () => {
    const html = render();

    assert.ok(html.indexOf('class="band"') > html.indexOf('class="content'), "under the list");
    assert.ok(html.indexOf('class="band"') < html.indexOf('class="pane"'), "inside the box, before the pane beside it");
  });

  it("gives the list the box less the tab row's band, so the box keeps vanilla's 208", () => {
    assert.match(render(), /class="content [^"]*" style="height:119\.25rem"/);
  });
});
