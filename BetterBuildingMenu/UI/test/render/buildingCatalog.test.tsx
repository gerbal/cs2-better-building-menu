import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml, entry, catalogPage } from "../harness/render";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { FALLBACK_SEPARATORS, groupDigits } from "../../src/domain/assetMenuMetricFormat";
import {
  ASSET_MENU_CHROME_WIDTH,
  ASSET_MENU_COLUMN_MAX,
  ASSET_MENU_TABLE_ROW_FURNITURE,
  type AssetMenuMetric,
} from "../../src/domain/assetMenuLayout";
import { shortenTileLabel, tableLabelCharBudget } from "../../src/domain/tileLabel";

const page = (over: Record<string, unknown> = {}) =>
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], over));
const render = () => renderHtml(<BuildingCatalogComponent />);

describe("the catalog container", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
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
      // The tab row's readout states the window; the end of the list offers to grow it.
      assert.match(html, /Load 100 more/);
      assert.doesNotMatch(html, /Showing/);
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

  it("groups the digits of the cap line's count like every other number in the asset menu", () => {
    // Built by hand, the count read "Showing 2000 of 4206" beside cells that
    // group theirs. toLocaleString would group it under node and not in Cohtml.
    setAssetMenuView({ viewMode: "table" });
    page({ hasMore: false, capped: true, totalCount: 4206 });
    const html = render();

    assert.ok(html.includes(`Showing 2 of ${groupDigits(4206, FALLBACK_SEPARATORS)} · `));
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

  it("says a list stopped at the ceiling, with its true total and how to narrow it, and offers no Load more", () => {
    setAssetMenuView({ viewMode: "table" });
    page({ hasMore: false, capped: true, totalCount: 14876 });
    const html = render();

    assert.ok(
      html.includes(`Showing 2 of ${groupDigits(14876, FALLBACK_SEPARATORS)} · narrow with a tab, the search or a filter`),
      "the cap line");
    assert.match(html, /windowState windowStateCapped/);
    assert.doesNotMatch(html, /class="loadMore"/);
  });

  it("offers Load more while the window can still grow, and leaves the window to the readout", () => {
    setAssetMenuView({ viewMode: "list" });
    page({ hasMore: true, totalCount: 403 });
    const html = render();

    assert.match(html, /Load 100 more/);
    assert.doesNotMatch(html, /Showing/);
  });

  for (const mode of ["table", "grid", "list", "cards"]) {
    it(`draws the cap line inside the scroll in ${mode} mode`, () => {
      setAssetMenuView({ viewMode: mode });
      page({ hasMore: false, capped: true, totalCount: 14876 });
      const html = render();

      assert.ok(html.indexOf('class="loadMoreRow"') > html.indexOf('data-scrollable="true"'), mode);
    });
  }

  it("obeys the chosen view mode at every Width step", () => {
    // Overridden to "grid" at the resting height, pressing Table would light
    // the button, change nothing, and say nothing about why.
    setAssetMenuView({ viewMode: "table" });
    page();

    for (const step of [1, 3, 5]) {
      setBinding("BetterBuildingMenu", "AssetMenuWidthStep", step);
      assert.match(render(), /class="columnHeader"/, `step ${step}`);
    }
  });

  it("names the constraints that emptied the table rather than blaming search", () => {
    setAssetMenuView({ viewMode: "table" });
    page({ items: [], totalCount: 0 });

    assert.match(render(), /class="empty"/);
  });

  it("draws the view C# kept while nothing was picked this session", () => {
    setBinding("BetterBuildingMenu", "AssetMenuViewMode", "list");
    page();
    const html = render();

    assert.match(html, /class="item"/);
    assert.doesNotMatch(html, /itemCard/);
  });

  it("draws the session's pick over the kept view", () => {
    setBinding("BetterBuildingMenu", "AssetMenuViewMode", "list");
    setAssetMenuView({ viewMode: "cards" });
    page();

    assert.match(render(), /class="item itemCard"/);
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
    // The widest step with the pane hidden, so the room beside the name does not
    // cap the ratio: at a narrow menu the columns grow only as far as the name allows.
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const widthOf = (html: string) => Number(/metricUpkeep[^>]*style="[^"]*width:\s*([0-9.]+)rem/.exec(html)?.[1]);

    const base = widthOf(render());
    setBinding("options", "textScale", 1.25);
    const scaled = widthOf(render());

    assert.ok(base > 0, `base upkeep width ${base}`);
    assert.equal(scaled, Math.round(base * (21.35 / 14)));
  });
});

