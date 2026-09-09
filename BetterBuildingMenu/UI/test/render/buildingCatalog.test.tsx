import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry, catalogPage } from "../harness/render";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetLensView, setLensView } from "../../src/domain/lensViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

const page = (over: Record<string, unknown> = {}) =>
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)], over));
const render = () => renderHtml(<BuildingCatalogComponent />);

describe("the catalog container", () => {
  beforeEach(() => {
    resetBindings();
    resetLensView();
    setBinding("BetterBuildingMenu", "PanelWidth", 700);
  });

  for (const mode of ["table", "grid", "list", "cards"]) {
    it(`ends the feed with a load-more inside the scroll in ${mode} mode`, () => {
      // Below the scroll is where the pager used to live, and the reason
      // nobody read it. The number too: on Landscaping that is 100 rows of
      // 368 with nothing on screen admitting it.
      setLensView({ viewMode: mode });
      page({ hasMore: true, totalCount: 403 });
      const html = render();
      const scroll = html.indexOf('data-scrollable="true"');
      const more = html.indexOf('class="loadMoreRow"');

      assert.ok(scroll >= 0, `${mode}: expected a scroll container`);
      assert.ok(more > scroll, `${mode}: the load-more must sit inside the scroll`);
      assert.match(html, /Showing 2 of 403/);
    });

    it(`offers to widen a scoped miss in ${mode} mode`, () => {
      // A search that misses in Table mode used to say "No buildings match"
      // and stop — no count of what existed elsewhere, no way to reach it.
      setLensView({ viewMode: mode });
      page({ items: [], totalCount: 0 });
      setBinding("BetterBuildingMenu", "CurrentSearch", "police");
      setBinding("BetterBuildingMenu", "BuildingCatalogMatchesElsewhere", 5);
      const html = render();

      assert.match(html, /No matches here — 5 elsewhere/);
      assert.match(html, /aria-label="Search everything"/);
    });
  }

  it("draws no load-more when the window holds everything", () => {
    setLensView({ viewMode: "table" });
    page({ hasMore: false, totalCount: 2 });

    assert.doesNotMatch(render(), /class="loadMoreRow"/);
  });

  it("obeys the chosen view mode whatever the panel width", () => {
    // It used to be overridden to "grid" at the resting height, so pressing
    // Table lit the button, changed nothing, and said nothing about why.
    setLensView({ viewMode: "table" });
    page();

    for (const width of [300, 700, 1100]) {
      setBinding("BetterBuildingMenu", "PanelWidth", width);
      assert.match(render(), /class="columnHeader"/, `width ${width}`);
    }
  });

  it("names the constraints that emptied the table rather than blaming search", () => {
    setLensView({ viewMode: "table" });
    page({ items: [], totalCount: 0 });

    assert.match(render(), /class="empty"/);
  });

  it("draws no control chrome of its own", () => {
    // Identity, count, Group by, Sort by and the view mode live in the
    // control plane beside the panel, visible at the strip height this rests
    // at.
    setLensView({ viewMode: "grid" });
    page();
    const html = render();

    for (const gone of [/class="toolbar"/, /class="heading"/, /class="sortBar"/, /data-sort-options/]) {
      assert.doesNotMatch(html, gone);
    }
  });

  it("marks every row with the id the scroll hooks find it by", () => {
    setLensView({ viewMode: "table" });
    page();
    const html = render();

    assert.match(html, /data-catalog-entry="1"/);
    assert.match(html, /data-catalog-entry="2"/);
  });
});

describe("the table under a larger text scale", () => {
  // The game's Interface › Text scale reaches the page as ("options",
  // "textScale"). Measured live at 125 %: the Cost and Upkeep cells clipped
  // their figures by 15–20px because the column widths assumed 100 %. The
  // columns follow the S size's own growth — see domain/textScale.ts.
  it("widens the metric columns by the S size's ratio", () => {
    resetBindings();
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1)], {}));
    // Wide, so the room beside the name does not cap the ratio — at a 720p
    // panel it does, and the columns grow only as far as the name allows.
    setBinding("BetterBuildingMenu", "PanelWidth", 2400);
    const widthOf = (html: string) => Number(/metricUpkeep[^>]*style="[^"]*width:\s*([0-9.]+)rem/.exec(html)?.[1]);

    const base = widthOf(render());
    setBinding("options", "textScale", 1.25);
    const scaled = widthOf(render());

    assert.ok(base > 0, `base upkeep width ${base}`);
    assert.equal(scaled, Math.round(base * (21.35 / 14)));
  });
});
