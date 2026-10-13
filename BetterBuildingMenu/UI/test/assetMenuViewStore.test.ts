import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  ASSET_MENU_DISCLOSURE_KEYS,
  getAssetMenuAnchor,
  getAssetMenuAnchorKey,
  getAssetMenuDisclosure,
  getAssetMenuListStart,
  getAssetMenuSlotLeft,
  getAssetMenuView,
  resetAssetMenuView,
  setAssetMenuAnchor,
  setAssetMenuDisclosure,
  setAssetMenuListStart,
  setAssetMenuSlotLeft,
  setAssetMenuView,
  subscribeAssetMenuView,
} from "../src/domain/assetMenuViewStore.ts";

describe("Asset menu view store", () => {
  beforeEach(() => resetAssetMenuView());

  it("starts with nothing chosen", () => {
    assert.deepEqual(getAssetMenuView(), { disclosures: {}, anchors: {}, listStart: null, slot: null, said: [], drawnForm: null });
  });

  it("tells a subscriber when a field moves, and not when it does not", () => {
    // The control pane and the catalog are siblings, not ancestor and
    // descendant; the subscription is what keeps a field one value rather
    // than two copies.
    let fired = 0;
    const unsubscribe = subscribeAssetMenuView(() => { fired += 1; });

    setAssetMenuView({ listStart: 3 });
    assert.equal(fired, 1);
    assert.equal(getAssetMenuView().listStart, 3);

    setAssetMenuView({ listStart: 3 });
    assert.equal(fired, 1);

    unsubscribe();
    setAssetMenuView({ listStart: 4 });
    assert.equal(fired, 1);
  });

  it("keeps the fields it was not asked to change", () => {
    setAssetMenuView({ listStart: 2 });
    setAssetMenuView({ disclosures: { facets: true } });

    assert.equal(getAssetMenuView().listStart, 2);
    assert.deepEqual(getAssetMenuView().disclosures, { facets: true });
  });

  it("hands out the same snapshot until something changes", () => {
    // useSyncExternalStore compares snapshots by identity; a fresh object per
    // read would re-render for ever.
    const before = getAssetMenuView();
    setAssetMenuView({ listStart: null });

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

  it("remembers the start it put the list in place for across a remount", () => {
    // Placing a building unmounts the menu; the page it comes back to is the same start, not a new one.
    assert.equal(getAssetMenuListStart(), null);

    setAssetMenuListStart(7);

    assert.equal(getAssetMenuListStart(), 7);
    assert.equal(getAssetMenuView().listStart, 7);
  });

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

describe("the game's slot as last read", () => {
  beforeEach(() => resetAssetMenuView());

  it("is kept for a window of the same size, and nothing for another", () => {
    setAssetMenuSlotLeft({ innerWidth: 1920, innerHeight: 1080, left: 608 });

    assert.equal(getAssetMenuSlotLeft(1920, 1080), 608);
    assert.equal(getAssetMenuSlotLeft(1280, 720), null);
    assert.equal(getAssetMenuSlotLeft(2560, 1080), null);
  });

  it("tells no subscriber when the same reading comes again", () => {
    setAssetMenuSlotLeft({ innerWidth: 1920, innerHeight: 1080, left: 608 });
    let fired = 0;
    subscribeAssetMenuView(() => { fired += 1; });

    setAssetMenuSlotLeft({ innerWidth: 1920, innerHeight: 1080, left: 608 });
    assert.equal(fired, 0);
    setAssetMenuSlotLeft({ innerWidth: 1280, innerHeight: 720, left: 604 });
    assert.equal(fired, 1);
  });
});