describe("the table follows the build menu's Width step", () => {
  // Cost, because its column has a range (76 to 100); upkeep's minimum is its maximum.
  const costWidth = (html: string) => Number(/metricCost[^>]*style="[^"]*width:\s*([0-9.]+)rem/.exec(html)?.[1]);

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setAssetMenuView({ viewMode: "table" });
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], {}));
  });

  it("drops columns rather than clip them at the game's own width", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 1);
    const html = render();

    assert.match(html, /metricCost/);
    assert.match(html, /metricUpkeep/);
    for (const dropped of ["metricWorkers", "metricCapacity", "metricLot", "metricLevel", "metricParking"]) {
      assert.doesNotMatch(html, new RegExp(dropped), dropped);
    }
    assert.equal(costWidth(html), 100);
  });

  it("keeps the column the table is sorted by at any width", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 1);
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "HasParking");

    assert.match(render(), /metricParking/);
  });

  it("keeps the lot column when sorted by lot depth, as by lot width: one cell shows both", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 1);
    setBinding("BetterBuildingMenu", "BuildingCatalogSortColumn", "LotDepth");

    assert.match(render(), /metricLot/);
  });

  it("keeps the columns it has when the pane is hidden: the table's arithmetic counts the pane either way", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    const shown = costWidth(render());
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);

    assert.ok(costWidth(render()) >= shown);
  });
});

describe("the table's names follow the build menu's width", () => {
  // Long enough to be shortened at every width the menu reaches.
  const name = "Regional Transit Interchange with Underground Parking, Bus Terminal and Rooftop Gardens Extension";
  // The room the name has: the build menu, less its chrome, the columns at their
  // comfortable widths and the row's furniture. The width strip sits in the
  // catalog's own margin and takes none of it.
  const shortenedAt = (menuWidth: number, metrics: AssetMenuMetric[]) => shortenTileLabel(
    name,
    tableLabelCharBudget(
      menuWidth - ASSET_MENU_CHROME_WIDTH
        - metrics.reduce((total, metric) => total + ASSET_MENU_COLUMN_MAX[metric], 0)
        - ASSET_MENU_TABLE_ROW_FURNITURE
    )
  );
  const ALL: AssetMenuMetric[] = ["cost", "upkeep", "workers", "capacity", "lot", "level", "parking"];

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setAssetMenuView({ viewMode: "table" });
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1, { name })], {}));
  });

  it("gives the name what step 3 leaves beside the columns", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    const expected = shortenedAt(1091, ALL);
    assert.notEqual(expected, name);
    assert.ok(render().includes(expected), expected);
  });

  it("gives the name what the game's own width leaves beside the columns it keeps", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 1);
    assert.ok(render().includes(shortenedAt(706, ["cost", "upkeep"])));
  });

  it("gives a wide menu with the pane hidden its own room, counted without the pane", () => {
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 4);
    const expected = shortenedAt(1280, ALL);
    assert.notEqual(expected, shortenedAt(1091, ALL));
    assert.ok(render().includes(expected), expected);
  });
});

describe("the table across a step that changes none of its columns", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let saved: unknown;
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setAssetMenuView({ viewMode: "table" });
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], {}));
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 4);
    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    saved = globals.document;
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
  });

  it("hands the rows the same columns when the step changes none of them", () => {
    // Every row is memoised: new column props would redraw them all.
    act(() => {
      root = create(<BuildingCatalogComponent />);
    });
    const row = () => root!.root.find((node) => node.props.columnStyle !== undefined && node.props.entry !== undefined).props;
    const before = row();

    act(() => setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5));
    const after = row();
    act(() => root?.unmount());
    globals.document = saved;

    assert.equal(after.metrics, before.metrics);
    assert.equal(after.columnStyle, before.columnStyle);
  });
});
