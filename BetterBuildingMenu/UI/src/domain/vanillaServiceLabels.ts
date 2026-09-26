/**
 * The game's own names for its menus and their categories. Two tiers, two key
 * families — `Services.NAME` and `SubServices.NAME` — and the wrong one
 * silently renders a prefab id, so both are tried in order.
 */

/**
 * The one menu whose contents the lens changes, so the one whose game-supplied
 * name does not describe it: Roads gathers every network. Only the LABEL
 * changes; the id stays the prefab name every other layer keys on.
 */
const EXTENDED_NETWORK_MENU = "Roads";

/** Our name for it, which has to win over the game's. */
export const EXTENDED_NETWORK_MENU_KEY = "Tooltip.LABEL[BetterBuildingMenu.MenuRoadsAndNetworks]";

/**
 * The "All" tab and chip. The game's word first: it ships it in every language,
 * where ours is English only.
 */
export const ALL_CATEGORIES_KEYS: readonly string[] = [
  "Editor.ASSET_CATEGORY_TITLE[All]",
  "Tooltip.LABEL[BetterBuildingMenu.AllCategories]",
];

/** Ordered candidate keys for a vanilla menu's display name. */
export function vanillaMenuNameKeys(id: string | null | undefined): string[] {
  const trimmed = typeof id === "string" ? id.trim() : "";

  if (trimmed === "") {
    return [];
  }

  const vanilla = [`Services.NAME[${trimmed}]`, `SubServices.NAME[${trimmed}]`];

  // First, not instead: resolveVanillaLabel takes the first key that resolves,
  // so ours wins where it is translated and the game's name still covers a
  // language we have not, rather than falling through to the raw id.
  return trimmed.toLowerCase() === EXTENDED_NETWORK_MENU.toLowerCase()
    ? [EXTENDED_NETWORK_MENU_KEY, ...vanilla]
    : vanilla;
}

/** Ordered candidate keys for a category within a menu. */
export function vanillaCategoryNameKeys(id: string | null | undefined): string[] {
  const trimmed = typeof id === "string" ? id.trim() : "";

  return trimmed === "" ? [] : [`SubServices.NAME[${trimmed}]`, `Services.NAME[${trimmed}]`];
}

/**
 * The first key that resolves, or the raw id. `lookup` is the component's
 * `translate` bound to a null fallback, so a missing key comes back null
 * rather than as the key itself. Trimmed, as C#'s WordFormat.GameText trims:
 * some of the game's strings end in a line break ("Small Roads").
 */
export function resolveVanillaLabel(
  keys: readonly string[],
  lookup: (key: string) => string | null | undefined,
  fallback: string,
): string {
  for (const key of keys) {
    const resolved = lookup(key);

    if (typeof resolved === "string" && resolved.trim() !== "") {
      return resolved.trim();
    }
  }

  return fallback;
}
