import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  ASSET_MENU_DISCLOSURE_KEYS,
  getAssetMenuAnchor,
  getAssetMenuAnchorKey,
  getAssetMenuDisclosure,
  getAssetMenuView,
  resetAssetMenuView,
  setAssetMenuAnchor,
  setAssetMenuDisclosure,
  setAssetMenuView,
  subscribeAssetMenuView,
} from "../src/domain/assetMenuViewStore.ts";

describe("Asset menu view store", () => {
  beforeEach(() => resetAssetMenuView());

  it("starts with nothing chosen", () => {
    assert.deepEqual(getAssetMenuView(), { viewMode: "", expandedId: null, disclosures: {}, anchors: {} });
  });

  it("tells a subscriber when a field moves, and not when it does not", () => {
    // The control pane and the catalog are siblings, not ancestor and
    // descendant; the subscription is what keeps the view mode one value
    // rather than two copies.
    let fired = 0;
    const unsubscribe = subscribeAssetMenuView(() => { fired += 1; });

    setAssetMenuView({ viewMode: "table" });
    assert.equal(fired, 1);
    assert.equal(getAssetMenuView().viewMode, "table");

    setAssetMenuView({ viewMode: "table" });
    assert.equal(fired, 1);

    setAssetMenuView({ expandedId: 4206 });
    assert.equal(fired, 2);
    assert.equal(getAssetMenuView().expandedId, 4206);

    unsubscribe();
    setAssetMenuView({ viewMode: "grid" });
    assert.equal(fired, 2);
  });

  it("keeps the fields it was not asked to change", () => {
    setAssetMenuView({ viewMode: "list" });
    setAssetMenuView({ expandedId: 7 });

    assert.equal(getAssetMenuView().viewMode, "list");
    assert.equal(getAssetMenuView().expandedId, 7);
  });

  it("hands out the same snapshot until something changes", () => {
    // useSyncExternalStore compares snapshots by identity; a fresh object per
    // read would re-render for ever.
    const before = getAssetMenuView();
    setAssetMenuView({ viewMode: "" });

    assert.equal(getAssetMenuView(), before);
  });
});

describe("Asset menu disclosures", () => {
  beforeEach(() => resetAssetMenuView());

  it("falls back until a disclosure has been set", () => {
    assert.equal(getAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets), false);
    assert.equal(getAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets, true), true);
  });

  it("remembers an open drawer across a remount", () => {
    // The asset menu unmounts on close, on place, and on the asset menu toggle. Filters
    // are backend-owned and survive, so collapsing their drawer would hide
    // active constraints behind a shut door.
    setAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.metricRanges, true);

    assert.equal(getAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.metricRanges), true);
  });

  it("keeps disclosures independent of one another", () => {
    setAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets, true);

    assert.equal(getAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets), true);
    assert.equal(getAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.metricRanges), false);
  });

  it("honours an explicit close rather than treating it as unset", () => {
    setAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets, false);

    assert.equal(getAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets, true), false);
  });

  it("notifies once per change, through the one store", () => {
    let fired = 0;
    subscribeAssetMenuView(() => { fired += 1; });

    setAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets, true);
    setAssetMenuDisclosure(ASSET_MENU_DISCLOSURE_KEYS.facets, true);

    assert.equal(fired, 1);
  });
});

describe("Asset menu scroll anchor", () => {
  const tableByCategory = getAssetMenuAnchorKey({ list: "catalog", viewMode: "table", groupBy: "category" });

  beforeEach(() => resetAssetMenuView());

  it("has no anchor until a row has been seen", () => {
    assert.equal(getAssetMenuAnchor(tableByCategory), null);
  });

  it("remembers the entry the player was looking at across a remount", () => {
    // Placing a building unmounts the whole asset menu, and the window comes back
    // from the backend possibly a different length, so the anchor is the entry
    // to scroll back to rather than a pixel offset that would no longer point
    // at the same row.
    setAssetMenuAnchor(tableByCategory, 4206);

    assert.equal(getAssetMenuAnchor(tableByCategory), 4206);
  });

  it("does not let two lists collide on the same view mode", () => {
    const catalogList = getAssetMenuAnchorKey({ list: "catalog", viewMode: "list" });
    const zoningList = getAssetMenuAnchorKey({ list: "zoning", viewMode: "list" });

    assert.notEqual(catalogList, zoningList);

    setAssetMenuAnchor(catalogList, 17);

    assert.equal(getAssetMenuAnchor(zoningList), null);
  });

  it("keeps a separate anchor per view mode and group dimension", () => {
    // Grouping rebuilds the list, so row 4206's position under "category" says
    // nothing about where it sits ungrouped or as a grid tile.
    const gridByCategory = getAssetMenuAnchorKey({ list: "catalog", viewMode: "grid", groupBy: "category" });
    const tableUngrouped = getAssetMenuAnchorKey({ list: "catalog", viewMode: "table" });

    setAssetMenuAnchor(tableByCategory, 4206);

    assert.equal(getAssetMenuAnchor(gridByCategory), null);
    assert.equal(getAssetMenuAnchor(tableUngrouped), null);
  });

  it("treats an absent group dimension as its own key rather than any group", () => {
    assert.equal(
      getAssetMenuAnchorKey({ list: "catalog", viewMode: "table" }),
      getAssetMenuAnchorKey({ list: "catalog", viewMode: "table", groupBy: "" }),
    );
    assert.notEqual(
      getAssetMenuAnchorKey({ list: "catalog", viewMode: "table" }),
      getAssetMenuAnchorKey({ list: "catalog", viewMode: "table", groupBy: "category" }),
    );
  });

  it("forgets an anchor rather than storing one no row can match", () => {
    // A stored NaN never equals an entry id, so the restore would silently do
    // nothing and look like the anchor was never taken.
    setAssetMenuAnchor(tableByCategory, 4206);
    setAssetMenuAnchor(tableByCategory, Number.NaN);

    assert.equal(getAssetMenuAnchor(tableByCategory), null);

    setAssetMenuAnchor(tableByCategory, 4206);
    setAssetMenuAnchor(tableByCategory, null);

    assert.equal(getAssetMenuAnchor(tableByCategory), null);
  });

  it("is cleared with the rest of the view state", () => {
    setAssetMenuAnchor(tableByCategory, 4206);
    resetAssetMenuView();

    assert.equal(getAssetMenuAnchor(tableByCategory), null);
  });
});
