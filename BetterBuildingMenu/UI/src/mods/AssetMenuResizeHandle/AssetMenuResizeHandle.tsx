import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import {
  ASSET_MENU_RESIZE_HANDLE_HEIGHT,
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
  isPrimaryPress,
  pxPerRemFrom,
} from "domain/assetMenuLayout";

import styles from "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
import { AssetMenuHeight$, send } from "mods/bindings";

export interface AssetMenuHeight {
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
export function useAssetMenuHeight(): AssetMenuHeight {
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef<{ active: boolean; startY: number; startHeight: number; pxPerRem?: number }>({
    active: false,
    startY: 0,
    startHeight: 0,
  });

  // The height the pointer last asked for, sent once per frame: the mouse can
  // report several moves a frame, and each echo re-renders the asset menu.
  const pending = useRef<{ frame: number; height: number | null }>({ frame: 0, height: null });

  const height = clampAssetMenuHeight(useValue(AssetMenuHeight$));

  function flushHeight(): void {
    const next = pending.current.height;
    pending.current = { frame: 0, height: null };

    if (next !== null) {
      send({ method: "SetAssetMenuHeight", args: [next] });
    }
  }

  // The asset menu going away mid-drag (closed by a key or by the game) ends the
  // drag as a release does. Left unsaved, the dragged height would sit in the
  // binding until the next save of any setting re-pushed the saved one.
  useEffect(() => () => {
    cancelAnimationFrame(pending.current.frame);
    if (!resizeState.current.active) return;

    resizeState.current.active = false;
    const next = pending.current.height;
    pending.current = { frame: 0, height: null };
    if (next !== null) {
      send({ method: "SetAssetMenuHeight", args: [next] });
    }
    send({ method: "CommitAssetMenuHeight", args: [] });
  }, []);

  function beginResize(event: any): void {
    if (!isPrimaryPress(event)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the strip just pressed: drawn, and a known rem tall.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().height, ASSET_MENU_RESIZE_HANDLE_HEIGHT);
    resizeState.current = { active: true, startY: event.clientY, startHeight: height, pxPerRem };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = resizeState.current;
    if (!state.active) return;
    // A release the blocker never saw, such as one outside the window.
    if (event.buttons === 0) {
      endResize();
      return;
    }

    pending.current.height = draggedAssetMenuHeight(state.startHeight, state.startY, event.clientY, state.pxPerRem);

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
    send({ method: "CommitAssetMenuHeight", args: [] });
  }

  const blocker = isResizing
    ? <div className={styles.resizeBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  return { height, isResizing, beginResize, blocker };
}

export interface AssetMenuResizeHandleProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/** The strip on a panel's top edge that starts the drag. First child of the panel, never an overlay. */
export const AssetMenuResizeHandle = ({ active, onBeginResize }: AssetMenuResizeHandleProps) => {
  const { translate } = useLocalization();

  return (
    <div
      className={classNames(styles.resizeHandle, active && styles.resizeHandleActive)}
      onMouseDown={onBeginResize}
      title={translate("Tooltip.LABEL[BetterBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize"}
    >
      <div className={classNames(styles.resizeGrip, active && styles.resizeGripActive)} />
    </div>
  );
};
