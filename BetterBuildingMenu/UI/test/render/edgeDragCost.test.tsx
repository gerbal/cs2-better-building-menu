import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry, showBody } from "../harness/render";
import { setTranslation, resetTranslations } from "../harness/stubs/cs2-l10n";
import { reads as bindingReads, resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_WIDTH_HANDLE_WIDTH, TOP_EDGE_HEIGHT } from "../../src/domain/assetMenuLayout";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";

// What a drag of the top edge re-renders: the body, each of whose renders reads the armed building, a binding no
// other component reads, and its rows, each of which reads its entry's prefabName twice a render (the name is
// blank). Each pointer frame the hook's own render and C#'s echo of the height it sent come apart, as in game.
const globals = globalThis as unknown as Record<string, unknown>;
let reads = 0;

const counted = (id: number): BuildingCatalogEntry => {
  const row = entry(id, { name: "" });
  Object.defineProperty(row, "prefabName", {
    get: () => {
      reads++;
      return `Prefab${id}`;
    },
  });
  return row;
};

const FRAMES = 60;
const ROWS = 60;
/** The prefabName reads of every row drawn once. */
const ALL_ROWS = 2 * ROWS;
const bodyRenders = (): number => bindingReads.get("BetterBuildingMenu.ActivePrefabId") ?? 0;
// The tab row is the one reader of the All count, so its reads count the tab row's plans.
const tabRowRenders = (): number => bindingReads.get("BetterBuildingMenu.AssetMenuAllCount") ?? 0;

