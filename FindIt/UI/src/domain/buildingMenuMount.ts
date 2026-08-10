/**
 * Which surface draws the build menu.
 *
 * Phase 2 gives the menu two possible homes, and exactly one of them must draw
 * at a time. The game's `AssetMenu` slot is the new one; MainContainer's
 * floating panel is the old one. Both read the same bindings, so the rule lives
 * here rather than in each — two components deciding this separately is how you
 * get the menu drawn twice, or not at all.
 */

export interface BuildingMenuMountState {
  /** The toolbar's open menu is one we stand in for. */
  lensOwnsCurrentMenu: boolean;
  /** The lens is on, rather than the legacy FindIt grid. */
  buildingLensEnabled: boolean;
  /** The legacy panel's own visibility, from the Magnifier or the picker. */
  showFindItPanel: boolean;
  /** The legacy panel is pinned open. */
  isWindowLocked: boolean;
  /** Photo mode hides every panel. */
  isPhotoMode: boolean;
}

/**
 * Whether the game's asset-menu slot should draw the menu.
 *
 * Both conditions are load-bearing. `lensOwnsCurrentMenu` alone is not enough:
 * the backend leaves it set when the player turns the lens off, because it
 * describes which menu the toolbar has open rather than what we intend to do
 * about it. Mounting on that alone would keep the catalog on screen under a
 * button that had just said "disable", and take the legacy grid's place while
 * it was the thing the player asked for.
 */
export function shouldMountInAssetMenu(state: BuildingMenuMountState): boolean {
  if (state.isPhotoMode) {
    return false;
  }

  return state.lensOwnsCurrentMenu && state.buildingLensEnabled;
}

/**
 * Whether the legacy floating panel should draw.
 *
 * The complement of the above, plus the panel's own visibility. Written as its
 * own function rather than a `!shouldMountInAssetMenu(...)` at the call site,
 * because they are not complements: when the slot declines AND the panel is
 * hidden, nothing draws at all, which is the ordinary state of the UI.
 */
export function shouldMountLegacyPanel(state: BuildingMenuMountState): boolean {
  if (state.isPhotoMode || shouldMountInAssetMenu(state)) {
    return false;
  }

  return state.showFindItPanel || state.isWindowLocked;
}
