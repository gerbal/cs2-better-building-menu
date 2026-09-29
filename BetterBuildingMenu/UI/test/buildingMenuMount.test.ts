import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldMountInAssetMenu,
  type BuildingMenuMountState,
} from "../src/domain/buildingMenuMount.ts";

const base: BuildingMenuMountState = {
  ownsCurrentMenu: false,
  isPhotoMode: false,
};

const state = (over: Partial<BuildingMenuMountState>): BuildingMenuMountState => ({ ...base, ...over });

describe("Whether the build menu draws", () => {
  // The whole reason the menu appears at all: the asset menu draws in the game's
  // asset-menu slot, and these are the conditions under which it does.

  it("draws when the asset menu stands in for the toolbar's open menu", () => {
    assert.equal(shouldMountInAssetMenu(state({ ownsCurrentMenu: true })), true);
  });

  it("draws nothing when the toolbar is idle", () => {
    // The ordinary state of the UI.
    assert.equal(shouldMountInAssetMenu(state({})), false);
  });

  it("owning the menu is the whole condition", () => {
    // ownsCurrentMenu describes which menu the toolbar has open, not what
    // we intend to do about it. The asset menu REPLACES vanilla's build menu.
    for (const isPhotoMode of [false, true]) {
      for (const ownsCurrentMenu of [false, true]) {
        assert.equal(
          shouldMountInAssetMenu(state({ ownsCurrentMenu, isPhotoMode })),
          ownsCurrentMenu && !isPhotoMode,
          `wrong for owns=${ownsCurrentMenu} photo=${isPhotoMode}`
        );
      }
    }
  });

  it("declines in photo mode even while owning the menu", () => {
    // The caller relies on this pairing: it suppresses vanilla's grid on
    // exactly this state, so that declining to draw does not hand the space
    // back to the menu we are standing in for.
    const s = state({ ownsCurrentMenu: true, isPhotoMode: true });

    assert.equal(shouldMountInAssetMenu(s), false);
  });
});

describe("Yielding to upstream Find It", () => {
  const state = (over: Partial<import("../src/domain/buildingMenuMount.ts").BuildingMenuMountState> = {}) =>
    ({ ownsCurrentMenu: true, isPhotoMode: false, ...over });

  it("draws nothing while Find It's own panel is up, whatever the registration order", () => {
    assert.equal(shouldMountInAssetMenu(state({ findItPanelShown: true })), false);
  });

  it("draws again the moment that panel closes", () => {
    assert.equal(shouldMountInAssetMenu(state({ findItPanelShown: false })), true);
    assert.equal(shouldMountInAssetMenu(state({})), true);
  });
});

