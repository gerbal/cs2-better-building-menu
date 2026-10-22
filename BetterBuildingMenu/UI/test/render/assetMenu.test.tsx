import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { installFakeBrowser, type FakeBrowser } from "../harness/fakeBrowser";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { mountEach } from "../harness/mount";
import { seed } from "../harness/seed";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_CATALOG_FULL, ASSET_MENU_WIDTH_HANDLE_REACH, draggedCatalogWidth } from "../../src/domain/assetMenuLayout";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";
import { AssetMenuCatalogWidth$, AssetMenuWidth$, ControlPaneShown$ } from "../../src/mods/bindings";

// The widths AssetMenu writes inline, read off the markup by class.
const widthOf = (html: string, className: string): number =>
  Number(new RegExp(`class="${className}"[^>]*style="width:\\s*([0-9.]+)rem`).exec(html)?.[1]);
const render = () => renderHtml(<AssetMenu onClose={() => {}} />);

describe("the asset menu's row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed(AssetMenuWidth$, 1441);
  });

  it("draws today's layout by default: the menu filling the room, the pane beside it, the strip on its edge", () => {
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1476);
    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.match(html, /class="pane"/);
    assert.match(html, /class="widthHandle"/);
  });

  it("leaves the pane out when it is hidden, and keeps the menu's width", () => {
    seed(ControlPaneShown$, false);
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1091);
    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.doesNotMatch(html, /class="pane"/);
  });

  it("gives a filled menu the whole band when the pane is hidden", () => {
    seed(ControlPaneShown$, false);
    seed(AssetMenuCatalogWidth$, ASSET_MENU_CATALOG_FULL);
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1476);
    assert.equal(widthOf(html, "toolContainer"), 1476);
  });

  it("is no wider than the menu and the pane, so nothing beside a narrow menu takes the mouse", () => {
    seed(AssetMenuCatalogWidth$, 900);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 900);
    assert.equal(widthOf(html, "assetMenuRow"), 1285);

    seed(ControlPaneShown$, false);
    assert.equal(widthOf(render(), "assetMenuRow"), 900);
  });
});

describe("the asset menu's width strip", () => {
  let browser: FakeBrowser;
  const tree = mountEach();

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed(AssetMenuWidth$, 1441);
    browser = installFakeBrowser({ frames: "none" });
  });

  afterEach(() => {
    browser.restore();
  });

  it("starts the width drag on a press, which puts the blocker up", () => {
    tree.mount(<AssetMenu onClose={() => {}} />);
    const strip = tree.root.find((node) => node.props.className === "widthHandle");
    assert.equal(tree.root.findAll((node) => node.props.className === "widthBlocker").length, 0);

    act(() => strip.props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: 10 }) } }));

    assert.equal(tree.root.findAll((node) => node.props.className === "widthBlocker").length, 1);
  });

  it("reaches into the gap beside the pane while it is shown, and a press there starts the drag", () => {
    tree.mount(<AssetMenu onClose={() => {}} />);
    const content = tree.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("content"));
    const reach = tree.root.findAll((node) => node.props.className === "widthReach");

    assert.equal(reach.length, 1);
    assert.equal(content.findAll((node) => node.props.className === "widthReach").length, 0, "outside the catalog's clipped box");
    act(() => reach[0].props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: 6 }) } }));
    assert.equal(tree.root.findAll((node) => node.props.className === "widthBlocker").length, 1);
  });

  it("reaches nowhere past the menu while the pane is hidden", () => {
    seed(ControlPaneShown$, false);
    tree.mount(<AssetMenu onClose={() => {}} />);

    assert.equal(tree.root.findAll((node) => node.props.className === "widthReach").length, 0);
  });

  it("draws the strip down the catalog's side, below the header", () => {
    tree.mount(<AssetMenu onClose={() => {}} />);
    const content = tree.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("content"));

    assert.equal(content.findAll((node) => node.props.className === "widthHandle").length, 1);
  });
});

describe("a press in the gap beside the pane", () => {
  let browser: FakeBrowser;
  const tree = mountEach();

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed(AssetMenuWidth$, 1441);
    browser = installFakeBrowser({ frames: "manual" });
  });

  afterEach(() => {
    browser.restore();
  });

  it("measures the pointer against the gap's own width", () => {
    tree.mount(<AssetMenu onClose={() => {}} />);
    const reach = tree.root.find((node) => String(node.props.className ?? "").startsWith("widthReach"));
    // Drawn as many pixels wide as it is rem, so a pixel is a rem.
    act(() => reach.props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_REACH }) } }));
    const blocker = tree.root.find((node) => node.props.className === "widthBlocker");
    act(() => blocker.props.onMouseMove({ clientX: 480, buttons: 1 }));
    browser.nextFrame();
    const widths = triggers.filter((call) => call.name === "SetAssetMenuCatalogWidth").map((call) => call.args[0]);
    act(() => tree.renderer.unmount());

    assert.deepEqual(widths, [draggedCatalogWidth(1091, 500, 480, 1476, true, 1)]);
  });
});
