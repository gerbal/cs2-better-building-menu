import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import {
  ASSET_MENU_CATALOG_FILL,
  ASSET_MENU_WIDTH_HANDLE_WIDTH,
  draggedCatalogWidth,
  pxPerRemFrom,
  releasedCatalogWidth,
} from "domain/assetMenuLayout";
import { send } from "mods/bindings";
import styles from "mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss";

/**
 * How soon a second press must follow the first to fill the room again. Counted
 * here, not left to a dblclick listener: a press that starts a drag covers the
 * screen with the blocker, so the second click never reaches the strip.
 */
export const DOUBLE_PRESS_MS = 400;

export interface AssetMenuWidthDrag {
  isResizing: boolean;
  beginResize: (event: any) => void;
  /**
   * Covers the screen for the length of a drag so the menu keeps the mouse
   * when it leaves the strip. Null between drags; render it beside the menu.
   */
  blocker: JSX.Element | null;
}

/**
 * The build menu's width drag, run as the height's is: one width a frame through
 * the live binding, and only the release writes the settings file. `menuWidth` is
 * the width drawn now; the band and the pane bound the drag.
 */
export function useAssetMenuWidthDrag(
  menuWidth: number,
  bandWidth: number,
  paneShown: boolean,
  now: () => number = Date.now
): AssetMenuWidthDrag {
  const [isResizing, setIsResizing] = useState(false);
  const drag = useRef<{ active: boolean; moved: boolean; startX: number; startWidth: number; last: number; pxPerRem?: number }>({
    active: false,
    moved: false,
    startX: 0,
    startWidth: 0,
    last: 0,
  });
  const lastPress = useRef(0);
  // The width the pointer last asked for, sent once per frame: the mouse can
  // report several moves a frame, and each echo re-renders the asset menu.
  const pending = useRef<{ frame: number; width: number | null }>({ frame: 0, width: null });

  function flushWidth(): void {
    const next = pending.current.width;
    pending.current = { frame: 0, width: null };

    if (next !== null) {
      send({ method: "SetAssetMenuCatalogWidth", args: [next] });
    }
  }

  useEffect(() => () => cancelAnimationFrame(pending.current.frame), []);

  function fill(): void {
    send({ method: "SetAssetMenuCatalogWidth", args: [ASSET_MENU_CATALOG_FILL] });
    send({ method: "CommitAssetMenuCatalogWidth", args: [] });
  }

  function beginResize(event: any): void {
    event.preventDefault?.();
    event.stopPropagation?.();

    const pressedAt = now();
    if (lastPress.current > 0 && pressedAt - lastPress.current < DOUBLE_PRESS_MS) {
      lastPress.current = 0;
      fill();
      return;
    }
    lastPress.current = pressedAt;

    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the strip just pressed: drawn, and a known rem wide.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().width, ASSET_MENU_WIDTH_HANDLE_WIDTH);
    drag.current = { active: true, moved: false, startX: event.clientX, startWidth: menuWidth, last: menuWidth, pxPerRem };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = drag.current;
    if (!state.active) return;

    state.last = draggedCatalogWidth(state.startWidth, state.startX, event.clientX, bandWidth, paneShown, state.pxPerRem);
    state.moved = state.moved || state.last !== state.startWidth;
    pending.current.width = state.last;

    if (pending.current.frame === 0) {
      pending.current.frame = requestAnimationFrame(flushWidth);
    }
  }

  function endResize(): void {
    const state = drag.current;
    if (!state.active) return;

    cancelAnimationFrame(pending.current.frame);
    pending.current = { frame: 0, width: null };
    state.active = false;
    setIsResizing(false);

    // A press that never moved the edge is a click, and a click on the strip
    // changes nothing: it must not turn a chosen width into fill. A drag that did
    // move is no first half of a double press.
    if (!state.moved) return;
    lastPress.current = 0;

    send({ method: "SetAssetMenuCatalogWidth", args: [releasedCatalogWidth(state.last, bandWidth, paneShown)] });
    send({ method: "CommitAssetMenuCatalogWidth", args: [] });
  }

  const blocker = isResizing
    ? <div className={styles.widthBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  return { isResizing, beginResize, blocker };
}

export interface AssetMenuWidthHandleProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/** The strip on the build menu's right edge: drag for the width, press twice to fill the room again. */
export const AssetMenuWidthHandle = ({ active, onBeginResize }: AssetMenuWidthHandleProps) => {
  const { translate } = useLocalization();
  const fallback = "Drag to resize, double-click to fill the space";

  return (
    <div
      className={styles.widthHandle}
      onMouseDown={onBeginResize}
      title={translate("Tooltip.LABEL[BetterBuildingMenu.ResizeWidth]", fallback) ?? fallback}
    >
      <div className={classNames(styles.widthGrip, active && styles.widthGripActive)} />
    </div>
  );
};
