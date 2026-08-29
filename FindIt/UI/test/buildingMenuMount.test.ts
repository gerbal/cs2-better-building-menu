import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldMountInAssetMenu,
  type BuildingMenuMountState,
} from "../src/domain/buildingMenuMount.ts";

const base: BuildingMenuMountState = {
  lensOwnsCurrentMenu: false,
  isPhotoMode: false,
};

const state = (over: Partial<BuildingMenuMountState>): BuildingMenuMountState => ({ ...base, ...over });

describe("Whether the build menu draws", () => {
  // This file used to assert that exactly ONE of two surfaces drew — the
  // game's asset-menu slot or MainContainer's floating panel — across every
  // combination of four flags. Step 4 deleted the floating panel, so the
  // question is no longer which one, and the flags it turned on
  // (showFindItPanel, isWindowLocked) are no longer part of this decision.
  //
  // What is left is worth keeping tested because it is the whole reason the
  // menu appears at all.

  it("draws when the lens stands in for the toolbar's open menu", () => {
    assert.equal(shouldMountInAssetMenu(state({ lensOwnsCurrentMenu: true })), true);
  });

  it("draws nothing when the toolbar is idle", () => {
    // The ordinary state of the UI.
    assert.equal(shouldMountInAssetMenu(state({})), false);
  });

  it("owning the menu is the whole condition", () => {
    // This once ANDed with `buildingLensEnabled`, because the player could
    // turn the lens off while the backend left lensOwnsCurrentMenu set — it
    // describes which menu the toolbar has open, not what we intend to do
    // about it. There is no such switch now: the lens REPLACES vanilla's build
    // menu rather than offering an alternative to it.
    for (const isPhotoMode of [false, true]) {
      for (const lensOwnsCurrentMenu of [false, true]) {
        assert.equal(
          shouldMountInAssetMenu(state({ lensOwnsCurrentMenu, isPhotoMode })),
          lensOwnsCurrentMenu && !isPhotoMode,
          `wrong for owns=${lensOwnsCurrentMenu} photo=${isPhotoMode}`
        );
      }
    }
  });

  it("declines in photo mode even while owning the menu", () => {
    // The caller relies on this pairing: it suppresses vanilla's grid on
    // exactly this state, so that declining to draw does not hand the space
    // back to the menu we are standing in for.
    const s = state({ lensOwnsCurrentMenu: true, isPhotoMode: true });

    assert.equal(shouldMountInAssetMenu(s), false);
  });
});
