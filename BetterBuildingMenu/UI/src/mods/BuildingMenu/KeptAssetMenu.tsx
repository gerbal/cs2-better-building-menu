import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AssetMenu } from "mods/BuildingMenu/AssetMenu";
import { AssetMenuShownContext } from "mods/BuildingMenu/assetMenuShown";
import { ExtensionBoundary } from "mods/ExtensionBoundary";
import { createAssetMenuSlotStore, type AssetMenuSlot as Slot } from "domain/assetMenuSlot";

import styles from "mods/BuildingMenu/assetMenu.module.scss";

const slots = createAssetMenuSlotStore<HTMLElement>();

/**
 * Whether the kept menu has failed to render. It draws outside the slot, so the
 * slot's own boundary never sees its errors; the slot reads this instead and
 * draws the game's grid, as it would for an error of its own.
 */
export function useKeptAssetMenuFailed(): boolean {
  const [failed, setFailed] = useState(slots.failed);

  useEffect(() => {
    const unsubscribe = slots.subscribe(() => setFailed(slots.failed()));
    setFailed(slots.failed());
    return unsubscribe;
  }, []);

  return failed;
}

const ReportFailure = () => {
  useEffect(() => slots.fail(), []);
  return null;
};

/**
 * What the game's asset-menu slot draws: an empty element that the kept menu
 * moves into for as long as the slot exists.
 */
export const AssetMenuSlot = ({ onClose }: { onClose?: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);

  // A layout effect, so the menu is in the slot before the slot first paints.
  useLayoutEffect(() => {
    const element = ref.current;

    return element ? slots.open({ element, onClose }) : undefined;
  }, [onClose]);

  return <div ref={ref} className={styles.slot} />;
};

/**
 * The build menu, built on its first open and kept built after that.
 *
 * The game unmounts its asset-menu slot whenever a menu closes, and every open
 * then rebuilt the whole panel — header, strip, pane, filters and catalog — and
 * resubscribed every binding: about 80 ms before any card was drawn. Appended to
 * Game, this outlives the slot. The menu renders into one element of its own,
 * which is moved into the slot while there is one and is out of the document
 * while there is none.
 */
export const KeptAssetMenu = () => {
  const [slot, setSlot] = useState<Slot<HTMLElement> | null>(slots.current);
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.className = styles.slot;
    return element;
  });
  // Nothing is built until the first open: a city where the menu is never
  // opened pays nothing for it.
  const built = useRef(false);
  built.current ||= slot !== null;
  // The last close the game gave us, for the renders while hidden.
  const lastClose = useRef<(() => void) | undefined>(undefined);
  if (slot) lastClose.current = slot.onClose;

  // Also read the store once mounted: a slot opened before this subscribed
  // would otherwise be missed.
  useEffect(() => {
    const unsubscribe = slots.subscribe(setSlot);
    setSlot(slots.current());
    return unsubscribe;
  }, []);

  useLayoutEffect(() => {
    if (!slot) {
      return;
    }

    slot.element.appendChild(container);

    return () => {
      container.parentNode?.removeChild(container);
    };
  }, [slot, container]);

  if (!built.current) {
    return null;
  }

  return createPortal(
    <ExtensionBoundary name="AssetMenu" fallback={() => <ReportFailure />}>
      <AssetMenuShownContext.Provider value={slot !== null}>
        <AssetMenu onClose={slot?.onClose ?? lastClose.current} />
      </AssetMenuShownContext.Provider>
    </ExtensionBoundary>,
    container
  );
};
