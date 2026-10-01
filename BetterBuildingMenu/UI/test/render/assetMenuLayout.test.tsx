import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_CATALOG_MIN_WIDTH, ASSET_MENU_TABLE_MIN_WIDTH } from "../../src/domain/assetMenuLayout";
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
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 1091, rowWidth: 1476, paneShown: true, minWidth: ASSET_MENU_CATALOG_MIN_WIDTH });
  });

  it("gives the menu the whole band when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 1476, rowWidth: 1476, paneShown: false, minWidth: ASSET_MENU_CATALOG_MIN_WIDTH });
  });

  it("sizes the row to a chosen width, leaving no empty stretch", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 900);
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 900, rowWidth: 1285, paneShown: true, minWidth: ASSET_MENU_CATALOG_MIN_WIDTH });
  });

  it("draws a chosen width that no longer fits at the room, and gives it back when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 1200);
    assert.equal(read().menuWidth, 1091);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.equal(read().menuWidth, 1200);
  });

  it("draws the table no narrower than its columns need, and keeps the chosen width for the other views", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 735);
    setAssetMenuView({ viewMode: "table" });
    assert.deepEqual(read(), {
      bandWidth: 1476,
      menuWidth: ASSET_MENU_TABLE_MIN_WIDTH,
      rowWidth: ASSET_MENU_TABLE_MIN_WIDTH + 385,
      paneShown: true,
      minWidth: ASSET_MENU_TABLE_MIN_WIDTH,
    });

    setAssetMenuView({ viewMode: "grid" });
    assert.equal(read().menuWidth, 735);
  });
});
