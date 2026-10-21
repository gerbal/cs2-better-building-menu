import { useValue } from "mods/panelValue";
import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useRef } from "react";

import {
  ASSET_MENU_RESIZE_HANDLE_HEIGHT,
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
  isPrimaryPress,
  pxPerRemFrom,
} from "domain/assetMenuLayout";
import { commitAssetMenuHeightCommand, setAssetMenuHeightCommand } from "domain/commands";

import styles from "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
import { AssetMenuHeight$, send } from "mods/bindings";
import { useRafDrag } from "mods/useRafDrag";

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
 * build menu and the extension picker cannot disagree about it. `shown` false
 * ends a drag, as unmounting does.
 */
export function useAssetMenuHeight(shown = true): AssetMenuHeight {
  const gesture = useRef<{ startY: number; startHeight: number; pxPerRem?: number }>({ startY: 0, startHeight: 0 });

  const height = clampAssetMenuHeight(useValue(AssetMenuHeight$));

  const drag = useRafDrag({
    move: (event) => {
      const state = gesture.current;
      return draggedAssetMenuHeight(state.startHeight, state.startY, event.clientY, state.pxPerRem);
    },
    sendFrame: (next) => send(setAssetMenuHeightCommand(next)),
    // The last position first, so the commit saves where the drag ended.
    finish: (queued) => {
      if (queued !== null) {
        send(setAssetMenuHeightCommand(queued));
      }
      send(commitAssetMenuHeightCommand());
    },
    blockerClassName: styles.resizeBlocker,
  }, shown);

  function beginResize(event: any): void {
    if (!isPrimaryPress(event)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the strip just pressed: drawn, and a known rem tall.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().height, ASSET_MENU_RESIZE_HANDLE_HEIGHT);
    gesture.current = { startY: event.clientY, startHeight: height, pxPerRem };
    drag.start();
  }

  return { height, isResizing: drag.isResizing, beginResize, blocker: drag.blocker };
}

export interface AssetMenuResizeHandleProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/**
 * The strip on a panel's top edge that starts the drag. First child of the panel, never an overlay.
 * Its hint is the game's Tooltip: the game draws no title attribute.
 */
export const AssetMenuResizeHandle = ({ active, onBeginResize }: AssetMenuResizeHandleProps) => {
  const { translate } = useLocalization();
  const hint = translate("Tooltip.LABEL[BetterBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize";

  return (
    <Tooltip tooltip={hint}>
      <div className={classNames(styles.resizeHandle, active && styles.resizeHandleActive)} onMouseDown={onBeginResize}>
        <div className={classNames(styles.resizeGrip, active && styles.resizeGripActive)} />
      </div>
    </Tooltip>
  );
};
