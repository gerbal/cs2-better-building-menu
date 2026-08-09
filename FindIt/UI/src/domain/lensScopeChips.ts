/**
 * Which navigation chips the current scope justifies drawing.
 *
 * One rule, and it is the whole module: **a chip is drawn only when the state
 * it writes is actually applied to the result.**
 *
 * That rule exists because it was broken. Opening the lens from a bottom-bar
 * icon scopes the query to that vanilla menu, and a menu-scoped query
 * deliberately stops applying our own section/type taxonomy —
 * BuildingCatalogQueryEngine.cs:95 skips MatchesBuildMenu entirely, because
 * layering our reconstruction on top of the game's menu tree cut Roads from
 * 157 assets to 122 and Transportation from 53 to 30. That suppression is
 * right and stays.
 *
 * What was wrong is that the Section and Type chips stayed on screen through
 * all of it: clickable, restyling themselves as if they had taken effect, and
 * discarded by the query. So the row showed the player two controls that could
 * not act and never named the one thing that was actually narrowing the view.
 *
 * The zoning view has the same shape for a different reason — it renders the
 * zone catalog, not the building catalog, so a chip saying "Networks" over a
 * list of zones names something that is not on screen.
 */

export interface LensScopeState {
  /** The vanilla menu the lens is scoped to. Empty means the whole catalog. */
  menu?: string | null;
  /** The category within that menu. Empty means all of them. */
  menuCategory?: string | null;
  /** How many categories the scoped menu has. */
  menuCategoryCount?: number | null;
  /** Whether the zoning renderer is on screen instead of the catalog. */
  showZoning?: boolean | null;
  /** How many types the current section offers. */
  subCategoryCount?: number | null;
}

export interface LensScopeChips {
  /** The menu chip — picks a menu, and offers to drop the one that is set. */
  menu: boolean;
  /** The category chip — picks among the scoped menu's categories. */
  menuCategory: boolean;
  /** Our taxonomy's section. */
  section: boolean;
  /** Our taxonomy's type within that section. */
  subCategory: boolean;
}

export function isScopedToMenu(menu: string | null | undefined): boolean {
  return typeof menu === "string" && menu.trim() !== "";
}

export function lensScopeChipsFor(state: LensScopeState | null | undefined): LensScopeChips {
  const scoped = isScopedToMenu(state?.menu);
  const zoning = state?.showZoning === true;

  return {
    // Always. A bottom-bar icon is a shortcut to a menu, and if the menu is a
    // facet then it has to be pickable from inside the filters too — otherwise
    // the chip names a state only the toolbar can produce, and the unscoped
    // view has no way to ask for Zones at all.
    menu: true,
    // One category is not a choice, the same threshold the strip uses. A menu
    // with a single category would otherwise get a chip that can only be set
    // to the value it already has.
    menuCategory: scoped && (state?.menuCategoryCount ?? 0) > 1,
    section: !scoped && !zoning,
    subCategory: !scoped && !zoning && (state?.subCategoryCount ?? 0) > 0,
  };
}
