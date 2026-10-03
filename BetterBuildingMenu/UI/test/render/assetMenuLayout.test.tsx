import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_CATALOG_FULL } from "../../src/domain/assetMenuLayout";
import { useAssetMenuLayout, type AssetMenuLayout } from "../../src/mods/useAssetMenuLayout";

let layout: AssetMenuLayout;
const Probe = () => {
  layout = useAssetMenuLayout();
  return null;
};
const read = () => {
  act(() => {
    create(<Probe />);
  });
  return layout;
};

describe("the asset menu's layout", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 1441);
  });

  it("draws today's layout by default: the menu filling the room beside the pane", () => {
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 1091, rowWidth: 1476, paneShown: true });
  });

  it("keeps the default width when the pane is hidden, so the toggle moves nothing it has room for", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 1091, rowWidth: 1091, paneShown: false });
  });

  it("gives the menu the whole band when the player fills it with the pane hidden", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", ASSET_MENU_CATALOG_FULL);
    // Less half the width strip, so its outer half stays inside the band.
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 1471, rowWidth: 1471, paneShown: false });
  });

  it("narrows the band by what vanilla's tool column gains at a larger text scale", () => {
    setBinding("options", "textScale", 1.5);
    assert.deepEqual(read(), { bandWidth: 1381, menuWidth: 996, rowWidth: 1381, paneShown: true });
  });

  it("sizes the row to a chosen width, leaving no empty stretch", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 900);
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 900, rowWidth: 1285, paneShown: true });
  });

  it("draws a chosen width that no longer fits at the room, and gives it back when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 1200);
    assert.equal(read().menuWidth, 1091);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.equal(read().menuWidth, 1200);
  });

  it("draws every view at the player's width, the table included", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 735);
    setAssetMenuView({ viewMode: "table" });
    assert.equal(read().menuWidth, 735);
  });
});
