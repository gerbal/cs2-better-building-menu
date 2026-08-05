/**
 * The two things that make a build menu get faster with use.
 *
 * A shelf of what you actually place, at positions that hold still.
 *
 * The table this replaces in the placement path ordered itself by sort column,
 * facet state, search text and page offset, so the same school was never twice
 * in the same place and had to be re-read every time. Vanilla's grid is not
 * information-poor by accident: a fixed position becomes a memorised gesture
 * after about three uses, which is a cost that decays to nothing. That is the
 * property worth protecting here.
 */

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
