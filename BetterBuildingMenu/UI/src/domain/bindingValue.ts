/**
 * How cs2/api's useValue turns binding updates into renders, so a hook standing in
 * for it (mods/panelValue) re-renders exactly when the game's would. Read from the
 * game's UI bundle (Cities2_Data/Content/Game/UI/index.js): a number is cut to six
 * decimals, and an update equal to the last value delivered is skipped, objects
 * compared ten levels down.
 */

/** What the game's useValue hands a component for this value. */
export function deliveredValue<T>(value: T): T {
  return typeof value === "number" && value ? Math.floor(1e6 * value) / 1e6 as T : value;
}

/** Whether delivering `next` after `previous` changes nothing, so the game skips it. */
export function sameDeliveredValue(previous: unknown, next: unknown): boolean {
  if (Array.isArray(previous) && Array.isArray(next) && previous.length === 0 && next.length === 0) {
    return true;
  }

  const value = deliveredValue(next);

  return typeof value === "object" && typeof previous === "object"
    ? deepEqual(previous, value, 10)
    : value === previous;
}

const hasOwn = Object.prototype.hasOwnProperty;

/** The game's own comparison: past `depth` levels, anything not identical has changed. */
function deepEqual(a: unknown, b: unknown, depth: number): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (depth <= 0 || typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], depth - 1)) {
        return false;
      }
    }

    return true;
  }

  const keys = Object.keys(a);

  if (keys.length !== Object.keys(b).length) {
    return false;
  }

  for (const key of keys) {
    if (!hasOwn.call(b, key) || !deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth - 1)) {
      return false;
    }
  }

  return true;
}
