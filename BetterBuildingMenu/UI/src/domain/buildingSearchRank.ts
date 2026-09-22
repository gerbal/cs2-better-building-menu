/**
 * What the UI says about a search: whether it matched elsewhere, and what Enter
 * should arm. The scoring is BuildingCatalogRelevance.cs's, and C# names the
 * best match with the page, so nothing here scores or reorders.
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
 * an active query, and only the backend's pick: a grouped page is ordered by
 * group before relevance, so its first row need not be the best match.
 */
export function enterTarget<T extends { id: number }>(
  items: readonly T[],
  bestMatchId: number | null | undefined,
  rawQuery: string
): T | null {
  if (!rawQuery.trim() || bestMatchId == null) {
    return null;
  }

  return items.find((item) => item.id === bestMatchId) ?? null;
}
