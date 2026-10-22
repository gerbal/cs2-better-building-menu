import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AssetMenu } from "mods/BuildingMenu/AssetMenu";
import { AssetMenuShownContext } from "mods/BuildingMenu/assetMenuShown";
import { BuildingCatalog$ } from "mods/bindings";
import { ExtensionBoundary } from "mods/ExtensionBoundary";
import { createAssetMenuSlotStore, type AssetMenuSlot as Slot } from "domain/assetMenuSlot";
import { answersOpen, shownMenu } from "domain/keptMenus";
import { createPanelFreeze, PanelFreezeContext, setPanelFrozen, type PanelFreeze } from "mods/panelValue";
import { currentViewShape } from "mods/viewShape";

import styles from "mods/BuildingMenu/assetMenu.module.scss";

const slots = createAssetMenuSlotStore<HTMLElement>();

/**
 * How long a slot waits for C#'s answer to the open before the menu joins it
 * anyway. The answer comes a frame later, a few frames on a slow one; this is
 * only a safety net, so a page that never comes cannot leave the slot empty.
 */
const JOIN_WAIT_MS = 1000;

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
export const AssetMenuSlot = ({ onClose, menu = null }: { onClose?: () => void; menu?: string | null }) => {
  const ref = useRef<HTMLDivElement>(null);

  // A layout effect, so the menu is in the slot before the slot first paints.
  useLayoutEffect(() => {
    const element = ref.current;

    return element ? slots.open({ element, onClose, menu }) : undefined;
  }, [onClose, menu]);

  return <div ref={ref} className={styles.slot} />;
};

/** A built menu: its readers' freeze, and what it last drew live. */
interface KeptPanel {
  freeze: PanelFreeze;
  /** The menu of its page; "" for a narrower query. */
  pageMenu: string;
  /** Its catalog's view and grouping (catalogShape). */
  shape: string;
}

/**
 * What a catalog is drawn as: the view and the grouping, read as the catalog
 * reads them. A panel frozen in another shape would rebuild its catalog on screen.
 */
const catalogShape = (): string => {
  const { viewMode, groupBy } = currentViewShape();
  return `${viewMode}/${groupBy}`;
};

const menuOf = (slot: Slot<HTMLElement> | null): string | null => (slot ? slot.menu ?? "" : null);

/**
 * Every build menu, each built on its first open and kept built after that.
 *
 * The game unmounts its asset-menu slot whenever a menu closes, and every open
 * then rebuilt the whole panel — header, strip, pane, filters and catalog — and
 * resubscribed every binding: about 80 ms before any card was drawn. Appended to
 * Game, this outlives the slot. Each toolbar menu has a panel of its own, rendered
 * into an element that is moved into the slot while it is the one shown and is out
 * of the document otherwise, so switching menus shows a built panel as a reopen
 * does.
 *
 * Every panel freezes when a menu opens or closes, before any update for the new
 * menu can arrive (mods/panelValue): a hidden panel keeps the page it last drew and
 * does no work. The opened menu's panel thaws when C# answers the open. Which one
 * the slot shows meanwhile is domain/keptMenus, shownMenu: the opened menu's own
 * when its last page was that menu's opening view, drawn in the current view and
 * grouping; the one already up through a switch with the menu up; or none; never
 * another menu's under this menu's button.
 * A menu's panel is built the first time C# answers an open of it, since until
 * then the bindings hold another menu's page.
 */
