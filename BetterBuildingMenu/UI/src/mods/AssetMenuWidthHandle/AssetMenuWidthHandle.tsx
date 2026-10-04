import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import {
  ASSET_MENU_WIDTH_HANDLE_WIDTH,
  draggedCatalogWidth,
  filledCatalogWidth,
  isPrimaryPress,
  pxPerRemFrom,
  releasedCatalogWidth,
} from "domain/assetMenuLayout";
import { send } from "mods/bindings";
import styles from "mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss";

/**
 * How soon a second press must follow the first to fill the room again. Counted
 * here, not left to a dblclick listener: the first press puts the blocker up, so
 * its release lands there and the strip never sees a whole click.
 */
export const DOUBLE_PRESS_MS = 400;

/**
 * How far the pointer must travel, in pixels, before a press becomes a drag. A
 * hand wobbles a pixel or two inside a click, and that must stay a click: one
 * counted as a drag would save a width the player never chose and break the
 * double press that follows.
 */
export const DRAG_THRESHOLD_PX = 3;

export interface AssetMenuWidthDrag {
  isResizing: boolean;
  /** Starts a drag from a press on an element `widthRem` wide, which the press measures rem against. */
  beginResize: (event: any, widthRem?: number) => void;
  /**
   * Covers the screen for the length of a drag so the menu keeps the mouse
   * when it leaves the strip. Null between drags; render it beside the menu.
   */
  blocker: JSX.Element | null;
  /** Whether the mouse is on the strip or its reach: the two answer as one handle. */
  isHovered: boolean;
  /** Spread on the strip and its reach so either lights both. */
  hoverProps: AssetMenuWidthHoverProps;
}

export interface AssetMenuWidthHoverProps {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** What a width drag works from: the width drawn now, and what bounds it. */
export interface AssetMenuWidthBounds {
  menuWidth: number;
  bandWidth: number;
  paneShown: boolean;
}

/**
 * The build menu's width drag, run as the height's is: one width a frame through
 * the live binding, and only the release writes the settings file.
 */
export function useAssetMenuWidthDrag(
  { menuWidth, bandWidth, paneShown }: AssetMenuWidthBounds,
  now: () => number = Date.now
): AssetMenuWidthDrag {
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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

  // What a release measures against, read when the asset menu goes away, after
  // the render that last set it.
  const room = useRef({ bandWidth, paneShown });
  room.current = { bandWidth, paneShown };

  // The asset menu going away mid-drag (closed by a key or by the game) ends the
  // drag as a release does. Left unsaved, the dragged width would sit in the
  // binding until the next save of any setting re-pushed the saved one.
  useEffect(() => () => {
    cancelAnimationFrame(pending.current.frame);
    const state = drag.current;
    if (!state.active) return;

    state.active = false;
    pending.current = { frame: 0, width: null };
    if (!state.moved) return;

    send({ method: "SetAssetMenuCatalogWidth", args: [releasedCatalogWidth(state.last, room.current.bandWidth, room.current.paneShown)] });
    send({ method: "CommitAssetMenuCatalogWidth", args: [] });
  }, []);

  function fill(): void {
    send({ method: "SetAssetMenuCatalogWidth", args: [filledCatalogWidth(paneShown)] });
    send({ method: "CommitAssetMenuCatalogWidth", args: [] });
  }

  function beginResize(event: any, widthRem: number = ASSET_MENU_WIDTH_HANDLE_WIDTH): void {
    if (!isPrimaryPress(event)) return;
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
    // measured off the element just pressed: drawn, and a known rem wide.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().width, widthRem);
    drag.current = { active: true, moved: false, startX: event.clientX, startWidth: menuWidth, last: menuWidth, pxPerRem };
    setIsResizing(true);
  }

  function moveResize(event: any): void {
    const state = drag.current;
    if (!state.active) return;
    // A release the blocker never saw, such as one outside the window.
    if (event.buttons === 0) {
      endResize();
      return;
    }
    if (!state.moved && Math.abs(event.clientX - state.startX) < DRAG_THRESHOLD_PX) return;

    // Moved, once past the threshold, even when the edge is pinned at a bound:
    // the player dragged, so the release is no half of a double press.
    state.moved = true;
    state.last = draggedCatalogWidth(state.startWidth, state.startX, event.clientX, bandWidth, paneShown, state.pxPerRem);
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

    // A press that never passed the threshold is a click, and a click on the
    // strip changes nothing: it must not turn a chosen width into fill. A drag is
    // no first half of a double press.
    if (!state.moved) return;
    lastPress.current = 0;

    send({ method: "SetAssetMenuCatalogWidth", args: [releasedCatalogWidth(state.last, bandWidth, paneShown)] });
    send({ method: "CommitAssetMenuCatalogWidth", args: [] });
  }

  const blocker = isResizing
    ? <div className={styles.widthBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  const hoverProps: AssetMenuWidthHoverProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  return { isResizing, beginResize, blocker, isHovered, hoverProps };
}

/** The strip's hint, the one place the double press is told. */
function useWidthHint(): string {
  const { translate } = useLocalization();
  const fallback = "Drag to resize, double-click to fill the space";
  return translate("Tooltip.LABEL[BetterBuildingMenu.ResizeWidth]", fallback) ?? fallback;
}

export interface AssetMenuWidthHandleProps {
  active: boolean;
  hovered?: boolean;
  hoverProps?: AssetMenuWidthHoverProps;
  onBeginResize: (event: any) => void;
}

/**
 * The strip on the build menu's right edge: drag for the width, press twice to
 * fill the room again. Its hint is the game's Tooltip: the game draws no title
 * attribute.
 */
export const AssetMenuWidthHandle = ({ active, hovered = false, hoverProps, onBeginResize }: AssetMenuWidthHandleProps) => (
  <Tooltip tooltip={useWidthHint()}>
    <div
      className={classNames(styles.widthHandle, hovered && styles.widthHandleHovered, active && styles.widthHandleActive)}
      onMouseDown={onBeginResize}
      {...hoverProps}
    >
      <div className={classNames(styles.widthGrip, hovered && styles.widthGripHovered, active && styles.widthGripActive)} />
    </div>
  </Tooltip>
);

/**
 * The strip's grab area past the menu's edge, across the gap beside the pane, for
 * the menu's full height. Separate from the strip because the catalog's box clips
 * what the strip draws; it lights and hints as the strip does.
 */
export const AssetMenuWidthReach = ({ active, hovered = false, hoverProps, onBeginResize }: AssetMenuWidthHandleProps) => (
  <Tooltip tooltip={useWidthHint()}>
    <div
      className={classNames(styles.widthReach, hovered && styles.widthReachHovered, active && styles.widthReachActive)}
      onMouseDown={onBeginResize}
      {...hoverProps}
    />
  </Tooltip>
);
