import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useRef, useState } from "react";

import mod from "../../../mod.json";
import { clampBuildingLensHeight, draggedBuildingLensHeight } from "domain/buildingLensLayout";

import styles from "mods/LensResizeHandle/lensResizeHandle.module.scss";

/** The panel height the player last dragged to; see BuildingMenuUISystem.Bindings. */
const BuildingLensPanelHeight$ = bindValue<number>(mod.id, "BuildingLensPanelHeight", 420);

export interface LensPanelHeight {
  /** In rem, already clamped to the range the layout can hold. */
  height: number;
  isResizing: boolean;
  beginResize: (event: any) => void;
  /**
   * Covers the screen for the length of a drag so the panel keeps the mouse
   * when it leaves the strip. Null between drags; render it beside the panel.
   */
  blocker: JSX.Element | null;
}

/**
 * Pixels per rem as the game is laying them out now, from a hidden 100rem probe.
 * Rem follows the resolution (and anything else the game scales the UI by), and
 * the pointer reports pixels. Null when the measurement is unusable.
 */
function measurePxPerRem(): number | null {
  if (typeof document === "undefined" || !document.body) return null;

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.width = "0";
  probe.style.height = "100rem";
  document.body.appendChild(probe);
  const pxPerRem = probe.getBoundingClientRect().height / 100;
  document.body.removeChild(probe);

  return Number.isFinite(pxPerRem) && pxPerRem > 0 ? pxPerRem : null;
}

/**
 * One height for both panels. The drag runs through the live binding and only
 * the release writes the settings file; the game owns the number, so the
 * build menu and the extension picker cannot disagree about it.
 */
export function useLensPanelHeight(): LensPanelHeight {
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef<{ active: boolean; startY: number; startHeight: number; pxPerRem?: number }>({
    active: false,
    startY: 0,
    startHeight: 0,
  });

  const height = clampBuildingLensHeight(useValue(BuildingLensPanelHeight$));

  function beginResize(event: any): void {
    event.preventDefault?.();
    event.stopPropagation?.();
    resizeState.current = { active: true, startY: event.clientY, startHeight: height, pxPerRem: measurePxPerRem() ?? undefined };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;

    trigger(mod.id, "SetBuildingLensPanelHeight", draggedBuildingLensHeight(state.startHeight, state.startY, event.clientY, state.pxPerRem));
  }

  function endResize(): void {
    if (!resizeState.current.active) return;

    resizeState.current.active = false;
    setIsResizing(false);
    trigger(mod.id, "CommitBuildingLensPanelHeight");
  }

  const blocker = isResizing
    ? <div className={styles.resizeBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  return { height, isResizing, beginResize, blocker };
}

export interface LensResizeHandleProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/** The strip on a panel's top edge that starts the drag. First child of the panel, never an overlay. */
export const LensResizeHandle = ({ active, onBeginResize }: LensResizeHandleProps) => {
  const { translate } = useLocalization();

  return (
    <div
      className={styles.resizeHandle}
      onMouseDown={onBeginResize}
      title={translate("Tooltip.LABEL[BetterBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize"}
    >
      <div className={classNames(styles.resizeGrip, active && styles.resizeGripActive)} />
    </div>
  );
};
