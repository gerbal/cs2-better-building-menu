/**
 * Relevance ranking for the building grid.
 *
 * Search is the layer that makes a category of several hundred tractable, once
 * DLC and mods push a single menu well past what a grid can be scanned for. But
 * ranking and the grid's stable order want opposite things: browsing needs a
 * position that never moves, searching needs the best match first. So ranking
 * applies only while a query is active, and falls back to the stable order both
 * for ties and for an empty query.
 */

export interface GridEntry {
  id: number;
  name: string;
  thumbnail: string;
  constructionCost?: number | null;
  lotWidth?: number | null;
  lotDepth?: number | null;
}

export interface RankableEntry extends GridEntry {
  prefabName?: string | null;
  category?: string | null;
  subCategory?: string | null;
}

/**
 * A total order over a category that depends on nothing the player can change.
 *
 * Footprint first because it is what the player matches against the gap on the
 * map, then cost, then name so the result is deterministic. Entries with no
 * cost sort last rather than sorting as free.
 *
 * NOT the grid's order any more. This was applied to every result the grid,
 * list and cards rendered, including when the player had explicitly chosen a
 * sort — so "sort by capacity" reordered nothing and the table was the only
 * view where sorting appeared to work. The chosen sort now survives to the
 * screen; keeping this exported because the idea is sound and a
 * "browse order" sort option is the honest place for it, offered rather than
 * imposed.
 */
export function stableGridOrder<T extends GridEntry>(entries: readonly T[]): T[] {
  const area = (entry: GridEntry) => (entry.lotWidth ?? 0) * (entry.lotDepth ?? 0);
  const cost = (entry: GridEntry) =>
    typeof entry.constructionCost === "number" && Number.isFinite(entry.constructionCost)
      ? entry.constructionCost
      : Number.POSITIVE_INFINITY;

  return [...entries].sort(
    (a, b) => area(a) - area(b) || cost(a) - cost(b) || a.name.localeCompare(b.name)
  );
}

const EXACT = 1000;
const PREFIX = 800;
const WORD_START = 600;
const SUBSTRING = 400;
const FIELD = 200;
const SUBSEQUENCE = 100;

/** True when every character of `query` appears in `text`, in order. */
function isSubsequence(text: string, query: string): boolean {
  let at = 0;

  for (const ch of text) {
    if (ch === query[at]) at++;
    if (at === query.length) return true;
  }

  return false;
}

function scoreText(text: string, query: string): number {
  if (!text) return 0;

  if (text === query) return EXACT;
  if (text.startsWith(query)) return PREFIX;
  // A match at a word boundary reads as intentional; mid-word does not.
  if (text.includes(` ${query}`)) return WORD_START;
  if (text.includes(query)) return SUBSTRING;

  return 0;
}

export function matchScore(entry: RankableEntry, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  const name = (entry.name ?? "").toLowerCase();
  const direct = scoreText(name, query);
  if (direct > 0) return direct;

  // Prefab names are how modders and power users refer to assets, but a hit
  // here should never outrank a real display-name hit.
  const prefab = (entry.prefabName ?? "").toLowerCase();
  if (prefab && scoreText(prefab, query) > 0) return FIELD;

  const category = `${entry.category ?? ""} ${entry.subCategory ?? ""}`.toLowerCase();
  if (category && scoreText(category, query) > 0) return FIELD;

  // Subsequence catches initials ("dcc" -> Disease Control Center). It is
  // deliberately last and lowest: it matches generously and would otherwise
  // flood the results ahead of things the player actually typed.
  if (isSubsequence(name, query)) return SUBSEQUENCE;

  return 0;
}

/**
 * Matching entries, best first. An empty query returns them in the order they
 * arrived — which is the order the query sorted them into.
 */
export function rankBuildingMatches<T extends RankableEntry>(
  entries: readonly T[] | null | undefined,
  rawQuery: string
): T[] {
  if (!entries?.length) return [];

  const query = rawQuery.trim();

  // The incoming order IS the order the player asked for. This used to return
  // stableGridOrder here, which re-sorted by lot area then cost then name and
  // threw the chosen sort away — the whole reason "sorting does not work
  // outside table view": the table renders the page directly, and the grid,
  // list and cards all came through here. Sort by capacity on four garbage
  // buildings gave 100,000 / 50,000,000 / 1,500,000 / 3,000,000, which is
  // ascending lot area.
  //
  // Nothing is lost. The C# query has always had its own default order, so
  // "stable browse position" was already being provided one layer down; what
  // this added was a second, competing default that silently won.
  if (!query) return [...entries];

  // Incoming position is the tie-break, so equally relevant results keep a
  // fixed relative order between keystrokes.
  const incomingRank = new Map(entries.map((entry, index) => [entry.id, index]));

  return [...entries]
    .map((entry) => ({ entry, score: matchScore(entry, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) =>
      b.score - a.score
      // Shortest name next: against a real catalog "clinic" ties Medical
      // Clinic with Additional Clinic Center and Small Medical Clinic, and the
      // plain one is nearly always what was meant — extra words mean a variant.
      || a.entry.name.length - b.entry.name.length
      || (incomingRank.get(a.entry.id) ?? 0) - (incomingRank.get(b.entry.id) ?? 0))
    .map(({ entry }) => entry);
}

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
 * Only ever fires with an active query. In browse order the first tile is
 * simply the smallest, cheapest building in the category, and arming that on a
 * stray Enter would be a surprise rather than a shortcut.
 */
export function topSearchResult<T extends RankableEntry>(
  ranked: readonly T[],
  rawQuery: string
): T | null {
  if (!rawQuery.trim() || ranked.length === 0) {
    return null;
  }

  return ranked[0];
}
