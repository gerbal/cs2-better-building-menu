import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_WIDTH_HANDLE_REACH, ASSET_MENU_WIDTH_HANDLE_WIDTH, TOP_CHROME_HEIGHT, TOP_EDGE_HEIGHT } from "../../src/domain/assetMenuLayout";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";
import { openListCloser, setOpenListCloser } from "../../src/mods/BuildingMenu/openListCloser";

// The lengths AssetMenu writes inline, read off the markup by the element's first class.
const styleOf = (html: string, className: string): string =>
  new RegExp(`class="${className}(?: [^"]*)?"[^>]*style="([^"]*)"`).exec(html)?.[1] ?? "";
const remOf = (style: string, property: string): number =>
  Number(new RegExp(`(?:^|;)${property}:\\s*(-?[0-9.]+)rem`).exec(style)?.[1]);
const widthOf = (html: string, className: string): number => remOf(styleOf(html, className), "width");
const leftOf = (html: string, className: string): number => remOf(styleOf(html, className), "left");
const render = () => renderHtml(<AssetMenu onClose={() => {}} />);
// The pane's root, whatever look classes follow its own.
const PANE = /class="pane[ "]/;

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
    assert.doesNotMatch(html, PANE);
  });

  it("draws step 3 beside the pane as 0.2.4's row, reaching left of vanilla's slot to the tool options' edge", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1091);
    // x 396, the tool options' edge, less the game's slot's 604.
    assert.equal(leftOf(html, "assetMenuRow"), -208);
    assert.match(html, PANE);
  });

  it("draws step 3 short of the chirper when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1091);
    // x 409, so the box ends at 1,500, 6 rem short of the chirper.
    assert.equal(leftOf(html, "assetMenuRow"), -195);
  });

  it("gives the widest step the whole room when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 1475);
    assert.equal(leftOf(html, "assetMenuRow"), -208);
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

  it("draws the strip down the box's side, outside the body, so it reaches past the tab row", () => {
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    const content = root!.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("content"));
    const box = root!.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ")[0] === "toolContainer");

    assert.equal(content.findAll((node) => node.props.className === "widthHandle").length, 0);
    assert.equal(box.findAll((node) => node.props.className === "widthHandle").length, 1);
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
    act(() => strip.props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_WIDTH }) } }));
    const blocker = root!.root.find((node) => node.props.className === "widthBlocker");
    act(() => blocker.props.onMouseMove({ clientX: 650, buttons: 1 }));
    act(() => blocker.props.onMouseUp());

    assert.deepEqual(triggers.filter((call) => call.name === "SetAssetMenuWidthStep").map((call) => call.args[0]), [2]);
    assert.equal(styleWidth("toolContainer"), "893rem");

    act(() => setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 2));
    assert.equal(styleWidth("toolContainer"), "893rem");
  });
});

describe("the game's tool options column beside the box", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let root: ReactTestRenderer | undefined;
  let removed: string[] = [];
  let column: { classList: { contains(name: string): boolean }; style: Record<string, unknown> };
  let otherColumn: typeof column;

  const sideColumn = () => ({
    classList: { contains: (name: string) => name === "vanilla-toolSideColumn" },
    style: { removeProperty: (name: string) => removed.push(name) } as Record<string, unknown>,
  });
  const mount = () => act(() => {
    root = create(<AssetMenu onClose={() => {}} />);
  });

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    removed = [];
    column = sideColumn();
    otherColumn = sideColumn();
    // The game's tool layout: the tool options column, the slot, and the empty column right of it.
    const layout = { children: [column, { classList: { contains: () => false }, style: {} }, otherColumn] };
    saved = globals.document;
    globals.document = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      querySelector: (selector: string) => (selector === ".vanilla-toolLayout" ? layout : null),
    };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  it("stays where the game puts it while the box keeps the slot's left edge", () => {
    mount();

    assert.equal(column.style.left, undefined);
    assert.deepEqual(removed, []);
  });

  it("moves left of a box that reaches left of the slot, and back when the menu closes", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    mount();

    assert.equal(column.style.left, "-202rem");
    assert.equal(otherColumn.style.left, undefined, "the column right of the slot holds nothing to move");

    act(() => root?.unmount());
    root = undefined;
    assert.deepEqual(removed, ["left"]);
  });

  it("goes back when the box comes back to the slot's left edge", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 4);
    mount();
    assert.equal(column.style.left, "-202rem");

    act(() => setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 1));
    assert.deepEqual(removed, ["left"]);
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
    assert.ok(html.search(PANE) >= 0, "the pane is drawn");
    assert.ok(html.indexOf('class="band"') < html.search(PANE), "inside the box, before the pane beside it");
  });

  it("gives the body the stored height: the box is the body and 63.75, vanilla's 208 at the default", () => {
    assert.match(render(), /class="content [^"]*" style="height:144\.25rem"/);
  });

  it("draws a tall stored height at the room under the top HUD, its top row clear of the HUD", () => {
    setBinding("BetterBuildingMenu", "AssetMenuHeight", 900);

    // The room is the box's bottom edge, 954, less the HUD's 60; the body is that less the chrome.
    assert.match(render(), /class="content [^"]*" style="height:830\.25rem"/);
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

  it("keeps the top edge the box's last child after the width strip's reach, with the pane shown", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    const html = render();
    const box = html.slice(html.indexOf('class="toolContainer'));

    assert.ok(box.indexOf('class="widthReach') >= 0, "the reach is drawn beside the shown pane");
    assert.ok(box.lastIndexOf('class="topEdge"') > box.lastIndexOf('class="widthReach'), "the edge after the reach");
    assert.ok(box.lastIndexOf('class="topEdge"') > box.lastIndexOf('class="widthHandle'), "the edge after the strip");
  });

  it("ends the top row 10 rem short of the chirper where the box runs over it", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);

    assert.match(render(), /class="topRow" style="margin-right:375rem"/);
  });
});

