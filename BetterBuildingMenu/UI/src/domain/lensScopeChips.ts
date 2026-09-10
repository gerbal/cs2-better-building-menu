/**
 * Which navigation chips the current scope justifies drawing. One rule, and it
 * is the whole module: a chip is drawn only when the state it writes is
 * actually applied to the result.
 */

export interface LensScopeState {
  /** The vanilla menu the lens is scoped to. Empty means the whole catalog. */
  menu?: string | null;
  /** The category within that menu. Empty means all of them. */
  menuCategory?: string | null;
  /** How many categories the scoped menu has. */
  menuCategoryCount?: number | null;
}

export interface LensScopeChips {
  /** The menu chip — picks a menu, and offers to drop the one that is set. */
  menu: boolean;
  /** The category chip — picks among the scoped menu's categories. */
  menuCategory: boolean;
}

export function isScopedToMenu(menu: string | null | undefined): boolean {
  return typeof menu === "string" && menu.trim() !== "";
}

export function lensScopeChipsFor(state: LensScopeState | null | undefined): LensScopeChips {
  const scoped = isScopedToMenu(state?.menu);

  return {
    menu: true,
    menuCategory: scoped && (state?.menuCategoryCount ?? 0) > 1,
  };
}
