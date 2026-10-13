import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_WIDTH_HANDLE_REACH } from "../../src/domain/assetMenuLayout";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";

// The lengths AssetMenu writes inline, read off the markup by the element's first class.
const styleOf = (html: string, className: string): string =>
  new RegExp(`class="${className}(?: [^"]*)?"[^>]*style="([^"]*)"`).exec(html)?.[1] ?? "";
const remOf = (style: string, property: string): number =>
  Number(new RegExp(`(?:^|;)${property}:\\s*(-?[0-9.]+)rem`).exec(style)?.[1]);
const widthOf = (html: string, className: string): number => remOf(styleOf(html, className), "width");
const leftOf = (html: string, className: string): number => remOf(styleOf(html, className), "left");
const render = () => renderHtml(<AssetMenu onClose={() => {}} />);

/** The box's classes and inline style, read off the markup one property at a time. */
const boxOf = (html: string): { classes: string[]; style: Record<string, string> } => {
  const [, classes = "", style = ""] = /class="(toolContainer(?: [^"]*)?)" style="([^"]*)"/.exec(html) ?? [];
  const declarations = style.split(";").filter((declaration) => declaration.includes(":"));

  return {
    classes: classes.split(" "),
    style: Object.fromEntries(declarations.map((declaration) => {
      const colon = declaration.indexOf(":");
      return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
    })),
  };
};

describe("the asset menu's row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("opens in vanilla's place at the game's own width, with no pane for a new player", () => {
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 706);
    assert.equal(leftOf(html, "assetMenuRow"), 0);
    assert.equal(widthOf(html, "toolContainer"), 706);
    assert.doesNotMatch(html, /class="pane"/);
  });

  it("draws step 3 beside the pane as 0.2.4's row, reaching left of vanilla's slot to the tool options' edge", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1091);
    // x 396, the tool options' edge, less vanilla's 607.
    assert.equal(leftOf(html, "assetMenuRow"), -211);
    assert.match(html, /class="pane"/);
  });

  it("draws step 3 short of the chirper when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1091);
    // x 409, so the box ends at 1,500, 6 rem short of the chirper.
    assert.equal(leftOf(html, "assetMenuRow"), -198);
  });

  it("gives the widest step the whole room when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1475);
    assert.equal(leftOf(html, "assetMenuRow"), -211);
  });

  it("keeps the row at vanilla's 706 at every step, never wider than the box, so nothing beside it takes the mouse", () => {
    for (const step of [1, 2, 3, 4, 5]) {
      setBinding("BetterBuildingMenu", "AssetMenuWidthStep", step);
      const html = render();

      assert.equal(widthOf(html, "assetMenuRow"), 706, `step ${step}`);
      assert.ok(widthOf(html, "toolContainer") >= 706, `step ${step}`);
    }
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
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
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
  const styleLeft = (className: string) =>
    String(root!.root.find((node) => String(node.props.className ?? "").split(" ")[0] === className).props.style.left);

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    saved = globals.document;
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = () => undefined;
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
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
    // The row stays vanilla's 706; the box at 726 still fits short of the pane's room, at vanilla's edge.
    assert.equal(styleWidth("assetMenuRow"), "706rem");
    assert.equal(styleLeft("assetMenuRow"), "0rem");
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
    const box = boxOf(render());

    assert.ok(box.classes.includes("standard") && box.classes.includes("followStyle"), box.classes.join(" "));
    assert.equal(box.style.width, "706rem");
    assert.equal(box.style["--bbm-a-head"], "0.96");
    assert.equal(box.style["--bbm-a-body"], "0.92");
    assert.equal(box.style["--bbm-a-popBg"], "0.97");
  });

  it("follows the game's interface transparency", () => {
    setBinding("options", "interfaceTransparency", 1);
    const box = boxOf(render());

    assert.equal(box.style["--bbm-a-head"], "0.598");
    assert.equal(box.style["--bbm-a-body"], "0.526");
    assert.equal(box.style["--bbm-a-popBg"], "0.604");
  });

  it("keeps the look's own colours under every style while the knob says so", () => {
    setBinding("BetterBuildingMenu", "AssetMenuTuning", { developerMode: true, interfaceStyles: false });
    const box = boxOf(render());

    assert.ok(box.classes.includes("standard"), box.classes.join(" "));
    assert.ok(!box.classes.includes("followStyle"), box.classes.join(" "));
  });
});

describe("the asset menu's tab row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("draws the tab row under the list, inside the box", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    const html = render();

    assert.ok(html.indexOf('class="band"') > html.indexOf('class="content'), "under the list");
    assert.ok(html.indexOf('class="band"') < html.indexOf('class="pane"'), "inside the box, before the pane beside it");
  });

  it("gives the body the stored height: the box is the body and 63.75, vanilla's 208 at the default", () => {
    assert.match(render(), /class="content [^"]*" style="height:144\.25rem"/);
  });
});

describe("the asset menu's top row and top edge", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("draws the top row first and the top edge last, so the edge paints over the row's top", () => {
    const html = render();
    const box = html.slice(html.indexOf('class="toolContainer'));

    assert.ok(box.indexOf('class="topBand"') >= 0 && box.indexOf('class="topBand"') < box.indexOf('class="content'), "the top row before the body");
    assert.ok(box.lastIndexOf('class="topEdge"') > box.lastIndexOf('class="band"'), "the edge after the tab row");
  });

  it("ends the top row 10 rem short of the chirper where the box runs over it", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);

    assert.match(render(), /class="topRow" style="margin-right:375rem"/);
  });
});
