import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry, catalogPage, showBody } from "../harness/render";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { FALLBACK_SEPARATORS, groupDigits } from "../../src/domain/assetMenuMetricFormat";

const page = (over: Record<string, unknown> = {}) =>
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], over));
const render = () => renderHtml(<BuildingCatalogComponent />);
const BODIES = ["list", "tiles", "cards"];

describe("the catalog container", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  for (const body of BODIES) {
    it(`ends the feed with a load-more inside the scroll in the ${body} body`, () => {
      // Below the scroll is where nobody reads it. The number too: on
      // Landscaping that is 100 rows of 368 with nothing on screen saying so.
      showBody(body);
      page({ hasMore: true, totalCount: 403 });
      const html = render();
      const scroll = html.indexOf('data-scrollable="true"');
      const more = html.indexOf('class="loadMoreRow"');

      assert.ok(scroll >= 0, `${body}: expected a scroll container`);
      assert.ok(more > scroll, `${body}: the load-more must sit inside the scroll`);
      // The tab row's readout states the window; the end of the list offers to grow it.
      assert.match(html, /Load 100 more/);
      assert.doesNotMatch(html, /Showing/);
    });

    it(`offers to widen a scoped miss in the ${body} body`, () => {
      // A search that misses must not simply say "No buildings match": that
      // leaves no count of what exists elsewhere and no way there.
      showBody(body);
      page({ items: [], totalCount: 0 });
      setBinding("BetterBuildingMenu", "CurrentSearch", "police");
      setBinding("BetterBuildingMenu", "BuildingCatalogMatchesElsewhere", 5);
      const html = render();

      assert.match(html, /No matches here — 5 elsewhere/);
      assert.match(html, /aria-label="Search everything"/);
    });

    it(`draws the cap line inside the scroll in the ${body} body`, () => {
      showBody(body);
      page({ hasMore: false, capped: true, totalCount: 14876 });
      const html = render();

      assert.ok(html.indexOf('class="loadMoreRow"') > html.indexOf('data-scrollable="true"'), body);
    });
  }

  it("groups the digits of the cap line's count like every other number in the asset menu", () => {
    // Built by hand, the count reads "Showing 2000 of 4206" beside cells that
    // group theirs. toLocaleString would group it under node and not in Cohtml.
    showBody("list");
    page({ hasMore: false, capped: true, totalCount: 4206 });
    const html = render();

    assert.ok(html.includes(`Showing 2 of ${groupDigits(4206, FALLBACK_SEPARATORS)} · `));
    assert.doesNotMatch(html, /4206/);
  });

  it("names one step on the load-more, however large the window has grown", () => {
    // Three loads in, the window is 300 rows; a click still adds 100.
    showBody("list");
    page({ hasMore: true, totalCount: 403, limit: 300 });

    assert.match(render(), /Load 100 more/);
  });

  it("draws no load-more when the window holds everything", () => {
    showBody("list");
    page({ hasMore: false, totalCount: 2 });

    assert.doesNotMatch(render(), /class="loadMoreRow"/);
  });

  it("says a list stopped at the ceiling, with its true total and how to narrow it, and offers no Load more", () => {
    showBody("list");
    page({ hasMore: false, capped: true, totalCount: 14876 });
    const html = render();

    assert.ok(
      html.includes(`Showing 2 of ${groupDigits(14876, FALLBACK_SEPARATORS)} · narrow with a tab, the search or a filter`),
      "the cap line");
    assert.match(html, /windowState windowStateCapped/);
    assert.doesNotMatch(html, /class="loadMore"/);
  });

  it("names the constraints that emptied the list rather than blaming search", () => {
    showBody("list");
    page({ items: [], totalCount: 0 });

    assert.match(render(), /class="empty"/);
  });

  it("says the menu is still being indexed while no row has come", () => {
    showBody("list");
    page({ items: [], totalCount: 0, status: "indexing" });

    assert.match(render(), /Indexing buildings…/);
  });

  it("draws the menu's own pick", () => {
    showBody("cards");
    page();

    assert.match(render(), /class="item itemCard"/);
  });

  it("draws Default view's body for a menu with no pick of its own", () => {
    showBody("");
    setBinding("BetterBuildingMenu", "AssetMenuDefaultView", "cards");
    page();

    assert.match(render(), /class="item itemCard"/);
  });

  it("draws the look's Auto for a menu with no pick under Default view's Auto", () => {
    showBody("", "Zones");
    setBinding("BetterBuildingMenu", "MenuShares", [{ menu: "Zones", rows: 96, costOrCapacity: 0, capacity: 0, locked: 14 }]);
    page();
    const html = render();

    assert.doesNotMatch(html, /itemCard/);
    assert.doesNotMatch(html, /data-bbm-view="list"/);
  });

  it("draws the list while a query is typed, whatever the menu's tiles", () => {
    showBody("tiles");
    setBinding("BetterBuildingMenu", "CurrentSearch", "four");
    page();

    assert.match(render(), /data-bbm-view="list"/);
  });

  it("keeps Cards while a query is typed in a menu whose view is Cards", () => {
    showBody("cards");
    setBinding("BetterBuildingMenu", "CurrentSearch", "four");
    page();

    assert.match(render(), /class="item itemCard"/);
  });

  it("draws no control chrome of its own", () => {
    // Sort, Filter, Group and View live on the top row and in the control pane.
    showBody("tiles");
    page();
    const html = render();

    for (const gone of [/class="toolbar"/, /class="heading"/, /class="sortBar"/, /data-sort-options/, /class="columnHeader"/]) {
      assert.doesNotMatch(html, gone);
    }
  });

  for (const body of BODIES) {
    it(`marks every row with the id the scroll hooks find it by in the ${body} body`, () => {
      showBody(body);
      page();
      const html = render();

      assert.match(html, /data-catalog-entry="1"/);
      assert.match(html, /data-catalog-entry="2"/);
    });
  }
});
