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
 * One height for both panels. The drag runs through the live binding and only
 * the release writes the settings file; the game owns the number, so the
 * build menu and the extension picker cannot disagree about it.
 */
export function useLensPanelHeight(): LensPanelHeight {
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef({ active: false, startY: 0, startHeight: 0 });

  const height = clampBuildingLensHeight(useValue(BuildingLensPanelHeight$));

  function beginResize(event: any): void {
    event.preventDefault?.();
    event.stopPropagation?.();
    resizeState.current = { active: true, startY: event.clientY, startHeight: height };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;

    trigger(mod.id, "SetBuildingLensPanelHeight", draggedBuildingLensHeight(state.startHeight, state.startY, event.clientY));
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