describe("a drag on the asset menu's top edge", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let frames: Array<() => void> = [];
  let root: ReactTestRenderer | undefined;

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

  it("changes the height one for one with the pointer, measured against the edge's own height", () => {
    const edge = root!.root.find((node) => node.props.className === "topEdge");
    // Drawn as many pixels tall as it is rem, so a pixel is a rem.
    act(() => edge.props.onMouseDown({ button: 0, clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: TOP_EDGE_HEIGHT }) } }));
    const blocker = root!.root.find((node) => node.props.className === "resizeBlocker");
    act(() => blocker.props.onMouseMove({ clientY: 490, buttons: 1 }));
    act(() => frames.splice(0).forEach((callback) => callback()));

    // The default height is 144.25: ten pixels up is ten rem taller.
    assert.deepEqual(triggers.filter((call) => call.name === "SetAssetMenuHeight").map((call) => call.args[0]), [154.25]);
  });
});

describe("the asset menu's controls", () => {
  type Press = (event: { target: unknown }) => void;
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let listeners: Press[] = [];
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    listeners = [];
    saved = globals.document;
    globals.document = {
      addEventListener: (type: string, listener: Press) => {
        if (type === "mousedown") listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: Press) => {
        listeners = listeners.filter((other) => other !== listener);
      },
      querySelector: () => null,
    };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  const mount = () => act(() => {
    root = create(<AssetMenu onClose={() => {}} />);
  });
  const control = (word: string) =>
    root!.root.find((node) => String(node.props["aria-label"] ?? "").startsWith(`${word} · `) && typeof node.props.onSelect === "function");
  const popovers = () => root!.root.findAll((node) => node.type === "div" && node.props["data-bbm-popover"] === "true");

  it("holds Sort, Filter, Group and View on the top row at rest, each a word and a value, with the pane off or on", () => {
    for (const shown of [false, true]) {
      setBinding("BetterBuildingMenu", "ControlPaneShown", shown);
      const html = renderHtml(<AssetMenu onClose={() => {}} />);
      const strip = html.slice(html.indexOf('data-bbm-controls="true"'));

      for (const word of ["Sort", "Filter", "Group", "View"]) {
        assert.match(strip, new RegExp(`<span class="word">${word}</span><span class="value[^"]*"[^>]*>[^<]+</span>`), `${word}, pane ${shown}`);
      }
    }
  });

  it("opens one popover at a time from its control, and a second press closes it", () => {
    mount();
    act(() => control("Sort").props.onSelect());
    assert.equal(popovers().length, 1);

    act(() => control("Group").props.onSelect());
    assert.equal(popovers().length, 1, "switching, not stacking");
    assert.ok(popovers()[0].findAll((node) => node.props["aria-label"] === "By tab").length > 0, "the Group list");

    act(() => control("Group").props.onSelect());
    assert.equal(popovers().length, 0);
  });

  it("opens a popover above the default box, and under the top row once the box is too tall to hold one above it", () => {
    mount();
    act(() => control("Sort").props.onSelect());
    assert.deepEqual(Object.keys(popovers()[0].props.style).sort(), ["bottom", "left"]);
    act(() => root!.unmount());

    setBinding("BetterBuildingMenu", "AssetMenuHeight", 800);
    mount();
    act(() => control("Sort").props.onSelect());
    assert.equal(popovers()[0].props.style.top, `${TOP_CHROME_HEIGHT}rem`);
    assert.equal(popovers()[0].props.style.bottom, undefined);
  });

  it("closes an open popover on a press outside it and the controls", () => {
    mount();
    act(() => control("Sort").props.onSelect());
    act(() => [...listeners].forEach((listener) => listener({ target: { getAttribute: () => null, parentElement: null } })));

    assert.equal(popovers().length, 0);
  });

  it("keeps one list open across the top row and the pane: opening either closes the other", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    mount();
    const pane = () => root!.root.find((node) => node.type === "div" && String(node.props.className ?? "").split(" ").includes("pane"));
    const summary = (label: string) =>
      pane().find((node) => String(node.props["aria-label"] ?? "").startsWith(`${label} · `) && typeof node.props.onSelect === "function");
    const paneLists = () => pane().findAll((node) => node.type === "div" && node.props.className === "pickerOptions");

    act(() => summary("Sort by").props.onSelect());
    assert.equal(paneLists().length, 1);

    act(() => control("Group").props.onSelect());
    assert.equal(popovers().length, 1);
    assert.equal(paneLists().length, 0, "the popover closes the pane's list");

    act(() => summary("View").props.onSelect());
    assert.equal(paneLists().length, 1);
    assert.equal(popovers().length, 0, "the pane's list closes the popover");
  });
});

