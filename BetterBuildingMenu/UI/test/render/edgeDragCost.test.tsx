import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry, showBody } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { TOP_EDGE_HEIGHT } from "../../src/domain/assetMenuLayout";
import type { BuildingCatalogEntry } from "../../src/domain/buildingCatalog";
import { ListBody } from "../../src/mods/Bodies/ListBody";
import { TilesBody } from "../../src/mods/Bodies/TilesBody";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";

// What a drag of the top edge re-renders: the body, counted by each change of the props its memo compares,
// and its rows, each of which reads its entry's prefabName twice a render (the name is blank). The height
// each frame sends comes back in the binding, as C# echoes it.
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

describe("what a drag of the top edge re-renders", () => {
  let root: ReactTestRenderer | undefined;
  let frames: Array<() => void> = [];
  let saved: unknown;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    reads = 0;
    saved = globals.document;
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    frames = [];
    globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  /** Mounts the menu in this body under this Top edge, drags the edge up a rem a frame, and releases it. */
  const drag = (body: "list" | "tiles", topEdge: string) => {
    showBody(body);
    setBinding("BetterBuildingMenu", "AssetMenuTopEdge", topEdge);
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(Array.from({ length: ROWS }, (_, at) => counted(at + 1))));
    act(() => {
      root = create(<AssetMenu onClose={() => {}} />);
    });
    const kind = body === "list" ? ListBody : TilesBody;
    // The memo's own component, whose props it compares.
    const bodyOf = (): ReactTestInstance => root!.root.find((node) => node.type === (kind as unknown as { type: unknown }).type);
    let props = bodyOf().props;
    let bodyRenders = 0;
    const count = () => {
      const next = bodyOf().props;
      if (Object.keys(next).some((key) => next[key] !== props[key])) bodyRenders += 1;
      props = next;
    };
    // Echoes what the drag sends since the last echo, as C# does.
    let echoed = 0;
    const echo = () => {
      const sent = triggers.filter((call) => call.name === "SetAssetMenuHeight");
      for (const call of sent.slice(echoed)) act(() => setBinding("BetterBuildingMenu", "AssetMenuHeight", call.args[0]));
      echoed = sent.length;
      count();
    };
    const blocker = () => root!.root.find((node) => node.props.className === "resizeBlocker");
    const rowsAtMount = reads;

    // The edge is drawn as many pixels tall as it is rem, so a pixel is a rem.
    act(() => root!.root.find((node) => node.props.className === "topEdge").props.onMouseDown({ button: 0, clientY: 500, currentTarget: { getBoundingClientRect: () => ({ height: TOP_EDGE_HEIGHT }) } }));
    for (let frame = 1; frame <= FRAMES; frame++) {
      act(() => blocker().props.onMouseMove({ clientY: 500 - frame, buttons: 1 }));
      act(() => frames.splice(0).forEach((callback) => callback()));
      echo();
    }
    act(() => blocker().props.onMouseUp());
    echo();

    assert.ok(rowsAtMount > 0, "the rows drew at mount");
    return { bodyRenders, rowRenders: reads - rowsAtMount };
  };

  it("under Whole lines redraws the list only as the lines the release lands on change", () => {
    // From 144.25 up 60 rem: the release lands on 6 lines from 159.25, on 7 from 188.25.
    const { bodyRenders, rowRenders } = drag("list", "whole");

    assert.equal(bodyRenders, 2);
    assert.ok(rowRenders <= 2 * ALL_ROWS, `${rowRenders}`);
  });

  it("under Whole lines redraws the tiles only as their lines change, never for the name line's room", () => {
    // Tiles of 64 draw at their 2 whole lines' 144 from the first move, and land on 3 from 177.
    const { bodyRenders, rowRenders } = drag("tiles", "whole");

    assert.equal(bodyRenders, 2);
    assert.ok(rowRenders <= 2 * ALL_ROWS, `${rowRenders}`);
  });

  it("under Free redraws the list at most once a frame, and its rows only as its lines change", () => {
    // The list draws 6 lines from 173.5 and 7 from 202.75.
    const { bodyRenders, rowRenders } = drag("list", "free");

    assert.ok(bodyRenders <= FRAMES, `${bodyRenders}`);
    assert.ok(rowRenders <= 2 * ALL_ROWS, `${rowRenders}`);
  });

  it("under Free redraws the tiles at most once a frame, and the tiles themselves only as their lines change", () => {
    // The name line's room under the tiles grows each frame; the tiles' places do not.
    const { bodyRenders, rowRenders } = drag("tiles", "free");

    assert.ok(bodyRenders <= FRAMES, `${bodyRenders}`);
    assert.ok(rowRenders <= 2 * ALL_ROWS, `${rowRenders}`);
  });
});
