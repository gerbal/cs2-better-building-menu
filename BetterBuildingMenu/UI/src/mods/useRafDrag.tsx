import { useCallback, useEffect, useRef, useState } from "react";

/** What one edge's drag does with the pointer; useRafDrag runs the rest. */
export interface RafDragEdge {
  /** The value a move asks for, or null for a move that does not count yet. */
  move: (event: any) => number | null;
  /** Sends the value a frame's moves last asked for. */
  sendFrame: (value: number) => void;
  /**
   * Ends the drag, handed the value a frame had yet to send. `released` is false
   * when the menu went away mid-drag rather than the button coming up.
   */
  finish: (queued: number | null, released: boolean) => void;
  /** The blocker's class, from the handle's own stylesheet. */
  blockerClassName: string;
}

export interface RafDrag {
  isResizing: boolean;
  /** Starts a drag from a press the handle has already read. */
  start: () => void;
  /**
   * Covers the screen for the length of a drag so the menu keeps the mouse
   * when it leaves the strip. Null between drags; render it beside the menu.
   */
  blocker: JSX.Element | null;
}

/**
 * A drag that sends one value a frame through the live binding: the mouse can
 * report several moves a frame, and each echo re-renders the asset menu. `shown`
 * false ends a drag, as unmounting does.
 */
export function useRafDrag(edge: RafDragEdge, shown: boolean): RafDrag {
  const [isResizing, setIsResizing] = useState(false);
  const drag = useRef<{ active: boolean; frame: number; queued: number | null }>({ active: false, frame: 0, queued: null });
  // The newest edge, for a frame or a menu going away after the render that made it.
  const latest = useRef(edge);
  latest.current = edge;

  const end = useCallback((released: boolean): void => {
    const state = drag.current;
    if (!state.active) return;

    cancelAnimationFrame(state.frame);
    drag.current = { active: false, frame: 0, queued: null };
    setIsResizing(false);
    latest.current.finish(state.queued, released);
  }, []);

  // The menu going away mid-drag (closed by a key or by the game) ends the drag as a
  // release does, or the dragged value would sit in the binding until another save
  // re-pushed the saved one. Hidden counts as gone: the kept menu stays mounted.
  useEffect(() => () => end(false), [shown, end]);

  function flush(): void {
    const state = drag.current;
    const queued = state.queued;
    state.frame = 0;
    state.queued = null;

    if (queued !== null) {
      latest.current.sendFrame(queued);
    }
  }

  function start(): void {
    drag.current = { active: true, frame: 0, queued: null };
    setIsResizing(true);
  }

  function move(event: any): void {
    const state = drag.current;
    if (!state.active) return;
    // A release the blocker never saw, such as one outside the window.
    if (event.buttons === 0) {
      end(true);
      return;
    }

    const value = latest.current.move(event);
    if (value === null) return;

    state.queued = value;
    if (state.frame === 0) {
      state.frame = requestAnimationFrame(flush);
    }
  }

  const release = () => end(true);
  const blocker = isResizing
    ? <div className={edge.blockerClassName} onMouseMove={move} onMouseUp={release} onMouseLeave={release} />
    : null;

  return { isResizing, start, blocker };
}
