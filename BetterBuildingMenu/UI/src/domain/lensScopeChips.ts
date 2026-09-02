/**
 * Which navigation chips the current scope justifies drawing.
 *
 * One rule, and it is the whole module: **a chip is drawn only when the state
 * it writes is actually applied to the result.**
 *
 * That rule exists because it was broken. The lens once had its own section
 * and type taxonomy, applied only when no vanilla menu was scoped — and the
 * Section and Type chips stayed on screen through a menu-scoped query:
 * clickable, restyling themselves as if they had taken effect, and discarded
 * by the query. This module hid them. The taxonomy itself has since gone
 * (cm-jjlv.6): the game's menu tree is the only scope, so the two chips left
 * are the menu and the category within it.
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
