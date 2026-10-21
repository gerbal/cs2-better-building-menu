import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { renderHtml, entry, catalogPage } from "../harness/render";
import { installFakeBrowser, type FakeBrowser } from "../harness/fakeBrowser";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { mountEach } from "../harness/mount";
import { seed } from "../harness/seed";
import { loadLocale, resetLocale } from "../harness/stubs/cs2-l10n";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";
import { FALLBACK_SEPARATORS, groupDigits } from "../../src/domain/assetMenuMetricFormat";
import { CATALOG_WINDOW_STEP } from "../../src/domain/catalogWindow";
import {
  ASSET_MENU_CHROME_WIDTH,
  ASSET_MENU_COLUMN_MAX,
  ASSET_MENU_TABLE_ROW_FURNITURE,
  type AssetMenuMetric,
} from "../../src/domain/assetMenuLayout";
import { shortenTileLabel, tableLabelCharBudget } from "../../src/domain/tileLabel";
import {
  AssetMenuCatalogWidth$,
  AssetMenuViewMode$,
  AssetMenuWidth$,
  BuildingCatalog$,
  BuildingCatalogMatchesElsewhere$,
  BuildingCatalogMetricRanges$,
  BuildingCatalogSortColumn$,
  ControlPaneShown$,
  CurrentSearch$,
} from "../../src/mods/bindings";

const page = (over: Record<string, unknown> = {}) =>
  seed(BuildingCatalog$, catalogPage([entry(1), entry(2)], over));
const render = () => renderHtml(<BuildingCatalogComponent />);

describe("the catalog container", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    seed(AssetMenuWidth$, 700);
  });

  afterEach(() => resetLocale());

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
      seed(CurrentSearch$, "police");
      seed(BuildingCatalogMatchesElsewhere$, 5);
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
    // Several loads in, the window is 300 rows; a click still adds one step.
    setAssetMenuView({ viewMode: "table" });
    page({ hasMore: true, totalCount: 403, limit: 300 });

    assert.ok(render().includes(`Load ${CATALOG_WINDOW_STEP} more`));
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
      seed(AssetMenuWidth$, width);
      assert.match(render(), /class="columnHeader"/, `width ${width}`);
    }
  });

  it("names the constraints that emptied the table rather than blaming search", () => {
    setAssetMenuView({ viewMode: "table" });
    page({ items: [], totalCount: 0 });

    assert.match(render(), /class="empty"/);
  });

  it("names a range that emptied the table in the player's own number marks", () => {
    loadLocale({ "Common.THOUSANDS_SEPARATOR": ".", "Common.DECIMAL_SEPARATOR": "," });
    setAssetMenuView({ viewMode: "table" });
    page({ items: [], totalCount: 0 });
    seed(BuildingCatalogMetricRanges$, {
      minCost: 1234.5, maxCost: null,
      minUpkeep: null, maxUpkeep: null,
      minWorkers: null, maxWorkers: null,
      minCapacity: null, maxCapacity: null,
      minLotWidth: null, maxLotWidth: null,
      minLotDepth: null, maxLotDepth: null,
      hasSelection: true,
    });

    assert.match(render(), /No buildings match Cost ≥ 1\.234,5\./);
  });

  it("draws the view C# kept while nothing was picked this session", () => {
    seed(AssetMenuViewMode$, "list");
    page();
    const html = render();

    assert.match(html, /class="item"/);
    assert.doesNotMatch(html, /itemCard/);
  });

  it("draws the session's pick over the kept view", () => {
    seed(AssetMenuViewMode$, "list");
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
    seed(BuildingCatalog$, catalogPage([entry(1)], {}));
    // Wide, so the room beside the name does not cap the ratio — at a 720p
    // width it does, and the columns grow only as far as the name allows.
    seed(AssetMenuWidth$, 2400);
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
    seed(BuildingCatalog$, catalogPage([entry(1)], {}));
    seed(AssetMenuWidth$, 1441);
  });

  it("drops columns rather than clip them when the player narrows the menu", () => {
    seed(AssetMenuCatalogWidth$, 735);
    const html = render();

    assert.match(html, /metricCost/);
    assert.match(html, /metricUpkeep/);
    for (const dropped of ["metricWorkers", "metricCapacity", "metricLot", "metricLevel", "metricParking"]) {
      assert.doesNotMatch(html, new RegExp(dropped), dropped);
    }
    assert.equal(costWidth(html), 100);
  });

  it("keeps the column the table is sorted by at any width", () => {
    seed(AssetMenuCatalogWidth$, 735);
    seed(BuildingCatalogSortColumn$, "HasParking");

    assert.match(render(), /metricParking/);
  });

  it("keeps the lot column when sorted by lot depth, as by lot width: one cell shows both", () => {
    seed(AssetMenuCatalogWidth$, 735);
    seed(BuildingCatalogSortColumn$, "LotDepth");

    assert.match(render(), /metricLot/);
  });

  it("keeps the columns it has at fill when the pane is hidden: the table's arithmetic counts the pane either way", () => {
    const shown = costWidth(render());
    seed(ControlPaneShown$, false);

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
    seed(BuildingCatalog$, catalogPage([entry(1, { name })], {}));
    seed(AssetMenuWidth$, 1441);
  });

  it("gives the name what the default width leaves beside the columns", () => {
    const expected = shortenedAt(1091, ALL);
    assert.notEqual(expected, name);
    assert.ok(render().includes(expected), expected);
  });

  it("gives the name what a narrow menu leaves beside the columns it keeps", () => {
    seed(AssetMenuCatalogWidth$, 735);
    assert.ok(render().includes(shortenedAt(735, ["cost", "upkeep"])));
  });

  it("gives a wide menu with the pane hidden its own room, counted without the pane", () => {
    seed(ControlPaneShown$, false);
    seed(AssetMenuCatalogWidth$, 1300);
    const expected = shortenedAt(1300, ALL);
    assert.notEqual(expected, shortenedAt(1091, ALL));
    assert.ok(render().includes(expected), expected);
  });
});

describe("the table while the build menu's width is dragged", () => {
  let browser: FakeBrowser;
  const tree = mountEach();

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    setAssetMenuView({ viewMode: "table" });
    seed(BuildingCatalog$, catalogPage([entry(1)], {}));
    seed(AssetMenuWidth$, 1441);
    seed(ControlPaneShown$, false);
    browser = installFakeBrowser({ frames: "none" });
  });

  it("hands the rows the same columns while a new width changes none of them", () => {
    // Every row is memoised: new column props each frame would redraw them all.
    tree.mount(<BuildingCatalogComponent />);
    const row = () => tree.root.find((node) => node.props.columnStyle !== undefined && node.props.entry !== undefined).props;
    const before = row();

    act(() => seed(AssetMenuCatalogWidth$, 1300));
    const after = row();
    act(() => tree.renderer.unmount());
    browser.restore();

    assert.equal(after.metrics, before.metrics);
    assert.equal(after.columnStyle, before.columnStyle);
  });
});
