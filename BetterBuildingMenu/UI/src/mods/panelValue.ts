import type { ValueBinding } from "cs2/api";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { deliveredValue, sameDeliveredValue } from "domain/bindingValue";

/**
 * Every toolbar menu keeps a built panel (see KeptAssetMenu), and the hidden ones
 * are frozen: their bindings and the view store stop delivering updates, so React
 * never re-renders them while another menu is open. Thawed, every reader takes the
 * live value at once. Outside a panel these hooks never freeze.
 */
export interface PanelFreeze {
  frozen: boolean;
  /** Each reader's catch-up, run when the panel thaws. */
  readonly readers: Set<() => void>;
}

export const PanelFreezeContext = createContext<PanelFreeze | null>(null);

export function createPanelFreeze(frozen: boolean): PanelFreeze {
  return { frozen, readers: new Set() };
}

export function setPanelFrozen(panel: PanelFreeze, frozen: boolean): void {
  if (panel.frozen === frozen) {
    return;
  }

  panel.frozen = frozen;

  if (!frozen) {
    for (const reader of [...panel.readers]) {
      reader();
    }
  }
}

/**
 * cs2/api's useValue, holding still while its panel is frozen. Otherwise it is the
 * game's hook, read in game: one subscription, state set from its change listener,
 * an update equal to the last one skipped (see domain/bindingValue). Every file
 * inside the kept menu reads bindings through this; see bindingReadContract.test.
 */
export function useValue<T>(binding: ValueBinding<T>): T {
  const panel = useContext(PanelFreezeContext);
  const subscription = useMemo(() => binding.subscribe(), [binding]);
  const [value, setValue] = useState<T>(() => deliveredValue(subscription.value));
  const delivered = useRef<T>(value);

  useEffect(() => {
    const apply = (next: T) => {
      if (panel?.frozen || sameDeliveredValue(delivered.current, next)) {
        return;
      }

      delivered.current = deliveredValue(next);
      setValue(delivered.current);
    };
    const thawed = () => apply(subscription.value);

    apply(subscription.value);
    subscription.setChangeListener(apply);
    panel?.readers.add(thawed);

    return () => {
      panel?.readers.delete(thawed);
      subscription.dispose();
    };
  }, [subscription, panel]);

  return value;
}

/**
 * useSyncExternalStore for a store the kept menu shares (the view store), holding
 * the last value it drew while its panel is frozen.
 */
export function usePanelStore<T>(subscribe: (listener: () => void) => () => void, read: () => T): T {
  const panel = useContext(PanelFreezeContext);
  const drawn = useRef<{ value: T } | null>(null);

  const subscribeLive = useCallback((notify: () => void) => {
    const unsubscribe = subscribe(() => {
      if (!panel?.frozen) {
        notify();
      }
    });
    panel?.readers.add(notify);

    return () => {
      unsubscribe();
      panel?.readers.delete(notify);
    };
  }, [subscribe, panel]);

  const snapshot = () => (panel?.frozen && drawn.current ? drawn.current.value : read());
  const value = useSyncExternalStore(subscribeLive, snapshot, snapshot);
  drawn.current = { value };
  return value;
}
