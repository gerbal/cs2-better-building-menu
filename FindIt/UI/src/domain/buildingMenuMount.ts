/**
 * Whether the build menu draws.
 *
 * This used to arbitrate between two homes — the game's `AssetMenu` slot and
 * MainContainer's floating panel — because exactly one of them had to draw at
 * a time and two components deciding that separately is how you get the menu
 * drawn twice, or not at all. Step 4 deleted the floating panel, so there is
 * one home and nothing to arbitrate.
 *
 * The module stays because the QUESTION stays, and it is still worth answering
 * in one tested place rather than inline in an extension point.
 */

export interface BuildingMenuMountState {
  /** The toolbar's open menu is one we stand in for. */
  lensOwnsCurrentMenu: boolean;
  /** Photo mode hides every panel. */
  isPhotoMode: boolean;
}

/**
 * Whether the game's asset-menu slot should draw the menu.
 *
 * `lensOwnsCurrentMenu` is now the whole condition. It used to be ANDed with
 * `buildingLensEnabled`, because the player could turn the lens off and the
 * backend would leave `lensOwnsCurrentMenu` set — it describes which menu the
 * toolbar has open, not what we intend to do about it — so mounting on it alone
 * would have kept the catalog on screen under a button that had just said
 * "disable".
 *
 * There is no such button any more, and no such state: the lens REPLACES
 * vanilla's build menu rather than offering an alternative to it. What is left
 * is the question that was always the real one — does the toolbar have a menu
 * open that we stand in for.
 */
export function shouldMountInAssetMenu(state: BuildingMenuMountState): boolean {
  if (state.isPhotoMode) {
    return false;
  }

  return state.lensOwnsCurrentMenu;
}
