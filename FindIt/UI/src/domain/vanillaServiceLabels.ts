/**
 * The game's own names for its menus and their categories.
 *
 * Measured against a running game, because guessing at this has now failed
 * twice. The original code asked for `Assets.SUB_SERVICE_NAME[id]` then
 * `Assets.NAME[id]`, neither of which is a key family CS2 has, so every tab in
 * the category strip fell back to the raw prefab name in every language.
 *
 * Grepping Locale.cok then suggested one family, `Services.NAME[...]`, covering
 * both — which was an artefact of the search: `Services.NAME[X]` matches as a
 * substring of `SubServices.NAME[X]`, so the two families read as one.
 *
 * What the running game actually answers:
 *
 * - `Services.NAME[GarbageManagement]` -> "Garbage Management"   (a menu)
 * - `Services.NAME[TransportationRoad]` -> missing               (a category)
 * - `SubServices.NAME[TransportationRoad]` -> "Road"             (a category)
 *
 * So the two tiers have two key families, and a category asked under the menu
 * family silently renders its prefab id. Both are tried in order anyway: menu
 * and category ids are distinct, a missing key costs one lookup, and a menu
 * that only registered a SubServices entry still resolves.
 *
 * Keys, not lookups, because `translate` belongs to the component and this
 * module stays pure enough to test.
 */

/**
 * The one menu whose contents the lens has changed, so the one menu whose name
 * the game's own string no longer describes.
 *
 * Roads gathers every network now — tracks, paths, seaways, power lines, pipes
 * — so "Roads" undersells it by about 230 assets. See NetworkMenuExtension on
 * the C# side for what goes in and why. The id stays "Roads": it is the prefab
 * name every other layer keys on, and only the label changes.
 */
const EXTENDED_NETWORK_MENU = "Roads";

/** Our name for it, which has to win over the game's. */
export const EXTENDED_NETWORK_MENU_KEY = "Tooltip.LABEL[FindItBuildingMenu.MenuRoadsAndNetworks]";

/** Ordered candidate keys for a vanilla menu's display name. */
export function vanillaMenuNameKeys(id: string | null | undefined): string[] {
  const trimmed = typeof id === "string" ? id.trim() : "";

  if (trimmed === "") {
    return [];
  }

  const vanilla = [`Services.NAME[${trimmed}]`, `SubServices.NAME[${trimmed}]`];

  // First, not instead. resolveVanillaLabel takes the first key that resolves,
  // so ours wins where it is translated and the game's name is still there
  // underneath for a language we have not covered — which beats falling back to
  // the raw id the way an unconditional override would.
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
 * The first key that resolves, or the raw id.
 *
 * `lookup` is the component's `translate` bound to a null fallback, so a
 * missing key comes back null rather than as the key itself.
 */
export function resolveVanillaLabel(
  keys: readonly string[],
  lookup: (key: string) => string | null | undefined,
  fallback: string,
): string {
  for (const key of keys) {
    const resolved = lookup(key);

    if (typeof resolved === "string" && resolved.trim() !== "") {
      return resolved;
    }
  }

  return fallback;
}
