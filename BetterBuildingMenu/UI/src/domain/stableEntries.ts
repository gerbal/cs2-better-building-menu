/**
 * Keeps a row's object across catalog pages while its content is unchanged.
 *
 * Every page the backend publishes arrives as fresh objects, so a memoised card
 * compared by reference would draw again for every page: growing the window by a
 * step redrew every card already on screen, and the cost of a step grew with the
 * cards above it. Handing back the previous object for an unchanged row lets the
 * cards that did not change skip their render.
 */
export function reuseUnchanged<T extends { id: number }>(
  previous: ReadonlyMap<number, T>,
  next: readonly T[]
): { items: T[]; byId: Map<number, T> } {
  const byId = new Map<number, T>();
  const items = next.map((entry) => {
    const kept = previous.get(entry.id);
    const row = kept !== undefined && sameValue(kept, entry) ? kept : entry;
    byId.set(row.id, row);
    return row;
  });

  return { items, byId };
}

/**
 * Structural equality over what a binding can carry: primitives, arrays and plain
 * objects. A key that is present differs from one that is absent, even when its
 * value is undefined, because the backend writes every field it has.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!sameValue(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);

  if (keys.length !== Object.keys(right).length) {
    return false;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) || !sameValue(left[key], right[key])) {
      return false;
    }
  }

  return true;
}
