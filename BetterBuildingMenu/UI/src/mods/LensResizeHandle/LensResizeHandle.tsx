import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import {
  LENS_RESIZE_HANDLE_HEIGHT,
  clampBuildingLensHeight,
  draggedBuildingLensHeight,
  pxPerRemFrom,
} from "domain/buildingLensLayout";

import styles from "mods/LensResizeHandle/lensResizeHandle.module.scss";
import { BuildingLensPanelHeight$, send } from "mods/bindings";

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
  const resizeState = useRef<{ active: boolean; startY: number; startHeight: number; pxPerRem?: number }>({
    active: false,
    startY: 0,
    startHeight: 0,
  });

  // The height the pointer last asked for, sent once per frame: the mouse can
  // report several moves a frame, and each echo re-renders the surface.
  const pending = useRef<{ frame: number; height: number | null }>({ frame: 0, height: null });

  const height = clampBuildingLensHeight(useValue(BuildingLensPanelHeight$));

  function flushHeight(): void {
    const next = pending.current.height;
    pending.current = { frame: 0, height: null };

    if (next !== null) {
      send({ method: "SetBuildingLensPanelHeight", args: [next] });
    }
  }

  useEffect(() => () => cancelAnimationFrame(pending.current.frame), []);

  function beginResize(event: any): void {
    event.preventDefault?.();
    event.stopPropagation?.();
    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the strip just pressed: drawn, and a known rem tall.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().height, LENS_RESIZE_HANDLE_HEIGHT);
    resizeState.current = { active: true, startY: event.clientY, startHeight: height, pxPerRem };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;

    pending.current.height = draggedBuildingLensHeight(state.startHeight, state.startY, event.clientY, state.pxPerRem);

    if (pending.current.frame === 0) {
      pending.current.frame = requestAnimationFrame(flushHeight);
    }
  }

  function endResize(): void {
    if (!resizeState.current.active) return;

    // The last position first, so the commit saves where the drag ended.
    cancelAnimationFrame(pending.current.frame);
    flushHeight();
    resizeState.current.active = false;
    setIsResizing(false);
    send({ method: "CommitBuildingLensPanelHeight", args: [] });
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
