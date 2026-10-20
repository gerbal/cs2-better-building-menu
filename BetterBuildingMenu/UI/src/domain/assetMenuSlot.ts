/**
 * Where the game's asset-menu slot is right now, if it exists.
 *
 * The game mounts that slot when a menu opens and unmounts it when the menu
 * closes, so a menu drawn inside it is built from nothing on every open. The
 * slot publishes itself here instead, and the menu, built once in a host that
 * outlives it, moves into whichever slot is current.
 */
export interface AssetMenuSlot<TElement = unknown> {
  /** The element the kept menu is moved into. */
  element: TElement;
  /** The game's own menu close, from the extension point's props. */
  onClose?: () => void;
}

export interface AssetMenuSlotStore<TElement = unknown> {
  current(): AssetMenuSlot<TElement> | null;
  /** Publishes a slot; the returned function withdraws it, and only it. */
  open(slot: AssetMenuSlot<TElement>): () => void;
  subscribe(listener: (slot: AssetMenuSlot<TElement> | null) => void): () => void;
  /** Whether the kept menu has failed to render; the slot then draws vanilla's. */
  failed(): boolean;
  fail(): void;
}

export function createAssetMenuSlotStore<TElement = unknown>(): AssetMenuSlotStore<TElement> {
  let current: AssetMenuSlot<TElement> | null = null;
  let failed = false;
  const listeners = new Set<(slot: AssetMenuSlot<TElement> | null) => void>();

  const publish = (slot: AssetMenuSlot<TElement> | null): void => {
    current = slot;
    for (const listener of Array.from(listeners)) {
      listener(slot);
    }
  };

  return {
    current: () => current,
    open(slot) {
      publish(slot);

      // A slot that replaced this one before it went must not be withdrawn by
      // this one's cleanup: React may mount the new slot before the old unmounts.
      return () => {
        if (current === slot) {
          publish(null);
        }
      };
    },
    failed: () => failed,
    fail() {
      if (failed) {
        return;
      }

      failed = true;
      publish(current);
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
