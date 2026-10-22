import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { catalogPage, entry } from "../harness/render";
import { installFakeBrowser } from "../harness/fakeBrowser";
import { resetBindings, triggers } from "../harness/stubs/cs2-api";
import { mountEach } from "../harness/mount";
import { seed } from "../harness/seed";
import { getAssetMenuAnchorKey, resetAssetMenuView, setAssetMenuAnchor, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { CATALOG_WINDOW_STEP } from "../../src/domain/catalogWindow";
import { AssetMenuHeight$, AssetMenuWidth$, BuildingCatalog$ } from "../../src/mods/bindings";

// Mounted, so the button's handler runs. The effects need a document and a
// frame clock; neither does anything here.
describe("Load more", () => {
  const tree = mountEach();

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    installFakeBrowser({ frames: "none" });
    seed(AssetMenuWidth$, 700);
  });

  it("names the window it wants, so a double click grows it once", () => {
    // A bare "one more" would add a step per copy in C#; the same limit twice
    // is a no-op there (AssetMenuState.LoadMoreTo).
    setAssetMenuView({ viewMode: "table" });
    seed(BuildingCatalog$, catalogPage([entry(1), entry(2)], { hasMore: true, totalCount: 403, limit: 300 }));
    tree.mount(<BuildingCatalogComponent />);

    const button = tree.root.find((node) => node.props.className === "loadMore" && typeof node.props.onSelect === "function");
    act(() => button.props.onSelect());
    act(() => button.props.onSelect());

    const requests = triggers.filter((call) => call.name === "LoadMoreBuildingCatalog").map((call) => call.args);
    assert.deepEqual(requests, [[300 + CATALOG_WINDOW_STEP], [300 + CATALOG_WINDOW_STEP]]);
  });

  const page40 = () => catalogPage(Array.from({ length: 40 }, (_, i) => entry(i + 1)), { hasMore: true, totalCount: 204, limit: 40 });
  const drawnRows = () => tree.root.findAll((node) => typeof node.type === "string" && node.props["data-catalog-entry"] !== undefined).length;
  const loadMoreButton = () => tree.root.find((node) => node.props.className === "loadMore" && typeof node.props.onSelect === "function");

  it("draws a screen of the table's rows, not the whole page", () => {
    // 420 rem of catalog over 92 rem rows reaches five rows; two more to scroll into.
    setAssetMenuView({ viewMode: "table" });
    seed(AssetMenuHeight$, 420);
    seed(BuildingCatalog$, page40());
    tree.mount(<BuildingCatalogComponent />);

    assert.equal(drawnRows(), 7);
  });

  it("draws the page's next screen before asking C# for more", () => {
    setAssetMenuView({ viewMode: "table" });
    seed(AssetMenuHeight$, 420);
    seed(BuildingCatalog$, page40());
    tree.mount(<BuildingCatalogComponent />);

    act(() => loadMoreButton().props.onSelect());

    assert.equal(drawnRows(), 14);
    assert.equal(triggers.filter((call) => call.name === "LoadMoreBuildingCatalog").length, 0);

    for (let i = 0; i < 4; i++) act(() => loadMoreButton().props.onSelect());
    assert.equal(drawnRows(), 40);

    act(() => loadMoreButton().props.onSelect());
    assert.deepEqual(triggers.filter((call) => call.name === "LoadMoreBuildingCatalog").map((call) => call.args), [[40 + CATALOG_WINDOW_STEP]]);
  });

  it("draws far enough to reach a building the menu returns to", () => {
    // Placed from row 31: the next open scrolls back to it, so its row must be drawn.
    setAssetMenuView({ viewMode: "table" });
    seed(AssetMenuHeight$, 420);
    seed(BuildingCatalog$, page40());
    setAssetMenuAnchor(getAssetMenuAnchorKey({ list: "catalog", viewMode: "table", groupBy: "category" }), 31);
    tree.mount(<BuildingCatalogComponent />);

    assert.equal(drawnRows(), 33);
  });

  it("draws the whole page in the grid, which shows most of it", () => {
    setAssetMenuView({ viewMode: "grid" });
    seed(AssetMenuHeight$, 420);
    seed(BuildingCatalog$, page40());
    tree.mount(<BuildingCatalogComponent />);

    assert.equal(drawnRows(), 40);
  });
});
