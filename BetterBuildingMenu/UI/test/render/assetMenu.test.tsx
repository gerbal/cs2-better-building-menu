import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_CATALOG_FULL } from "../../src/domain/assetMenuLayout";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";

// The widths AssetMenu writes inline, read off the markup by class.
const widthOf = (html: string, className: string): number =>
  Number(new RegExp(`class="${className}"[^>]*style="width:\\s*([0-9.]+)rem`).exec(html)?.[1]);
const render = () => renderHtml(<AssetMenu onClose={() => {}} />);

describe("the asset menu's row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 1441);
  });

  it("draws today's layout by default: the menu filling the room, the pane beside it, the strip on its edge", () => {
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1476);
    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.match(html, /class="pane"/);
    assert.match(html, /class="widthHandle"/);
  });

  it("leaves the pane out when it is hidden, and keeps the menu's width", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1091);
    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.doesNotMatch(html, /class="pane"/);
  });

  it("gives a filled menu the whole band when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", ASSET_MENU_CATALOG_FULL);
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1476);
    assert.equal(widthOf(html, "toolContainer"), 1476);
  });

  it("is no wider than the menu and the pane, so nothing beside a narrow menu takes the mouse", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 900);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 900);
    assert.equal(widthOf(html, "assetMenuRow"), 1285);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.equal(widthOf(render(), "assetMenuRow"), 900);
  });
});

describe("the asset menu's width strip", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 1441);
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
