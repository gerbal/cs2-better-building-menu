import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
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

  it("gives the menu the whole band when the pane is hidden", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    // Less half the width strip, so its outer half stays inside the band.
    assert.deepEqual(read(), { bandWidth: 1476, menuWidth: 1471, rowWidth: 1471, paneShown: false });
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
