import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, count } from "../harness/render";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { MenuCategoryStrip } from "../../src/mods/MenuCategoryStrip/MenuCategoryStrip";

const category = (id: string) => ({ id, name: id, icon: `Media/Game/Icons/${id}.svg`, priority: 0 });

const seed = (menu: string) => {
  setBinding("BetterBuildingMenu", "AssetMenu", menu);
  setBinding("BetterBuildingMenu", "AssetMenuCategories", [category("Small Roads"), category("Medium Roads")]);
  setBinding("BetterBuildingMenu", "AssetMenuCategory", "");
  setBinding("BetterBuildingMenu", "AssetMenuCategoryCounts", [
    { id: "", count: 40 },
    { id: "Small Roads", count: 24 },
    { id: "Medium Roads", count: 16 },
  ]);
  // The branch fallback the strip draws where a menu has no categories — it
  // must obey the same guard, because All menus has branches too.
  setBinding("BetterBuildingMenu", "AssetMenuStripTabs", [
    { id: "Fossil", count: 7, icon: "" },
    { id: "Renewable", count: 5, icon: "" },
  ]);
};

const render = () => renderHtml(<MenuCategoryStrip />);

describe("the category strip", () => {
  beforeEach(() => resetBindings());

  it("draws tabs for a scoped menu", () => {
    seed("Roads");
    const html = render();

    assert.match(html, /class="strip"/);
    assert.ok(count(html, /aria-label="/) >= 3, "All plus a tab per category");
  });

  it("draws nothing while the asset menu is unscoped", () => {
    // Under All menus the strip would publish every category of every menu
    // and wrap to four rows of icon-only tabs.
    seed("");
    const html = render();

    assert.equal(html, "", `expected no strip, got ${html.slice(0, 120)}`);
  });

  it("says the All count C# sends, not a sum of the tabs", () => {
    seed("Roads");
    setBinding("BetterBuildingMenu", "AssetMenuAllCount", 37);

    assert.match(render(), /aria-label="All \(37\)"/);
  });

  it("keeps a tab the filters empty where it was, faint", () => {
    seed("Roads");
    setBinding("BetterBuildingMenu", "AssetMenuCategoryCounts", [{ id: "Small Roads", count: 0 }, { id: "Medium Roads", count: 16 }]);

    assert.match(render(), /class="[^"]*tabEmpty[^"]*"[^>]*aria-label="Small Roads \(0\)"/);
  });
});
