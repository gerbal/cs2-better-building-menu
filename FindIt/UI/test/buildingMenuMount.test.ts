import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldMountInAssetMenu,
  shouldMountLegacyPanel,
  type BuildingMenuMountState,
} from "../src/domain/buildingMenuMount.ts";

const base: BuildingMenuMountState = {
  lensOwnsCurrentMenu: false,
  buildingLensEnabled: false,
  showFindItPanel: false,
  isWindowLocked: false,
  isPhotoMode: false,
};

const state = (over: Partial<BuildingMenuMountState>): BuildingMenuMountState => ({ ...base, ...over });

describe("Which surface draws the build menu", () => {
  it("gives the menu to the game's slot when the lens stands in for it", () => {
    const s = state({ lensOwnsCurrentMenu: true, buildingLensEnabled: true, showFindItPanel: true });

    assert.equal(shouldMountInAssetMenu(s), true);
    assert.equal(shouldMountLegacyPanel(s), false);
  });

  it("hands a disabled lens back to the legacy panel even while it owns the menu", () => {
    // The backend leaves LensOwnsCurrentMenu set when the lens is switched
    // off — it says which menu the toolbar has open, not what we mean to do
    // about it. Mounting on that alone left the catalog on screen under a
    // button that had just said "disable".
    const s = state({ lensOwnsCurrentMenu: true, buildingLensEnabled: false, showFindItPanel: true });

    assert.equal(shouldMountInAssetMenu(s), false);
    assert.equal(shouldMountLegacyPanel(s), true);
  });

  it("never draws both at once, in any combination", () => {
    for (const lensOwnsCurrentMenu of [false, true]) {
      for (const buildingLensEnabled of [false, true]) {
        for (const showFindItPanel of [false, true]) {
          for (const isWindowLocked of [false, true]) {
            for (const isPhotoMode of [false, true]) {
              const s = state({
                lensOwnsCurrentMenu,
                buildingLensEnabled,
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
      buildingLensEnabled: true,
      showFindItPanel: true,
      isWindowLocked: true,
      isPhotoMode: true,
    });

    assert.equal(shouldMountInAssetMenu(s), false);
    assert.equal(shouldMountLegacyPanel(s), false);
  });
});
