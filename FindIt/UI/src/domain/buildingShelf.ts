/**
 * The two things that make a build menu get faster with use.
 *
 * A shelf of what you actually place, at positions that hold still, and a grid
 * order that never depends on mutable state.
 *
 * The table this replaces in the placement path ordered itself by sort column,
 * facet state, search text and page offset, so the same school was never twice
 * in the same place and had to be re-read every time. Vanilla's grid is not
 * information-poor by accident: a fixed position becomes a memorised gesture
 * after about three uses, which is a cost that decays to nothing. That is the
 * property worth protecting here.
 */

export interface GridEntry {
  id: number;
  name: string;
  thumbnail: string;
  constructionCost?: number | null;
  lotWidth?: number | null;
  lotDepth?: number | null;
}

/**
 * Bounded deliberately. A shelf you cannot learn the shape of is just another
 * list; twelve is about the limit of positions worth memorising.
 */
export const SHELF_SIZE = 12;

const placements = new Map<number, number>();
// Insertion order breaks frequency ties, so equally-placed buildings never
// swap under the cursor.
let firstSeen = 0;
const seenAt = new Map<number, number>();

export function recordPlacement(id: number): void {
  placements.set(id, (placements.get(id) ?? 0) + 1);

  if (!seenAt.has(id)) {
    seenAt.set(id, firstSeen++);
  }
}

export function getShelf(): number[] {
  return [...placements.entries()]
    .sort(([idA, countA], [idB, countB]) =>
      countB - countA || (seenAt.get(idA) ?? 0) - (seenAt.get(idB) ?? 0))
    .slice(0, SHELF_SIZE)
    .map(([id]) => id);
}

/** Test seam; not used by the UI. */
export function resetShelf(): void {
  placements.clear();
  seenAt.clear();
  firstSeen = 0;
}

/**
 * A total order over a category that depends on nothing the player can change.
 *
 * Footprint first because it is what the player is matching against the gap on
 * the map, then cost, then name so the result is deterministic. Entries with no
 * cost sort last rather than sorting as free.
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
