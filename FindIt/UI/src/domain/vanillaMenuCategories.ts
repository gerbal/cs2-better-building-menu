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

/** One tab's share of the menu, published beside the categories. */
export interface MenuCategoryCount {
  id: string;
  count: number;
}

/**
 * How many assets sit behind a tab, or null when the backend has not said.
 *
 * Null rather than 0, and the difference is load-bearing: a tab that genuinely
 * holds nothing should read 0, and one whose count has not arrived yet should
 * read nothing at all. Collapsing them would flash "0" across a whole strip on
 * every menu change.
 */
export function categoryCount(
  counts: readonly MenuCategoryCount[] | null | undefined,
  categoryId: string
): number | null {
  if (categoryId === ALL_CATEGORIES_ID) {
    return (counts ?? []).reduce((total, entry) => total + (entry.count ?? 0), 0) || null;
  }

  const found = (counts ?? []).find((entry) => entry.id === categoryId);

  return found ? found.count : null;
}

/**
 * Above this many tabs the strip stops being a row of glyphs you can scan.
 *
 * Measured on Landscaping: 14 categories drawn as 14 icon-only squares, with
 * the "All" view showing the first 100 of 379 — which covered 7 of those 14.
 * Half the menu was reachable only by guessing which unlabelled square held it.
 *
 * Six is where a row of icons is still a row you read rather than a wall you
 * search. Transportation has six and works; Landscaping has fourteen and does
 * not.
 */
export const CATEGORY_STRIP_WIDE_THRESHOLD = 6;

export function shouldWidenCategoryStrip(
  categories: readonly VanillaMenuCategory[] | null | undefined
): boolean {
  return (categories ?? []).length > CATEGORY_STRIP_WIDE_THRESHOLD;
}
