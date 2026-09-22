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

/** Arm this entry, wait for the page that answers this search, or do nothing. */
export type EnterDecision<T> = { arm: T } | { wait: string } | null;

/**
 * What Enter does: arm the backend's best match for an active search, since a
 * grouped page's first row need not be it. The page trails the box by a
 * debounce, so until it answers the search in the box, Enter waits for it.
 */
export function enterDecision<T extends { id: number }>(
  page: { items: readonly T[]; bestMatchId?: number | null; searchText?: string | null },
  rawQuery: string
): EnterDecision<T> {
  const query = rawQuery.trim();
  if (!query) {
    return null;
  }

  if ((page.searchText ?? "").trim() !== query) {
    return { wait: query };
  }

  const target = page.bestMatchId == null ? undefined : page.items.find((item) => item.id === page.bestMatchId);
  return target ? { arm: target } : null;
}

/** Enter, by code: Cohtml leaves `key` empty for some keys. */
const ENTER_KEY_CODE = 13;
/** What a key reports while an input method is composing. */
const IME_PROCESS_KEY_CODE = 229;

/**
 * Whether a keydown is a plain Enter. Accepts either spelling, since Cohtml
 * fills `keyCode` where it leaves `key` empty. An Enter that confirms an input
 * method's candidate (Japanese, Korean, Chinese) belongs to the composition,
 * and must not place a building.
 */
export function isPlainEnter(event: { key?: unknown; keyCode?: unknown; isComposing?: unknown }): boolean {
  if (event.isComposing === true || event.keyCode === IME_PROCESS_KEY_CODE) {
    return false;
  }

  return event.key === "Enter" || event.keyCode === ENTER_KEY_CODE;
}

/**
 * Whether an Enter is the search's to act on: from the search box, or from no
 * text field at all. Enter in any other field (a metric bound, a filter's
 * option search) commits that field, and must not place a building.
 */
export function isEnterForSearch(target: unknown, fromSearchField: boolean): boolean {
  if (fromSearchField) {
    return true;
  }

  const element = target as { tagName?: unknown; isContentEditable?: unknown } | null | undefined;
  const tag = typeof element?.tagName === "string" ? element.tagName.toUpperCase() : "";

  return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && element?.isContentEditable !== true;
}
