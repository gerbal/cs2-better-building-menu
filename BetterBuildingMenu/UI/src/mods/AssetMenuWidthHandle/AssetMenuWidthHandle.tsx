import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import { ASSET_MENU_WIDTH_HANDLE_WIDTH, isPrimaryPress, pxPerRemFrom } from "domain/assetMenuLayout";
import { draggedStepWidth, nearestSnapStep, type WidthSnap } from "domain/widthSteps";
import { send } from "mods/bindings";
import styles from "mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss";

/**
 * How far the pointer must travel, in pixels, before a press becomes a drag. A
 * hand wobbles a pixel or two inside a click, and that must stay a click: one
 * counted as a drag would move the menu to a step the player never chose.
 */
export const DRAG_THRESHOLD_PX = 3;

export interface AssetMenuWidthDrag {
  isResizing: boolean;
  /**
   * The width the box draws at while a drag is on, and after its release until the
   * stored step comes back; null otherwise, when the box draws its step.
   */
  liveWidth: number | null;
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

/** What a width drag works from: the width drawn now, the step stored, and the steps the edge snaps to. */
export interface AssetMenuWidthBounds {
  menuWidth: number;
  step: number;
  snaps: readonly WidthSnap[];
}

/**
 * The right edge's drag: the box follows the pointer between the narrowest and the
 * widest step the edge snaps to, and the release sends the nearest step, once. See
 * docs/design-notes.md, "The box at its Width step, and the control pane".
 */
export function useAssetMenuWidthDrag({ menuWidth, step, snaps }: AssetMenuWidthBounds): AssetMenuWidthDrag {
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  // The snap a release sent, held until the stored step reaches it, so the box does
  // not flash the old step's width for the round trip through C#.
  const [settling, setSettling] = useState<WidthSnap | null>(null);
  const drag = useRef<{ active: boolean; moved: boolean; startX: number; startWidth: number; last: number; pxPerRem?: number }>({
    active: false,
    moved: false,
    startX: 0,
    startWidth: 0,
    last: 0,
  });
  // The width the pointer last asked for, drawn once per frame: the mouse can
  // report several moves a frame, and each would re-render the asset menu.
  const pending = useRef<{ frame: number; width: number | null }>({ frame: 0, width: null });

  const liveWidth = dragWidth ?? (settling !== null && settling.step !== step ? settling.width : null);

  function flushWidth(): void {
    const next = pending.current.width;
    pending.current = { frame: 0, width: null };

    if (next !== null) {
      setDragWidth(next);
    }
  }

  // What a release snaps among, read when the asset menu goes away, after the render
  // that last set it.
  const room = useRef(snaps);
  room.current = snaps;

  useEffect(() => {
    if (settling !== null && settling.step === step) {
      setSettling(null);
    }
  }, [settling, step]);

  // The asset menu going away mid-drag (closed by a key or by the game) ends the
  // drag as a release does, so the step the player dragged to is kept.
  useEffect(() => () => {
    cancelAnimationFrame(pending.current.frame);
    const state = drag.current;
    if (!state.active) return;

    state.active = false;
    pending.current = { frame: 0, width: null };
    if (!state.moved) return;

    send({ method: "SetAssetMenuWidthStep", args: [nearestSnapStep(state.last, room.current)] });
  }, []);

  function beginResize(event: any, widthRem: number = ASSET_MENU_WIDTH_HANDLE_WIDTH): void {
    if (!isPrimaryPress(event)) return;
    event.preventDefault?.();
    event.stopPropagation?.();

    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the element just pressed: drawn, and a known rem wide.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().width, widthRem);
    const from = liveWidth ?? menuWidth;
    drag.current = { active: true, moved: false, startX: event.clientX, startWidth: from, last: from, pxPerRem };
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

    state.moved = true;
    state.last = draggedStepWidth(state.startWidth, state.startX, event.clientX, snaps, state.pxPerRem);
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
    setDragWidth(null);

    // A press that never passed the threshold is a click, and a click on the strip
    // changes nothing.
    if (!state.moved) return;

    const next = nearestSnapStep(state.last, snaps);
    setSettling(snaps.find((snap) => snap.step === next) ?? null);
    send({ method: "SetAssetMenuWidthStep", args: [next] });
  }

  const blocker = isResizing
    ? <div className={styles.widthBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  const hoverProps: AssetMenuWidthHoverProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  return { isResizing, liveWidth, beginResize, blocker, isHovered, hoverProps };
}

/** The strip's hint, the one place the snapping is told. */
function useWidthHint(): string {
  const { translate } = useLocalization();
  const fallback = "Drag to resize; the edge snaps to the nearest set width";
  return translate("Tooltip.LABEL[BetterBuildingMenu.ResizeWidth]", fallback) ?? fallback;
}

export interface AssetMenuWidthHandleProps {
  active: boolean;
  hovered?: boolean;
  hoverProps?: AssetMenuWidthHoverProps;
  onBeginResize: (event: any) => void;
}

/**
 * The strip on the build menu's right edge: drag for the width, which snaps to the
 * steps. Its hint is the game's Tooltip: the game draws no title
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
 * The strip's grab area past the menu's edge, across the gap beside the pane, from
 * the header down to the menu's bottom. Separate from the strip because the catalog's box clips
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