export const KeptAssetMenu = () => {
  const [slot, setSlot] = useState<Slot<HTMLElement> | null>(slots.current);
  // The slot C# has answered since it opened (a page arrived, or the wait ran out).
  const [answered, setAnswered] = useState<Slot<HTMLElement> | null>(null);
  const panels = useRef(new Map<string, KeptPanel>());
  // Nothing is built until a menu's first open: a city where the menu is never
  // opened pays nothing for it.
  const built = useRef<string[]>([]);
  const currentSlot = useRef(slot);
  currentSlot.current = slot;
  // The last close the game gave us, for the renders while hidden.
  const lastClose = useRef<(() => void) | undefined>(undefined);
  if (slot) lastClose.current = slot.onClose;
  // The panel in the slot after the last commit, and the one a switch with the
  // menu up keeps there until the opened menu's can show.
  const shownNow = useRef<string | null>(null);
  const held = useRef<string | null>(null);

  // Also read the store once mounted: a slot opened before this subscribed
  // would otherwise be missed.
  useEffect(() => {
    // A shown panel's slot replaced in one commit is the player switching menus with
    // the menu up: the game swaps the slot (or ours re-opens for the new menu).
    let swapping = false;
    let from: string | null = null;
    const unsubscribe = slots.subscribe((next) => {
      const shape = catalogShape();

      for (const panel of panels.current.values()) {
        // A live panel was drawn as the catalog is now.
        if (!panel.freeze.frozen) {
          panel.shape = shape;
        }

        setPanelFrozen(panel.freeze, true);
      }

      if (next === null) {
        swapping = shownNow.current !== null;
        from = shownNow.current;
        void Promise.resolve().then(() => {
          swapping = false;
        });
      }

      held.current = next !== null && swapping ? from : null;
      // Now, not at the next render: C#'s answer can arrive in between, and belongs
      // to this slot, not the one before.
      currentSlot.current = next;
      setSlot(next);
    });
    setSlot(slots.current());
    return unsubscribe;
  }, []);

  // C#'s answer to an open: the opened menu's panel follows the bindings again.
  useEffect(() => {
    const subscription = BuildingCatalog$.subscribe((page) => {
      const open = currentSlot.current;
      const opened = menuOf(open);
      const pageMenu = page?.menu ?? "";

      if (!open || opened === null || !answersOpen(pageMenu, opened)) {
        return;
      }

      const panel = panels.current.get(opened);

      if (panel) {
        panel.pageMenu = pageMenu;
        setPanelFrozen(panel.freeze, false);
      }

      setAnswered(open);
    });
    return () => subscription.dispose();
  }, []);

  useEffect(() => {
    if (!slot) {
      return;
    }

    const timer = setTimeout(() => {
      const panel = panels.current.get(menuOf(slot) ?? "");

      if (panel) {
        setPanelFrozen(panel.freeze, false);
      }

      setAnswered(slot);
    }, JOIN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [slot]);

  const opened = menuOf(slot);
  const isAnswered = slot !== null && answered === slot;

  if (opened !== null && isAnswered && !panels.current.has(opened)) {
    panels.current.set(opened, { freeze: createPanelFreeze(false), pageMenu: BuildingCatalog$.value?.menu ?? "", shape: catalogShape() });
    built.current = [...built.current, opened];
  }

  const shape = catalogShape();
  const shown = shownMenu({
    opened,
    answered: isAnswered,
    built: new Map([...panels.current].map(([menu, panel]) => [menu, panel.pageMenu])),
    stale: new Set([...panels.current].filter(([, panel]) => panel.freeze.frozen && panel.shape !== shape).map(([menu]) => menu)),
    held: held.current,
  });

  useLayoutEffect(() => {
    shownNow.current = shown;

    if (shown === opened) {
      held.current = null;
    }
  });

  // One close for every panel, so a hidden panel's props hold still across opens.
  const close = useCallback(() => (currentSlot.current?.onClose ?? lastClose.current)?.(), []);

  return (
    <>
      {built.current.map((menu) => (
        <MenuPanel
          key={menu}
          freeze={panels.current.get(menu)!.freeze}
          target={menu === shown && slot ? slot.element : null}
          onClose={close}
        />
      ))}
    </>
  );
};

/** One menu's panel, in the slot while `target` is set and out of the document otherwise. */
const MenuPanel = memo(function MenuPanel({ freeze, target, onClose }: {
  freeze: PanelFreeze;
  target: HTMLElement | null;
  onClose: () => void;
}) {
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.className = styles.slot;
    return element;
  });

  // A layout effect, so the panel is in the slot before the slot first paints.
  useLayoutEffect(() => {
    if (!target) {
      return;
    }

    target.appendChild(container);

    return () => {
      container.parentNode?.removeChild(container);
    };
  }, [target, container]);

  return createPortal(
    <ExtensionBoundary name="AssetMenu" fallback={() => <ReportFailure />}>
      <PanelFreezeContext.Provider value={freeze}>
        <AssetMenuShownContext.Provider value={target !== null}>
          <AssetMenu onClose={onClose} />
        </AssetMenuShownContext.Provider>
      </PanelFreezeContext.Provider>
    </ExtensionBoundary>,
    container
  );
});
