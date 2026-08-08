/**
 * Vanilla's second tier: the category tabs inside one build menu.
 *
 * Transportation is Road, Train, Subway, Tram, Air and Ship. The lens scoped
 * correctly to the menu but drew all 53 of its members as one flat list,
 * because nothing published the tabs.
 */
export interface VanillaMenuCategory {
  id: string;
  name: string;
  icon: string;
  priority: number;
}

/** The pseudo-tab meaning "everything in this menu". Never a real category id. */
export const ALL_CATEGORIES_ID = "";

/**
 * Whether the strip is worth drawing at all.
 *
 * Vanilla hides its category row below two categories and renders a single
 * non-interactive tab at exactly one — a strip offering one choice is not a
 * choice. That fires immediately here: Water & Sewage and Zones each have
 * exactly one category.
 *
 * We apply the same rule for the same reason, with one difference: our strip
 * carries an extra "All" tab, so a menu with two real categories offers three
 * and is still worth showing.
 */
export function shouldShowCategoryStrip(
  categories: readonly VanillaMenuCategory[] | null | undefined
): boolean {
  return (categories?.length ?? 0) >= 2;
}

/**
 * Tabs in the order the strip should draw them.
 *
 * Sorted by the game's own m_Priority, which the backend already applied — this
 * re-sorts defensively because the binding is a plain array and a future
 * publisher could forget. Ties keep their incoming order: Array.prototype.sort
 * is stable, and equal priorities are common because m_Priority defaults to 0.
 */
export function orderedCategories(
  categories: readonly VanillaMenuCategory[] | null | undefined
): VanillaMenuCategory[] {
  return [...(categories ?? [])].sort((left, right) => left.priority - right.priority);
}

/**
 * Whether a tab is the active one.
 *
 * The empty selection means "all", which is a state vanilla has no tab for —
 * it always opens on the first category. Keeping it lets a player see a whole
 * menu at once, which is the thing the lens can do that the vanilla menu
 * cannot.
 */
export function isCategorySelected(
  categoryId: string,
  selected: string | null | undefined
): boolean {
  return (selected ?? ALL_CATEGORIES_ID) === categoryId;
}
