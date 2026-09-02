/**
 * What the UI still says about a search: whether it matched elsewhere, and
 * what Enter should arm.
 *
 * The scoring that used to live here — matchScore, rankBuildingMatches,
 * stableGridOrder — is BuildingCatalogRelevance.cs now. The grid re-ranked
 * the page the backend had already ordered, and disagreed with the table;
 * worse, it dropped anything its own scoring gave 0, so a search by pdx mods
 * id (which the backend matches) vanished from the grid. The page arrives in
 * relevance order for every view; this module no longer reorders it.
 */

export interface SearchScopeNotice {
  elsewhere: number;
  canWiden: boolean;
}

/**
 * Whether to tell the player their search matched outside the current section.
 *
 * A scoped search that finds nothing reports "0", which reads as "this building
 * does not exist" when it almost always means "not in this category". With a
 * catalog of thousands across many sections that is the single most misleading
 * state the search can reach, so it is worth naming — but only when there is
 * somewhere else to look.
 */
export function getSearchScopeNotice(state: {
  searchText: string;
  shown: number;
  elsewhere: number;
}): SearchScopeNotice | null {
  if (!state.searchText.trim() || state.shown > 0 || state.elsewhere <= 0) {
    return null;
  }

  return { elsewhere: state.elsewhere, canWiden: true };
}

/**
 * The entry Enter should arm, or null when Enter should do nothing.
 *
 * Only ever fires with an active query: the first entry of a searched page is
 * the backend's best match. In browse order the first tile is simply the
 * smallest, cheapest building in the category, and arming that on a stray
 * Enter would be a surprise rather than a shortcut.
 */
export function topSearchResult<T>(ranked: readonly T[], rawQuery: string): T | null {
  if (!rawQuery.trim() || ranked.length === 0) {
    return null;
  }

  return ranked[0];
}
