import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { AssetMenu } from "../../src/mods/BuildingMenu/AssetMenu";

// The widths AssetMenu writes inline, read off the markup by class.
const widthOf = (html: string, className: string): number =>
  Number(new RegExp(`class="${className}"[^>]*style="width:\\s*([0-9.]+)rem`).exec(html)?.[1]);
const render = () => renderHtml(<AssetMenu onClose={() => {}} />);

describe("the asset menu's row", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 1441);
  });

  it("draws today's layout by default: the menu filling the room, the pane beside it, the strip on its edge", () => {
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1476);
    assert.equal(widthOf(html, "toolContainer"), 1091);
    assert.match(html, /class="pane"/);
    assert.match(html, /class="widthHandle"/);
  });

  it("leaves the pane out when it is hidden, and gives the menu the whole band", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const html = render();

    assert.equal(widthOf(html, "assetMenuRow"), 1476);
    assert.equal(widthOf(html, "toolContainer"), 1476);
    assert.doesNotMatch(html, /class="pane"/);
  });

  it("is no wider than the menu and the pane, so nothing beside a narrow menu takes the mouse", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 900);
    const html = render();

    assert.equal(widthOf(html, "toolContainer"), 900);
    assert.equal(widthOf(html, "assetMenuRow"), 1285);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    assert.equal(widthOf(render(), "assetMenuRow"), 900);
  });
});
