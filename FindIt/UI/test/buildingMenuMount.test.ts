import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldMountInAssetMenu,
  shouldMountLegacyPanel,
  type BuildingMenuMountState,
} from "../src/domain/buildingMenuMount.ts";

const base: BuildingMenuMountState = {
  lensOwnsCurrentMenu: false,
  showFindItPanel: false,
  isWindowLocked: false,
  isPhotoMode: false,
};

const state = (over: Partial<BuildingMenuMountState>): BuildingMenuMountState => ({ ...base, ...over });

describe("Which surface draws the build menu", () => {
  it("gives the menu to the game's slot when the lens stands in for it", () => {
    const s = state({ lensOwnsCurrentMenu: true, showFindItPanel: true });

    assert.equal(shouldMountInAssetMenu(s), true);
    assert.equal(shouldMountLegacyPanel(s), false);
  });

  it("owning the menu is now the whole condition for the game's slot", () => {
    // This used to assert the opposite: that a DISABLED lens handed the menu
    // back to the legacy panel even while it owned it, because the backend
    // leaves lensOwnsCurrentMenu set when the lens is switched off.
    //
    // There is no switching off. The lens replaces vanilla's build menu rather
    // than being a mode, so `buildingLensEnabled` is gone from the state
    // entirely and owning the menu is the whole question.
    const s = state({ lensOwnsCurrentMenu: true, showFindItPanel: true });

    assert.equal(shouldMountInAssetMenu(s), true);
    assert.equal(shouldMountLegacyPanel(s), false);
  });

  it("never draws both at once, in any combination", () => {
    for (const lensOwnsCurrentMenu of [false, true]) {
      for (const showFindItPanel of [false, true]) {
        for (const isWindowLocked of [false, true]) {
          for (const isPhotoMode of [false, true]) {
            const s = state({
              lensOwnsCurrentMenu,
              showFindItPanel,
              isWindowLocked,
              isPhotoMode,
            });

            assert.ok(
              !(shouldMountInAssetMenu(s) && shouldMountLegacyPanel(s)),
              `both drew for ${JSON.stringify(s)}`
            );
          }
        }
      }
    }
  });

  it("draws nothing at all when the toolbar is idle", () => {
    // The ordinary state of the UI, and the reason the two are not written as
    // complements of each other.
    const s = state({});

    assert.equal(shouldMountInAssetMenu(s), false);
    assert.equal(shouldMountLegacyPanel(s), false);
  });

  it("keeps the pinned legacy panel open with no menu selected", () => {
    const s = state({ isWindowLocked: true });

    assert.equal(shouldMountLegacyPanel(s), true);
  });

  it("hides both in photo mode, whatever else is set", () => {
    const s = state({
      lensOwnsCurrentMenu: true,
      showFindItPanel: true,
      isWindowLocked: true,
      isPhotoMode: true,
    });

    assert.equal(shouldMountInAssetMenu(s), false);
    assert.equal(shouldMountLegacyPanel(s), false);
  });
});
