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
 * Whether the tab row draws the menu's categories. Vanilla's rule and vanilla's
 * reason: a row offering one choice is not a choice. Ours carries an extra
 * "All" tab, so two real categories still make three and are worth showing.
 * Counted over the tabs the menu fills, as C# counts them when it picks the strip instead.
 * CatalogView.Opening opens on a tab by the same two-tab rule.
 */
export function shouldShowCategoryStrip(
  categories: readonly VanillaMenuCategory[] | null | undefined,
  counts: readonly MenuCategoryCount[] | null | undefined,
  menu: string | null | undefined
): boolean {
  return isAssetMenuScoped(menu) && presentCategories(categories, counts).length >= 2;
}

/**
 * Whether the asset menu stands in for one of the game's menus. Unscoped — Search
 * everything — the tab row would carry every category of every menu, and the
 * group headings already say the same thing.
 */
export function isAssetMenuScoped(menu: string | null | undefined): boolean {
  return (menu ?? "").trim() !== "";
}

/**
 * Tabs in the order the tab row draws them, by the game's own m_Priority. Sorted
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
 * collapsing null into 0 would flash zeroes across the tab row on every menu
 * change. A tab missing from a table that HAS arrived reads 0, not null. All is
 * not a tab here: C# sends its count on its own.
 */
export function categoryCount(
  counts: readonly MenuCategoryCount[] | null | undefined,
  categoryId: string
): number | null {
  const table = counts ?? [];

  if (table.length === 0) {
    return null;
  }

  const found = table.find((entry) => entry.id === categoryId);

  return found ? found.count : 0;
}

/**
 * The tabs a row draws: those C# sent a count for. It sends one for each tab the menu fills before
 * the filters and the search, so a tab they empty stays, at 0, and one the menu never fills is
 * left out. Before the counts land the full list is kept, so the row cannot flicker.
 */
export function presentCategories(
  categories: readonly VanillaMenuCategory[] | null | undefined,
  counts: readonly MenuCategoryCount[] | null | undefined
): VanillaMenuCategory[] {
  const ordered = orderedCategories(categories);
  const sent = new Set((counts ?? []).map((entry) => entry.id));

  return sent.size === 0 ? ordered : ordered.filter((category) => sent.has(category.id));
}
