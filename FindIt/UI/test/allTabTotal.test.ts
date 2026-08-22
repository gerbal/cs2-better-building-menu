import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { allTabTotal } from "../src/domain/vanillaMenuCategories.ts";
import { lockedThumbnail } from "../src/domain/buildingLockState.ts";

/**
 * cm-2xvs.23: the strip's "All" chip must be the size of the result set.
 *
 * Measured in the 105-pack scale run: unscoped the page held 10,528 assets,
 * the development axis had tabs for 716 of them, and the chip — built by
 * summing those tabs — said 716.
 */
describe("The All chip's total", () => {
  it("takes the category table, not the tabs beside it", () => {
    // The real shape of the bug: an axis that covers part of the scope, and a
    // category table that covers all of it.
    const counts = [
      { id: "", count: 9812 },
      { id: "TransportationRoad", count: 400 },
      { id: "PropsNature", count: 316 },
    ];
    const branchTabs = [{ count: 400 }, { count: 316 }];

    assert.equal(allTabTotal(counts, branchTabs), 10528);
    // And not the number the tabs add up to.
    assert.notEqual(allTabTotal(counts, branchTabs), 716);
  });

  it("falls back to the tabs only until the counts arrive", () => {
    // One frame, on the way in. A stale-but-close number beats a blank.
    assert.equal(allTabTotal([], [{ count: 12 }, { count: 30 }]), 42);
    assert.equal(allTabTotal(null, [{ count: 7 }]), 7);
  });

  it("is zero rather than NaN when there is nothing at all", () => {
    assert.equal(allTabTotal([], []), 0);
    assert.equal(allTabTotal(null, null), 0);
  });

  it("counts the unnamed remainder like any other row", () => {
    // The row for assets answering to no category. It draws no tab — the strip
    // iterates the menu's category list — but it is most of the catalogue
    // unscoped, and All has to include it.
    assert.equal(allTabTotal([{ id: "", count: 5 }], []), 5);
  });
});

describe("lockedThumbnail", () => {
  it("swaps a locked vector to its blackened copy", () => {
    // The whole point: a silhouette that is artwork, not an effect.
    assert.equal(
      lockedThumbnail(
        { thumbnail: "Media/Game/Icons/DoubleTrainTrack.svg", silhouetteThumbnail: "coui://finditsilhouettes/x.svg" },
        true,
      ),
      "coui://finditsilhouettes/x.svg",
    );
  });

  it("leaves a placeable entry showing its real artwork", () => {
    assert.equal(
      lockedThumbnail(
        { thumbnail: "Media/Game/Icons/DoubleTrainTrack.svg", silhouetteThumbnail: "coui://finditsilhouettes/x.svg" },
        false,
      ),
      "Media/Game/Icons/DoubleTrainTrack.svg",
    );
  });

  it("leaves rasters alone so vanilla's filter still does the work", () => {
    // No blackened copy is generated for a PNG; the CSS filter handles it.
    assert.equal(lockedThumbnail({ thumbnail: "thumb.png", silhouetteThumbnail: "" }, true), "thumb.png");
  });

  it("falls back to the real artwork when the icon was not found on disk", () => {
    assert.equal(lockedThumbnail({ thumbnail: "a.svg" }, true), "a.svg");
    assert.equal(lockedThumbnail({ thumbnail: "a.svg", silhouetteThumbnail: "   " }, true), "a.svg");
  });

  it("survives a missing entry", () => {
    assert.equal(lockedThumbnail(null, true), "");
    assert.equal(lockedThumbnail(undefined, false), "");
  });
});

describe("unlocking restores the real artwork", () => {
  // The silhouette must be a VIEW of lock state, never a property the entry
  // acquires. Vanilla's filtered tiles get this for free — the filter simply
  // stops applying — and the swapped ones have to behave the same way.
  const track = {
    thumbnail: "Media/Game/Icons/DoubleTrainTrack.svg",
    silhouetteThumbnail: "coui://finditsilhouettes/Media_Game_Icons_DoubleTrainTrack.svg",
  };

  it("shows the black copy while locked and the colour icon once unlocked", () => {
    assert.equal(lockedThumbnail(track, true), track.silhouetteThumbnail);
    assert.equal(lockedThumbnail(track, false), track.thumbnail);
  });

  it("round-trips, so a milestone landing mid-session puts the colour back", () => {
    // locked -> unlocked -> locked again (a bulldozed unique re-locks).
    const states = [true, false, true, false].map((locked) => lockedThumbnail(track, locked));

    assert.deepEqual(states, [
      track.silhouetteThumbnail,
      track.thumbnail,
      track.silhouetteThumbnail,
      track.thumbnail,
    ]);
  });

  it("never mutates the entry it was given", () => {
    const before = JSON.stringify(track);
    lockedThumbnail(track, true);
    lockedThumbnail(track, false);
    assert.equal(JSON.stringify(track), before);
  });

  it("an already-built unique also returns to colour if it is demolished", () => {
    const unique = { thumbnail: "sig.png", silhouetteThumbnail: "" };
    // Raster: the filter does the work, so the src never changes either way.
    assert.equal(lockedThumbnail(unique, true), "sig.png");
    assert.equal(lockedThumbnail(unique, false), "sig.png");
  });
});