describe("what a drag of the top edge re-renders", () => {
  let root: ReactTestRenderer | undefined;
  let frames: Array<() => void> = [];
  let saved: Record<string, unknown> = {};

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    reads = 0;
    saved = { document: globals.document, requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    resetTranslations();
    Object.assign(globals, saved);
  });

  /** Mounts the menu in this body, text scale and Top edge, drags the edge up a rem a frame, and releases it. */
  const drag = (body: "list" | "tiles" | "icons" | "cards", topEdge: string, textScale = 1) => {
    showBody(body);
    setBinding("BetterBuildingMenu", "AssetMenuTopEdge", topEdge);
    setBinding("options", "textScale", textScale);
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(Array.from({ length: ROWS }, (_, at) => counted(at + 1))));
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    // Echoes what the drag sends since the last echo, as C# does.
    let echoed = 0;
    const echo = () => {
      const sent = triggers.filter((call) => call.name === "SetAssetMenuHeight");
      for (const call of sent.slice(echoed)) act(() => setBinding("BetterBuildingMenu", "AssetMenuHeight", call.args[0]));
      echoed = sent.length;
    };
    const blocker = () => root!.root.find((node) => node.props.className === "resizeBlocker");
    const rowsAtMount = reads;
    const rendersAtMount = bodyRenders();
    const tabRowsAtMount = tabRowRenders();

    // The edge is drawn as many pixels tall as it is rem, so a pixel is a rem.
    act(() => root!.root.find((node) => node.props.className === "topEdge").props.onMouseDown({ button: 0, clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: TOP_EDGE_HEIGHT }) } }));
    for (let frame = 1; frame <= FRAMES; frame++) {
      act(() => blocker().props.onMouseMove({ clientY: 500 - frame, buttons: 1 }));
      act(() => frames.splice(0).forEach((callback) => callback()));
      echo();
    }
    act(() => blocker().props.onMouseUp());
    echo();

    assert.ok(rowsAtMount > 0 && rendersAtMount > 0, "the body and its rows drew at mount");
    return { renders: bodyRenders() - rendersAtMount, rowRenders: reads - rowsAtMount, tabRows: tabRowRenders() - tabRowsAtMount };
  };

  // From 144.25 up 60 rem, in each body under Whole lines: the renders are the changes of the height the release
  // lands on, the first move's included where 144.25 is not that body's whole lines.
  for (const [body, textScale, renders, why] of [
    ["list", 1, 2, "6 lines from 159.25, 7 from 188.25"],
    ["list", 1.5, 3, "one-line plates of 22, a pitch of 24: 7 lines from 156, 8 from 180, 9 from 204"],
    ["tiles", 1, 2, "their 2 whole lines' 144 at the first move, 3 from 177"],
    ["icons", 1, 2, "their 3 whole lines' 136 at the first move, 4 from 159"],
    ["cards", 1, 2, "rows of 46: their 3 whole rows' 142 at the first move, 4 from 166"],
  ] as const) {
    it(`under Whole lines redraws the ${body} at ${textScale * 100} % only as the lines the release lands on change: ${why}`, () => {
      const { renders: drawn, rowRenders } = drag(body, "whole", textScale);

      assert.equal(drawn, renders);
      assert.ok(rowRenders <= renders * ALL_ROWS, `${rowRenders}`);
    });
  }

  for (const topEdge of ["whole", "free"]) {
    it(`under ${topEdge === "whole" ? "Whole lines" : "Free"} plans the tab row and its readout at most once a pointer frame, not again for the echo`, () => {
      const { tabRows } = drag("list", topEdge);

      assert.ok(tabRows <= FRAMES, `${tabRows}`);
    });
  }

  // Under Free the box follows the pointer and the release keeps the height let go at, but the body draws the whole
  // lines under the pointer, so it draws again only as they change, as under Whole lines: about two renders for each
  // line crossed, the release's own height included, and each render reads its rows once. The icons and the cards sit
  // centred in the room, so a height between their lines would move every one of them.
  for (const [body, textScale, crossed] of [["list", 1, 2], ["list", 1.5, 3], ["tiles", 1, 2], ["icons", 1, 2], ["cards", 1, 2]] as const) {
    it(`under Free redraws the ${body} at ${textScale * 100} % only as the lines it draws change, not once a pointer frame`, () => {
      const { renders, rowRenders } = drag(body, "free", textScale);

      assert.ok(renders >= 1 && renders <= 2 * crossed, `${renders}`);
      assert.ok(rowRenders <= renders * ALL_ROWS, `${rowRenders}`);
    });
  }

  // A side edge sends nothing until its release, so the stored step the body draws from holds still. The readout's
  // words count its computations: each one calls its template's replace once, and a computation is one bodyGrid.
  for (const edge of ["right", "left"] as const) {
    it(`redraws no body, plans the tab row at most once a pointer frame and works the ${edge} edge's readout out once a step`, () => {
      let computed = 0;
      const counting = (template: string) => ({ replace: (from: string, to: string) => (computed++, template.replace(from, to)) }) as unknown as string;
      setTranslation("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragWidth]", counting("Width {0} · {1} buildings"));
      setTranslation("Tooltip.LABEL[BetterBuildingMenu.ReadoutDragWidthOnly]", counting("Width {0}"));
      showBody("list");
      setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(Array.from({ length: ROWS }, (_, at) => counted(at + 1))));
      act(() => {
        root = create(<AssetMenu onClose={() => {}} />);
      });
      const blocker = () => root!.root.find((node) => node.props.className === "widthBlocker");
      const rowsAtMount = reads;
      const rendersAtMount = bodyRenders();
      const tabRowsAtMount = tabRowRenders();

      // The strip is drawn as many pixels wide as it is rem, so a pixel is a rem; the right edge moves right, the left left.
      const sign = edge === "right" ? 1 : -1;
      act(() => root!.root.find((node) => node.props["data-bbm-edge"] === edge).props.onMouseDown({ button: 0, clientX: 500, currentTarget: { getBoundingClientRect: () => ({ width: ASSET_MENU_WIDTH_HANDLE_WIDTH }) } }));
      for (let frame = 1; frame <= FRAMES; frame++) {
        act(() => blocker().props.onMouseMove({ clientX: 500 + sign * frame * 4, buttons: 1 }));
        act(() => frames.splice(0).forEach((callback) => callback()));
        // Anything else that draws the menu again mid-drag.
        act(() => setBinding("BetterBuildingMenu", "AssetMenuAllCount", frame));
      }

      assert.ok(rowsAtMount > 0 && rendersAtMount > 0, "the body and its rows drew at mount");
      assert.equal(bodyRenders() - rendersAtMount, 0);
      assert.equal(reads - rowsAtMount, 0);
      assert.ok(tabRowRenders() - tabRowsAtMount <= 2 * FRAMES, `${tabRowRenders() - tabRowsAtMount}`);
      // 240 rem of travel crosses at most four midpoints from the first step.
      assert.ok(computed >= 1 && computed <= 5, `${computed}`);
      act(() => blocker().props.onMouseUp());
    });
  }
});
