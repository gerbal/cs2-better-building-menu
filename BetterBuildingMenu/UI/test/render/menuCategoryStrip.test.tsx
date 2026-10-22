import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, count } from "../harness/render";
import { resetBindings } from "../harness/stubs/cs2-api";
import { seed as seedBinding } from "../harness/seed";
import { MenuCategoryStrip } from "../../src/mods/MenuCategoryStrip/MenuCategoryStrip";
import {
  AssetMenu$,
  AssetMenuCategories$,
  AssetMenuCategory$,
  AssetMenuCategoryCounts$,
  AssetMenuStripTabs$,
} from "../../src/mods/bindings";

const category = (id: string) => ({ id, name: id, icon: `Media/Game/Icons/${id}.svg`, priority: 0 });

const seed = (menu: string) => {
  seedBinding(AssetMenu$, menu);
  seedBinding(AssetMenuCategories$, [category("Small Roads"), category("Medium Roads")]);
  seedBinding(AssetMenuCategory$, "");
  seedBinding(AssetMenuCategoryCounts$, [
    { id: "", count: 40 },
    { id: "Small Roads", count: 24 },
    { id: "Medium Roads", count: 16 },
  ]);
  // The branch fallback the strip draws where a menu has no categories — it
  // must obey the same guard, because All menus has branches too.
  seedBinding(AssetMenuStripTabs$, [
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
});
