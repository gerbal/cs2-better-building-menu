import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import {
  ASSET_MENU_RESIZE_HANDLE_HEIGHT,
  clampAssetMenuHeight,
  dragDistanceRem,
  draggedAssetMenuHeight,
  isPrimaryPress,
  pxPerRemFrom,
} from "domain/assetMenuLayout";
import { collapses, commitHeightCommand, DRAG_THRESHOLD_PX, isDoublePress, restoreSizeCommand, setCollapsedCommand, type EdgePress } from "domain/boxEdges";

import styles from "mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss";
import { AssetMenuHeight$, send } from "mods/bindings";

export interface AssetMenuHeight {
  /** In rem, already clamped to the range the layout can hold. */
  height: number;
  /**
   * The height the box draws its body at, as a stored height: the stored one, but the drag's while a drag from a
   * collapsed box is past the floor, and where its release lands until the stored height answers it.
   */
  shownHeight: number;
  isResizing: boolean;
  /** Starts a drag from a press on an element `heightRem` tall, which the press measures rem against. */
  beginResize: (event: any, heightRem?: number) => void;
  /**
   * Covers the screen for the length of a drag so the panel keeps the mouse
   * when it leaves the strip. Null between drags; render it beside the panel.
   */
  blocker: JSX.Element | null;
  /**
   * Under the build menu's rules, the height a drag that has moved asks for, held to the drag's ceiling, and below
   * the body's floor where the pointer is; null otherwise.
   */
  dragged: number | null;
  /**
   * Under the build menu's rules, the height the body draws at: the whole lines the rules hold it at from the drag's
   * first move, then where the release lands until the stored height answers it; null otherwise, when the body draws
   * the stored height.
   */
  held: number | null;
  /**
   * Under the build menu's rules, whether the box draws collapsed to its top row and tabs: as the settings keep it,
   * until a drag from it passes the floor; open from a release that opens it, and collapsed from one that collapses
   * it, until C# answers.
   */
  collapsed: boolean;
}

/** How near the stored height must come to a release's, which C# keeps as a float, to answer it. */
const ANSWERED = 0.01;

/**
 * What only the build menu's top edge does with a drag; the upgrades panel's keeps a plain clamp and commit. A press
 * becomes a drag only once the pointer has moved, so a click sends nothing, and two clicks in place are a double
 * press. See docs/design-notes.md, "The top edge".
 */
export interface TopEdgeRules {
  /** Where a release lands, from the height the pointer asks for: whole lines of the open body, or under Top edge's Free that height. */
  snap: (height: number) => number;
  /**
   * Where the body draws while the edge moves, from the height the pointer asks for: whole lines, under either Top edge
   * value, so the body draws again only as its lines change.
   */
  hold: (height: number) => number;
  /** Whether a release below the body's floor collapses the box: under Whole lines; under Top edge's Free the floor holds. */
  collapsible: boolean;
  /** Whether the box is collapsed: a drag from it starts at a body of nothing, so it opens only past the floor. */
  collapsed: boolean;
}

const asStored = (height: number): number => height;

