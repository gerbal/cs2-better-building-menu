/**
 * Vanilla's second tier: the category tabs inside one build menu — Road, Train,
 * Subway and the rest under Transportation.
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
 * Whether the strip is worth drawing at all. Vanilla's rule and vanilla's
 * reason: a strip offering one choice is not a choice. Ours carries an extra
 * "All" tab, so two real categories still make three and are worth showing.
 */
export function shouldShowCategoryStrip(
  categories: readonly VanillaMenuCategory[] | null | undefined,
  menu: string | null | undefined
): boolean {
  return isLensScoped(menu) && (categories?.length ?? 0) >= 2;
}

/**
 * Whether the lens stands in for one of the game's menus. Unscoped — Search
 * everything — the strip would carry every category of every menu across four
 * wrapped rows, and the group headings already say the same thing.
 */
export function isLensScoped(menu: string | null | undefined): boolean {
  return (menu ?? "").trim() !== "";
}

/**
 * Tabs in the order the strip draws them, by the game's own m_Priority. Sorted
 * again here because the binding is a plain array; ties keep their incoming
 * order, which matters because m_Priority defaults to 0.
 */
export function orderedCategories(
  categories: readonly VanillaMenuCategory[] | null | undefined
): VanillaMenuCategory[] {
  return [...(categories ?? [])].sort((left, right) => left.priority - right.priority);
}

/**
 * Whether a tab is the active one. The empty selection means "all", a state
 * vanilla has no tab for, and it is what lets a player see a whole menu at once.
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
 * How many assets sit behind a tab, or null when the backend has not said —
 * collapsing null into 0 would flash zeroes across the strip on every menu
 * change. A tab missing from a table that HAS arrived reads 0, not null.
 */
export function categoryCount(
  counts: readonly MenuCategoryCount[] | null | undefined,
  categoryId: string
): number | null {
  const table = counts ?? [];

  if (table.length === 0) {
    return null;
  }

  if (categoryId === ALL_CATEGORIES_ID) {
    return table.reduce((total, entry) => total + (entry.count ?? 0), 0);
  }

  const found = table.find((entry) => entry.id === categoryId);

  return found ? found.count : 0;
}

/**
 * What the strip's "All" tab counts. The category table is counted across the
 * whole scope with its own selection dropped, so its sum IS the result set;
 * branch tabs are no partition, and their sum is only a first-frame fallback.
 */
export function allTabTotal(
  counts: readonly MenuCategoryCount[] | null | undefined,
  stripTabs: readonly { count: number }[] | null | undefined
): number {
  const fromCounts = categoryCount(counts, ALL_CATEGORIES_ID);

  return fromCounts ?? (stripTabs ?? []).reduce((total, tab) => total + (tab.count ?? 0), 0);
}

/**
 * The tabs worth drawing: the ones with something behind them, since the tab
 * list and the membership rule answer different questions and can disagree.
 * Before the counts land the full list is kept, so the strip cannot flicker.
 */
export function visibleCategories(
  categories: readonly VanillaMenuCategory[] | null | undefined,
  counts: readonly MenuCategoryCount[] | null | undefined
): VanillaMenuCategory[] {
  const ordered = orderedCategories(categories);

  if ((counts ?? []).length === 0) {
    return ordered;
  }

  return ordered.filter((category) => (categoryCount(counts, category.id) ?? 0) > 0);
}
