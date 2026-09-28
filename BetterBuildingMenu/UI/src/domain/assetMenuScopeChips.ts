/**
 * Which navigation chips the current scope justifies drawing. One rule, and it
 * is the whole module: a chip is drawn only when the state it writes is
 * actually applied to the result.
 */

export interface AssetMenuScopeState {
  /** The vanilla menu the asset menu is scoped to. Empty means the whole catalog. */
  menu?: string | null;
  /** The category within that menu. Empty means all of them. */
  menuCategory?: string | null;
  /** How many categories the scoped menu has. */
  menuCategoryCount?: number | null;
}

export interface AssetMenuScopeChips {
  /** The menu chip — picks a menu, and offers to drop the one that is set. */
  menu: boolean;
  /** The category chip — picks among the scoped menu's categories. */
  menuCategory: boolean;
}

export function isScopedToMenu(menu: string | null | undefined): boolean {
  return typeof menu === "string" && menu.trim() !== "";
}

export function assetMenuScopeChipsFor(state: AssetMenuScopeState | null | undefined): AssetMenuScopeChips {
  const scoped = isScopedToMenu(state?.menu);

  return {
    menu: true,
    menuCategory: scoped && (state?.menuCategoryCount ?? 0) > 1,
  };
}
