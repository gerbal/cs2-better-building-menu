import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import {
  ASSET_MENU_RESIZE_HANDLE_HEIGHT,
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
  isPrimaryPress,
  pxPerRemFrom,
} from "domain/assetMenuLayout";
import { DRAG_THRESHOLD_PX } from "domain/boxEdges";

import styles from "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
import { AssetMenuHeight$, send } from "mods/bindings";

export interface AssetMenuHeight {
  /** In rem, already clamped to the range the layout can hold. */
  height: number;
  isResizing: boolean;
  /** Starts a drag from a press on an element `heightRem` tall, which the press measures rem against. */
  beginResize: (event: any, heightRem?: number) => void;
  /**
   * Covers the screen for the length of a drag so the panel keeps the mouse
   * when it leaves the strip. Null between drags; render it beside the panel.
   */
  blocker: JSX.Element | null;
  /** Under the build menu's rules, the height a drag that has moved asks for, held to the drag's range; null otherwise. */
  dragged: number | null;
  /**
   * Under the build menu's rules, the height the body draws at: where the release lands, from the drag's first move
   * until the stored height answers the release; null otherwise, when the body draws the stored height.
   */
  held: number | null;
}

/** How near the stored height must come to a release's, which C# keeps as a float, to answer it. */
const ANSWERED = 0.01;

/**
 * What only the build menu's top edge does with a drag; the upgrades panel's keeps a plain clamp and commit. A press
 * becomes a drag only once the pointer has moved, so a click sends nothing. See docs/design-notes.md, "The top edge".
 */
export interface TopEdgeRules {
  /** Where a release lands, from the height the pointer asks for: whole lines of the open body, or under Top edge's Free that height. */
  snap: (height: number) => number;
}

const asStored = (height: number): number => height;

/**
 * One height for both panels. The drag runs through the live binding and only
 * the release writes the settings file; the game owns the number, so the
 * build menu and the extension picker cannot disagree about it. `drawnAt` is the
 * height a panel draws a stored height at: a drag starts there and stops at its
 * ceiling, so the edge moves at once from where it is drawn.
 */
export function useAssetMenuHeight(drawnAt: (height: number) => number = asStored, rules: TopEdgeRules | null = null): AssetMenuHeight {
  const [isResizing, setIsResizing] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  // Where the last release landed, until the stored height answers it.
  const [landing, setLanding] = useState<number | null>(null);
  const resizeState = useRef<{ active: boolean; moved: boolean; startY: number; startHeight: number; pxPerRem?: number }>({
    active: false,
    moved: false,
    startY: 0,
    startHeight: 0,
  });
  // Read when the menu goes away mid-drag, after the render that last passed them.
  const edge = useRef(rules);
  edge.current = rules;

  // The height the pointer last asked for, sent once per frame: the mouse can
  // report several moves a frame, and each echo re-renders the asset menu.
  const pending = useRef<{ frame: number; height: number | null }>({ frame: 0, height: null });
  // The height the pointer last asked for, sent or not, which a release under the build menu's rules lands from.
  const dragging = useRef<number | null>(null);

  const height = clampAssetMenuHeight(useValue(AssetMenuHeight$));

  function flushHeight(): void {
    const next = pending.current.height;
    pending.current = { frame: 0, height: null };

    if (next !== null) {
      send({ method: "SetAssetMenuHeight", args: [next] });
      if (edge.current !== null) setDragged(next);
    }
  }

  /**
   * Where a drag ends, as its release, or the menu going away, ends it. Under the build menu's rules a press that
   * never moved sends nothing, and one that did lands on whole lines, the height it returns; the plain drag sends
   * where it ended.
   */
  function settle(): number | null {
    const state = resizeState.current;
    const last = pending.current.height;
    pending.current = { frame: 0, height: null };
    const rulesNow = edge.current;

    if (rulesNow === null) {
      if (last !== null) send({ method: "SetAssetMenuHeight", args: [last] });
      send({ method: "CommitAssetMenuHeight", args: [] });
      return null;
    }

    const asked = dragging.current;
    if (!state.moved || asked === null) return null;

    const landed = rulesNow.snap(asked);
    send({ method: "SetAssetMenuHeight", args: [landed] });
    send({ method: "CommitAssetMenuHeight", args: [] });
    return landed;
  }

  useEffect(() => {
    if (landing !== null && Math.abs(height - landing) < ANSWERED) setLanding(null);
  }, [height, landing]);

  // The asset menu going away mid-drag (closed by a key or by the game) ends the
  // drag as a release does. Left unsaved, the dragged height would sit in the
  // binding until the next save of any setting re-pushed the saved one.
  useEffect(() => () => {
    cancelAnimationFrame(pending.current.frame);
    if (!resizeState.current.active) return;

    resizeState.current.active = false;
    settle();
  }, []);

  function beginResize(event: any, heightRem: number = ASSET_MENU_RESIZE_HANDLE_HEIGHT): void {
    if (!isPrimaryPress(event)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the strip just pressed: drawn, and a known rem tall.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().height, heightRem);
    resizeState.current = { active: true, moved: false, startY: event.clientY, startHeight: drawnAt(height), pxPerRem };
    dragging.current = null;
    setLanding(null);
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
    // Under the build menu's rules, a hand's wobble inside a click moves nothing.
    if (edge.current !== null && !state.moved && !(Math.abs(event.clientY - state.startY) >= DRAG_THRESHOLD_PX)) return;

    state.moved = true;
    const asked = drawnAt(draggedAssetMenuHeight(state.startHeight, state.startY, event.clientY, state.pxPerRem));
    pending.current.height = asked;
    dragging.current = asked;

    if (pending.current.frame === 0) {
      pending.current.frame = requestAnimationFrame(flushHeight);
    }
  }

  function endResize(): void {
    if (!resizeState.current.active) return;

    // The last position first, so the commit saves where the drag ended.
    cancelAnimationFrame(pending.current.frame);
    resizeState.current.active = false;
    setIsResizing(false);
    setDragged(null);
    setLanding(settle());
  }

  const blocker = isResizing
    ? <div className={styles.resizeBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  // The body draws where the release lands, so between the lines it lands on it has nothing new to draw.
  const held = dragged !== null && rules !== null ? rules.snap(dragged) : landing;

  return { height, isResizing, beginResize, blocker, dragged, held };
}

export interface AssetMenuResizeHandleProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/** The height strips' hint, the build menu's top edge's and the upgrades panel's. */
export function useHeightHint(): string {
  const { translate } = useLocalization();
  return translate("Tooltip.LABEL[BetterBuildingMenu.ResizeHeight]", "Drag to resize") ?? "Drag to resize";
}

/**
 * The upgrades panel's top strip, its first row, that starts the drag. Its hint is the game's
 * Tooltip: the game draws no title attribute. The build menu's edge is TopEdge.
 */
export const AssetMenuResizeHandle = ({ active, onBeginResize }: AssetMenuResizeHandleProps) => (
  <Tooltip tooltip={useHeightHint()}>
    <div className={classNames(styles.resizeHandle, active && styles.resizeHandleActive)} onMouseDown={onBeginResize}>
      <div className={classNames(styles.resizeGrip, active && styles.resizeGripActive)} />
    </div>
  </Tooltip>
);
