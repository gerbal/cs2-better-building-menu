import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry, showBody } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { cellsDrawn } from "../harness/stubs/cs2-ui";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

// Mounted, so the button's handler runs. The effects need a document and a
// frame clock; neither does anything here.
const globals = globalThis as unknown as Record<string, unknown>;

describe("Load more", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("names the window it wants, so a double click grows it once", () => {
    // A bare "one more" would add a step per copy in C#; the same limit twice
    // is a no-op there (AssetMenuState.LoadMoreTo).
    showBody("list");
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

  // The page as the binding sends it: new objects every time, the window a prefix of the result.
  const pageOf = (count: number, total: number) => catalogPage(
    JSON.parse(JSON.stringify(Array.from({ length: count }, (_, at) => entry(at + 1, { name: `Plaza ${at + 1}` })))),
    { hasMore: count < total, totalCount: total, limit: count },
  );

  for (const body of ["list", "tiles"]) {
    it(`draws only a step's new rows in the ${body}, each loaded row kept as it was`, () => {
      showBody(body);
      setBinding("BetterBuildingMenu", "BuildingCatalog", pageOf(300, 1_000));
      act(() => {
        root = create(<BuildingCatalogComponent />);
      });

      cellsDrawn.count = 0;
      act(() => setBinding("BetterBuildingMenu", "BuildingCatalog", pageOf(400, 1_000)));

      assert.equal(cellsDrawn.count, 100, body);
    });
  }

  it("asks for no more than the rows a fold leaves", () => {
    showBody("list");
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], { hasMore: true, totalCount: 403, visibleCount: 150, limit: 100 }));
    act(() => {
      root = create(<BuildingCatalogComponent />);
    });

    act(() => root!.root.find((node) => node.props.className === "loadMore" && typeof node.props.onSelect === "function").props.onSelect());

    assert.deepEqual(triggers.filter((call) => call.name === "LoadMoreBuildingCatalog").at(-1)?.args, [150]);
  });
});
