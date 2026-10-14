import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { lockedThumbnail } from "../src/domain/buildingLockState.ts";

describe("lockedThumbnail", () => {
  it("swaps a locked vector to its blackened copy", () => {
    // The whole point: a silhouette that is artwork, not an effect.
    assert.equal(
      lockedThumbnail(
        { thumbnail: "Media/Game/Icons/DoubleTrainTrack.svg", silhouetteThumbnail: "coui://betterbuildingmenusilhouettes/x.svg" },
        true,
      ),
      "coui://betterbuildingmenusilhouettes/x.svg",
    );
  });

  it("leaves a placeable entry showing its real artwork", () => {
    assert.equal(
      lockedThumbnail(
        { thumbnail: "Media/Game/Icons/DoubleTrainTrack.svg", silhouetteThumbnail: "coui://betterbuildingmenusilhouettes/x.svg" },
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
    silhouetteThumbnail: "coui://betterbuildingmenusilhouettes/Media_Game_Icons_DoubleTrainTrack.svg",
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