interface ResizeState {
  active: boolean;
  /** Whether the pointer has moved far enough to make the press a drag. */
  moved: boolean;
  /** Whether a frame of this drag has sent a height to the binding. */
  sent: boolean;
  press: EdgePress;
  startY: number;
  /** The body's height the drag starts from: as drawn, or nothing for a collapsed box. */
  startHeight: number;
  /** The stored height when the press came, which a release that collapses the box puts back. */
  stored: number;
  collapsed: boolean;
  pxPerRem?: number;
}

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
  // A release that opened a collapsed box, which holds it open until C# answers, and one that collapsed an open box,
  // which holds it collapsed.
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const resizeState = useRef<ResizeState>({
    active: false,
    moved: false,
    sent: false,
    press: { at: 0, x: 0, y: 0 },
    startY: 0,
    startHeight: 0,
    stored: 0,
    collapsed: false,
  });
  // Read when the menu goes away mid-drag, after the render that last passed them.
  const edge = useRef(rules);
  edge.current = rules;

  // The height the pointer last asked for, sent once per frame: the mouse can
  // report several moves a frame, and each echo re-renders the asset menu.
  const pending = useRef<{ frame: number; height: number | null }>({ frame: 0, height: null });
  // What the pointer last asked for, sent or not, which a release under the build menu's rules lands from: the height
  // held to the ceiling, under the floor or not, and the height the box draws for it.
  const asked = useRef<{ raw: number; drawn: number } | null>(null);
  // The last press that stayed a click, which the next press may make a double press.
  const lastClick = useRef<EdgePress | null>(null);

  const height = clampAssetMenuHeight(useValue(AssetMenuHeight$));

  function flushHeight(): void {
    const next = pending.current.height;
    pending.current = { frame: 0, height: null };

    if (next !== null) {
      send({ method: "SetAssetMenuHeight", args: [next] });
      resizeState.current.sent = true;
    }
    // Once a frame, as the height is sent: the readout follows the drag, under the floor too.
    if (edge.current !== null) setDragged(asked.current?.raw ?? null);
  }

  /**
   * Where a drag ends, as its release, or the menu going away, ends it. The plain drag sends where it ended, and its
   * commit opens nothing. Under the build menu's rules a press that never moved sends nothing; a drag below the floor
   * collapses the box, or leaves a collapsed one so, the stored height kept; any other lands on whole lines, and its
   * commit opens a collapsed box in the same save. It says where the release landed and whether it collapsed the box.
   */
  function settle(): { landed: number | null; collapsing: boolean } {
    const state = resizeState.current;
    const unsent = pending.current.height;
    pending.current = { frame: 0, height: null };
    const rulesNow = edge.current;

    if (rulesNow === null) {
      if (unsent !== null) send({ method: "SetAssetMenuHeight", args: [unsent] });
      send(commitHeightCommand(false));
      return { landed: null, collapsing: false };
    }

    const last = asked.current;
    if (!state.moved || last === null) return { landed: null, collapsing: false };

    if (collapses(last.raw) && (state.collapsed || rulesNow.collapsible)) {
      // The binding back where the press found it: the next open draws the stored height.
      if (state.sent) send({ method: "SetAssetMenuHeight", args: [state.stored] });
      if (!state.collapsed) send(setCollapsedCommand(true));
      return { landed: null, collapsing: !state.collapsed };
    }

    const landed = rulesNow.snap(last.drawn);
    send({ method: "SetAssetMenuHeight", args: [landed] });
    send(commitHeightCommand(state.collapsed));
    return { landed, collapsing: false };
  }

  useEffect(() => {
    if (landing !== null && Math.abs(height - landing) < ANSWERED) setLanding(null);
  }, [height, landing]);

  const storedCollapsed = rules?.collapsed === true;
  useEffect(() => {
    if (opening && !storedCollapsed) setOpening(false);
    if (closing && storedCollapsed) setClosing(false);
  }, [opening, closing, storedCollapsed]);

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
    const press: EdgePress = { at: Date.now(), x: event.clientX, y: event.clientY };

    // Under the build menu's rules, the second press of a double press puts the box back at the game's own size and
    // starts no drag.
    if (edge.current !== null && isDoublePress(lastClick.current, press)) {
      lastClick.current = null;
      send(restoreSizeCommand());
      return;
    }

    // Rem follows the resolution and the pointer reports pixels, so the ratio is
    // measured off the strip just pressed: drawn, and a known rem tall.
    const pressed = event.currentTarget as Element | null | undefined;
    const pxPerRem = pxPerRemFrom(pressed?.getBoundingClientRect?.().height, heightRem);
    // A box held open or collapsed for C#'s answer is drawn so, and a drag from it starts where it is drawn.
    const collapsed = (edge.current?.collapsed === true || closing) && !opening;
    resizeState.current = {
      active: true,
      moved: false,
      sent: false,
      press,
      startY: event.clientY,
      startHeight: collapsed ? 0 : drawnAt(height),
      stored: height,
      collapsed,
      pxPerRem,
    };
    asked.current = null;
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

    if (!state.moved) {
      // The drag carries the box as drawn, so a release's holds go once it moves: one left over would outlast a release
      // C# answers in the same round trip as this drag's, whose answer alone the binding would show. A click keeps them.
      setLanding(null);
      setOpening(false);
      setClosing(false);
    }
    state.moved = true;
    const drawn = drawnAt(draggedAssetMenuHeight(state.startHeight, state.startY, event.clientY, state.pxPerRem));
    // Below the floor the pointer's own height, which says the release collapses the box; above it, as drawn.
    const raw = Math.min(drawn, state.startHeight + dragDistanceRem(event.clientY, state.startY, state.pxPerRem));
    asked.current = { raw, drawn };
    // A collapsed box stays so until the drag passes the floor, so nothing is sent under it.
    pending.current.height = edge.current !== null && state.collapsed && collapses(raw) ? null : drawn;

    if (pending.current.frame === 0) {
      pending.current.frame = requestAnimationFrame(flushHeight);
    }
  }

  function endResize(): void {
    const state = resizeState.current;
    if (!state.active) return;

    // The last position first, so the commit saves where the drag ended.
    cancelAnimationFrame(pending.current.frame);
    state.active = false;
    setIsResizing(false);
    setDragged(null);
    // A press that stayed a click is the first half of a double press.
    lastClick.current = state.moved ? null : state.press;
    const { landed, collapsing } = settle();
    // A click lands nothing, and leaves where the last release landed.
    if (state.moved) setLanding(landed);
    // A release that lands from a collapsed box opens it, and one below the floor collapses an open box: the box stays
    // so until the binding says so.
    if (state.collapsed && landed !== null) setOpening(true);
    if (collapsing) setClosing(true);
  }

  const blocker = isResizing
    ? <div className={styles.resizeBlocker} onMouseMove={moveResize} onMouseUp={endResize} onMouseLeave={endResize} />
    : null;

  // The body draws whole lines, so between them it has nothing new to draw.
  const held = dragged !== null && rules !== null ? rules.hold(dragged) : landing;
  // While a drag is on, the box as the press found it; then as the settings keep it, or as a release holds it.
  const drawnCollapsed = isResizing ? resizeState.current.collapsed : (storedCollapsed || closing) && !opening;
  const collapsed = drawnCollapsed && (dragged === null || collapses(dragged));
  // A collapsed box opened by a drag draws the drag's height at once, not the stored height the binding holds until
  // C# echoes the drag's; past the floor the dragged height is the drawn one.
  const fromCollapsed = dragged !== null && resizeState.current.collapsed && !collapses(dragged);
  const shownHeight = fromCollapsed ? dragged : opening && landing !== null ? landing : height;

  return { height, shownHeight, isResizing, beginResize, blocker, dragged, held, collapsed };
}

export interface AssetMenuResizeHandleProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/** The upgrades panel's strip's hint. */
function useHeightHint(): string {
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
