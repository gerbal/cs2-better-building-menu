import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  LENS_DISCLOSURE_KEYS,
  getLensAnchor,
  getLensAnchorKey,
  getLensDisclosure,
  getLensView,
  resetLensView,
  setLensAnchor,
  setLensDisclosure,
  setLensView,
  subscribeLensView,
} from "../src/domain/lensViewStore.ts";

describe("Building Lens view store", () => {
  beforeEach(() => resetLensView());

  it("starts with nothing chosen", () => {
    assert.deepEqual(getLensView(), { viewMode: "", expandedId: null, disclosures: {}, anchors: {} });
  });

  it("tells a subscriber when a field moves, and not when it does not", () => {
    // The control pane and the catalog are siblings, not ancestor and
    // descendant; the subscription is what keeps the view mode one value
    // rather than two copies.
    let fired = 0;
    const unsubscribe = subscribeLensView(() => { fired += 1; });

    setLensView({ viewMode: "table" });
    assert.equal(fired, 1);
    assert.equal(getLensView().viewMode, "table");

    setLensView({ viewMode: "table" });
    assert.equal(fired, 1);

    setLensView({ expandedId: 4206 });
    assert.equal(fired, 2);
    assert.equal(getLensView().expandedId, 4206);

    unsubscribe();
    setLensView({ viewMode: "grid" });
    assert.equal(fired, 2);
  });

  it("keeps the fields it was not asked to change", () => {
    setLensView({ viewMode: "list" });
    setLensView({ expandedId: 7 });

    assert.equal(getLensView().viewMode, "list");
    assert.equal(getLensView().expandedId, 7);
  });

  it("hands out the same snapshot until something changes", () => {
    // useSyncExternalStore compares snapshots by identity; a fresh object per
    // read would re-render for ever.
    const before = getLensView();
    setLensView({ viewMode: "" });

    assert.equal(getLensView(), before);
  });
});

describe("Building Lens disclosures", () => {
  beforeEach(() => resetLensView());

  it("falls back until a disclosure has been set", () => {
    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets), false);
    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true), true);
  });

  it("remembers an open drawer across a remount", () => {
    // The panel unmounts on close, on place, and on the lens toggle. Filters
    // are backend-owned and survive, so collapsing their drawer hid active
    // constraints behind a shut door.
    setLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges, true);

    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges), true);
  });

  it("keeps disclosures independent of one another", () => {
    setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true);

    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets), true);
    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.metricRanges), false);
  });

  it("honours an explicit close rather than treating it as unset", () => {
    setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, false);

    assert.equal(getLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true), false);
  });

  it("notifies once per change, through the one store", () => {
    let fired = 0;
    subscribeLensView(() => { fired += 1; });

    setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true);
    setLensDisclosure(LENS_DISCLOSURE_KEYS.facets, true);

    assert.equal(fired, 1);
  });
});

describe("Building Lens scroll anchor", () => {
  const tableByCategory = getLensAnchorKey({ surface: "catalog", viewMode: "table", groupBy: "category" });

  beforeEach(() => resetLensView());

  it("has no anchor until a row has been seen", () => {
    assert.equal(getLensAnchor(tableByCategory), null);
  });

  it("remembers the entry the player was looking at across a remount", () => {
    // Placing a building unmounts the whole lens, and the window comes back
    // from the backend possibly a different length, so the anchor is the entry
    // to scroll back to rather than a pixel offset that would no longer point
    // at the same row.
    setLensAnchor(tableByCategory, 4206);

    assert.equal(getLensAnchor(tableByCategory), 4206);
  });

  it("does not let two surfaces collide on the same view mode", () => {
    const catalogList = getLensAnchorKey({ surface: "catalog", viewMode: "list" });
    const zoningList = getLensAnchorKey({ surface: "zoning", viewMode: "list" });

    assert.notEqual(catalogList, zoningList);

    setLensAnchor(catalogList, 17);

    assert.equal(getLensAnchor(zoningList), null);
  });

  it("keeps a separate anchor per view mode and group dimension", () => {
    // Grouping rebuilds the list, so row 4206's position under "category" says
    // nothing about where it sits ungrouped or as a grid tile.
    const gridByCategory = getLensAnchorKey({ surface: "catalog", viewMode: "grid", groupBy: "category" });
    const tableUngrouped = getLensAnchorKey({ surface: "catalog", viewMode: "table" });

    setLensAnchor(tableByCategory, 4206);

    assert.equal(getLensAnchor(gridByCategory), null);
    assert.equal(getLensAnchor(tableUngrouped), null);
  });

  it("treats an absent group dimension as its own key rather than any group", () => {
    assert.equal(
      getLensAnchorKey({ surface: "catalog", viewMode: "table" }),
      getLensAnchorKey({ surface: "catalog", viewMode: "table", groupBy: "" }),
    );
    assert.notEqual(
      getLensAnchorKey({ surface: "catalog", viewMode: "table" }),
      getLensAnchorKey({ surface: "catalog", viewMode: "table", groupBy: "category" }),
    );
  });

  it("forgets an anchor rather than storing one no row can match", () => {
    // A stored NaN never equals an entry id, so the restore would silently do
    // nothing and look like the anchor was never taken.
    setLensAnchor(tableByCategory, 4206);
    setLensAnchor(tableByCategory, Number.NaN);

    assert.equal(getLensAnchor(tableByCategory), null);

    setLensAnchor(tableByCategory, 4206);
    setLensAnchor(tableByCategory, null);

    assert.equal(getLensAnchor(tableByCategory), null);
  });

  it("is cleared with the rest of the view state", () => {
    setLensAnchor(tableByCategory, 4206);
    resetLensView();

    assert.equal(getLensAnchor(tableByCategory), null);
  });
});
