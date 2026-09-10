/**
 * What the UI says about a search: whether it matched elsewhere, and what Enter
 * should arm. The scoring is BuildingCatalogRelevance.cs's, and the page
 * arrives in relevance order for every view, so nothing here reorders it.
 */

export interface SearchScopeNotice {
  elsewhere: number;
  canWiden: boolean;
}

/**
 * Whether to tell the player their search matched outside the current section.
 * A scoped search that finds nothing reads as "this building does not exist"
 * when it means "not here" — but only worth saying if there is somewhere else.
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
 * The entry Enter should arm, or null when Enter should do nothing. Only with
 * an active query: the first entry of a searched page is the backend's best
 * match, while in browse order it is just the first tile.
 */
export function topSearchResult<T>(ranked: readonly T[], rawQuery: string): T | null {
  if (!rawQuery.trim() || ranked.length === 0) {
    return null;
  }

  return ranked[0];
}
