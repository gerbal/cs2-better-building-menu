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

/** Whether the page answers the query in the box: it trails the box by a debounce. */
export function pageAnswers(page: { searchText?: string | null } | null | undefined, query: string): boolean {
  return (page?.searchText ?? "").trim() === query.trim();
}

/** Arm this prefab, wait for the page that answers this search, or do nothing. */
export type EnterDecision = { arm: number } | { wait: string } | null;

/**
 * What Enter does: arm the backend's best match for an active search, by id,
 * whether or not its row is loaded: C# chooses it from the whole result, whatever
 * the sort. The page trails the box by a debounce, so until it answers the search
 * in the box, Enter waits for it.
 */
export function enterDecision(
  page: { bestMatchId?: number | null; searchText?: string | null },
  rawQuery: string
): EnterDecision {
  const query = rawQuery.trim();
  if (!query) {
    return null;
  }

  if (!pageAnswers(page, query)) {
    return { wait: query };
  }

  return page.bestMatchId == null ? null : { arm: page.bestMatchId };
}

/** Enter, by code: Cohtml leaves `key` empty for some keys. */
const ENTER_KEY_CODE = 13;
/** What a key reports while an input method is composing. */
const IME_PROCESS_KEY_CODE = 229;

/**
 * Whether a keydown is a plain Enter, by `key` or by `keyCode` (Cohtml can leave
 * `key` empty). An Enter that confirms an input method's candidate (Japanese,
 * Korean, Chinese) belongs to the composition and must not place a building.
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

/** A key the search field passes to the list while it has the keys. */
export type SearchFieldKey = "up" | "down" | "pageUp" | "pageDown";

const FIELD_KEYS_BY_NAME = new Map<string, SearchFieldKey>([
  ["ArrowUp", "up"],
  ["ArrowDown", "down"],
  ["PageUp", "pageUp"],
  ["PageDown", "pageDown"],
]);

const FIELD_KEYS_BY_CODE = new Map<number, SearchFieldKey>([
  [38, "up"],
  [40, "down"],
  [33, "pageUp"],
  [34, "pageDown"],
]);

/**
 * Which of the list's keys a keydown is, by `key` or by `keyCode` (Cohtml can leave `key` empty), or
 * null. Held with a modifier they select or edit the field's text, so they stay the field's.
 */
export function searchFieldKey(event: {
  key?: unknown;
  keyCode?: unknown;
  shiftKey?: unknown;
  ctrlKey?: unknown;
  altKey?: unknown;
  metaKey?: unknown;
}): SearchFieldKey | null {
  if (event.shiftKey === true || event.ctrlKey === true || event.altKey === true || event.metaKey === true) {
    return null;
  }

  const byName = typeof event.key === "string" ? FIELD_KEYS_BY_NAME.get(event.key) : undefined;
  const byCode = typeof event.keyCode === "number" ? FIELD_KEYS_BY_CODE.get(event.keyCode) : undefined;

  return byName ?? byCode ?? null;
}