describe("the asset menu's open list and Escape", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setOpenListCloser(null);
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

  it("hands Escape the open list's close while a list is open, in the top row or the pane", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    const press = (label: string) =>
      act(() => root!.root.find((node) => String(node.props["aria-label"] ?? "").startsWith(label) && typeof node.props.onSelect === "function").props.onSelect());
    assert.equal(openListCloser(), null, "nothing open, nothing to close");

    press("Sort · ");
    assert.equal(typeof openListCloser(), "function", "the top row's popover");

    press("Group by · ");
    const close = openListCloser();
    assert.equal(typeof close, "function", "the pane's list, which took the popover's place");

    act(() => close!());
    assert.equal(openListCloser(), null);
    assert.equal(root!.root.findAll((node) => node.props["data-bbm-popover"] === "true").length, 0);
  });
});

describe("the game's slot as the box measures it", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: { document: unknown; window: unknown };
  let frames: Array<() => void> = [];
  let root: ReactTestRenderer | undefined;
  // Where the slot the row sits in starts, in pixels: 1 px per rem on a 1920 × 1080 screen.
  let slotLeftPx = 608;
  const rowLeft = () =>
    String(root!.root.find((node) => String(node.props.className ?? "").split(" ")[0] === "assetMenuRow").props.style.left);
  const runFrames = () => {
    for (let pass = 0; pass < 40 && frames.length > 0; pass++) act(() => frames.splice(0).forEach((callback) => callback()));
  };
  const mount = () => act(() => {
    root = create(<AssetMenu onClose={() => {}} />, {
      createNodeMock: (element) =>
        String(element.props.className ?? "").split(" ")[0] === "assetMenuRow"
          ? { parentElement: { getBoundingClientRect: () => ({ left: slotLeftPx, width: 704 }) } }
          : null,
    });
  });

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    saved = { document: globals.document, window: globals.window };
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    globals.window = { innerWidth: 1920, innerHeight: 1080 };
    frames = [];
    slotLeftPx = 608;
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved.document;
    globals.window = saved.window;
  });

  it("places the box from the slot it reads, over the 712 that stands for it before the first layout", () => {
    // Step 3 ends 6 rem short of the chirper, at x 1,500: from a slot at 608 its 1,091 start 199 left of it.
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    mount();
    assert.equal(rowLeft(), "-195rem");

    runFrames();

    assert.equal(rowLeft(), "-199rem");
  });

  it("reads the slot again when the screen changes size", () => {
    // 1280 × 720 first, 1.5 rem to a pixel: a slot at 402 px starts at x 603.
    globals.window = { innerWidth: 1280, innerHeight: 720 };
    slotLeftPx = 402;
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    mount();
    runFrames();
    assert.equal(rowLeft(), "-194rem");

    globals.window = { innerWidth: 1920, innerHeight: 1080 };
    slotLeftPx = 608;
    act(() => root!.update(<AssetMenu onClose={() => {}} />));
    runFrames();

    assert.equal(rowLeft(), "-199rem");
  });
});
