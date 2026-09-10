/**
 * Whether the build menu draws — one tested answer rather than a condition
 * inline in an extension point.
 */

export interface BuildingMenuMountState {
  /** The toolbar's open menu is one we stand in for. */
  lensOwnsCurrentMenu: boolean;
  /** Photo mode hides every panel. */
  isPhotoMode: boolean;
  /**
   * Upstream Find It's own panel is showing; false when it is not installed.
   * Its asset-menu extension blanks the slot anyway, so stating the rule here
   * too keeps the outcome off which mod the game registered last.
   */
  findItPanelShown?: boolean;
}

/**
 * Whether the game's asset-menu slot should draw the menu: does the toolbar
 * have a menu open that we stand in for, and is nothing else claiming the
 * screen. The lens REPLACES the build menu, so there is no enabled state.
 */
export function shouldMountInAssetMenu(state: BuildingMenuMountState): boolean {
  if (state.isPhotoMode || state.findItPanelShown) {
    return false;
  }

  return state.lensOwnsCurrentMenu;
}
