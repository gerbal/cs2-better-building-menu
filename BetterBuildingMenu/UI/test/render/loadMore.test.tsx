import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetLensView, setLensView } from "../../src/domain/lensViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

// Mounted, so the button's handler runs. The effects need a document and a
// frame clock; neither does anything here.
const globals = globalThis as unknown as Record<string, unknown>;

describe("Load more", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetLensView();
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
    setBinding("BetterBuildingMenu", "PanelWidth", 700);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("names the window it wants, so a double click grows it once", () => {
    // A bare "one more" would add a step per copy in C#; the same limit twice
    // is a no-op there (BuildingCatalogLensState.LoadMoreTo).
    setLensView({ viewMode: "table" });
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], { hasMore: true, totalCount: 403, limit: 300 }));
    act(() => {
      root = create(<BuildingCatalogComponent />);
    });

    const button = root!.root.find((node) => node.props.className === "loadMore" && typeof node.props.onSelect === "function");
    act(() => button.props.onSelect());
    act(() => button.props.onSelect());

    const requests = triggers.filter((call) => call.name === "LoadMoreBuildingCatalog").map((call) => call.args);
    assert.deepEqual(requests, [[400], [400]]);
  });
});
