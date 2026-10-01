import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry, catalogPage } from "../harness/render";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { FALLBACK_SEPARATORS, groupDigits } from "../../src/domain/assetMenuMetricFormat";

const page = (over: Record<string, unknown> = {}) =>
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], over));
const render = () => renderHtml(<BuildingCatalogComponent />);

describe("the catalog container", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 700);
  });

  for (const mode of ["table", "grid", "list", "cards"]) {
    it(`ends the feed with a load-more inside the scroll in ${mode} mode`, () => {
      // Below the scroll is where nobody reads it. The number too: on
      // Landscaping that is 100 rows of 368 with nothing on screen saying so.
      setAssetMenuView({ viewMode: mode });
      page({ hasMore: true, totalCount: 403 });
      const html = render();
      const scroll = html.indexOf('data-scrollable="true"');
      const more = html.indexOf('class="loadMoreRow"');

      assert.ok(scroll >= 0, `${mode}: expected a scroll container`);
      assert.ok(more > scroll, `${mode}: the load-more must sit inside the scroll`);
      assert.match(html, /Showing 2 of 403/);
    });

    it(`offers to widen a scoped miss in ${mode} mode`, () => {
      // A search that misses in Table mode must not simply say "No buildings
      // match": that leaves no count of what exists elsewhere and no way there.
      setAssetMenuView({ viewMode: mode });
      page({ items: [], totalCount: 0 });
      setBinding("BetterBuildingMenu", "CurrentSearch", "police");
      setBinding("BetterBuildingMenu", "BuildingCatalogMatchesElsewhere", 5);
      const html = render();

      assert.match(html, /No matches here — 5 elsewhere/);
      assert.match(html, /aria-label="Search everything"/);
    });
  }

  it("groups the digits of the window count like every other number in the asset menu", () => {
    // Built by hand, the count read "Showing 1200 of 4206" beside cells that
    // group theirs. toLocaleString would group it under node and not in Cohtml.
    setAssetMenuView({ viewMode: "table" });
    page({ hasMore: true, totalCount: 4206 });
    const html = render();

    assert.ok(html.includes(`Showing 2 of ${groupDigits(4206, FALLBACK_SEPARATORS)}`));
    assert.doesNotMatch(html, /4206/);
  });

  it("names one step on the load-more, however large the window has grown", () => {
    // Three loads in, the window is 300 rows; a click still adds 100.
    setAssetMenuView({ viewMode: "table" });
    page({ hasMore: true, totalCount: 403, limit: 300 });

    assert.match(render(), /Load 100 more/);
  });

  it("draws no load-more when the window holds everything", () => {
    setAssetMenuView({ viewMode: "table" });
    page({ hasMore: false, totalCount: 2 });

    assert.doesNotMatch(render(), /class="loadMoreRow"/);
  });

  it("obeys the chosen view mode whatever the width", () => {
    // Overridden to "grid" at the resting height, pressing Table would light
    // the button, change nothing, and say nothing about why.
    setAssetMenuView({ viewMode: "table" });
    page();

    for (const width of [300, 700, 1100]) {
      setBinding("BetterBuildingMenu", "AssetMenuWidth", width);
      assert.match(render(), /class="columnHeader"/, `width ${width}`);
    }
  });

  it("names the constraints that emptied the table rather than blaming search", () => {
    setAssetMenuView({ viewMode: "table" });
    page({ items: [], totalCount: 0 });

    assert.match(render(), /class="empty"/);
  });

  it("draws no control chrome of its own", () => {
    // Identity, count, Group by, Sort by and the view mode live in the
    // control plane beside the build menu, visible at the strip height this rests
    // at.
    setAssetMenuView({ viewMode: "grid" });
    page();
    const html = render();

    for (const gone of [/class="toolbar"/, /class="heading"/, /class="sortBar"/, /data-sort-options/]) {
      assert.doesNotMatch(html, gone);
    }
  });

  it("marks every row with the id the scroll hooks find it by", () => {
    setAssetMenuView({ viewMode: "table" });
    page();
    const html = render();

    assert.match(html, /data-catalog-entry="1"/);
    assert.match(html, /data-catalog-entry="2"/);
  });
});

describe("the table under a larger text scale", () => {
  // The game's Interface › Text scale reaches the page as ("options",
  // "textScale"), and a column width that assumes 100 % clips its figures
  // above it. The columns follow the S size's own growth; see domain/textScale.ts.
  it("widens the metric columns by the S size's ratio", () => {
    resetBindings();
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], {}));
    // Wide, so the room beside the name does not cap the ratio — at a 720p
    // width it does, and the columns grow only as far as the name allows.
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 2400);
    const widthOf = (html: string) => Number(/metricUpkeep[^>]*style="[^"]*width:\s*([0-9.]+)rem/.exec(html)?.[1]);

    const base = widthOf(render());
    setBinding("options", "textScale", 1.25);
    const scaled = widthOf(render());

    assert.ok(base > 0, `base upkeep width ${base}`);
    assert.equal(scaled, Math.round(base * (21.35 / 14)));
  });
});

describe("the table follows the build menu's width", () => {
  // Cost, because its column has a range (76 to 100); upkeep's minimum is its maximum.
  const costWidth = (html: string) => Number(/metricCost[^>]*style="[^"]*width:\s*([0-9.]+)rem/.exec(html)?.[1]);

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setAssetMenuView({ viewMode: "table" });
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], {}));
    setBinding("BetterBuildingMenu", "AssetMenuWidth", 1441);
  });

  it("drops columns rather than clip them when the player narrows the menu", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 735);
    const html = render();

    assert.match(html, /metricCost/);
    assert.match(html, /metricUpkeep/);
    for (const dropped of ["metricWorkers", "metricCapacity", "metricLot", "metricLevel", "metricParking"]) {
      assert.doesNotMatch(html, new RegExp(dropped), dropped);
    }
    assert.equal(costWidth(html), 100);
  });

  it("keeps the column the table is sorted by at any width", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCatalogWidth", 735);
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "HasParking");

    assert.match(render(), /metricParking/);
  });

  it("keeps the columns it has at fill when the pane is hidden: the table's arithmetic counts the pane either way", () => {
    const shown = costWidth(render());
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);

    assert.ok(costWidth(render()) >= shown);
  });
});
