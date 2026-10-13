import { useEffect, useRef } from "react";

import { CONTROLS_MARK, isWithin, POPOVER_MARK, popoverLeft, type OpenPopover } from "domain/topRow";
import { GroupList } from "mods/Pickers/GroupList";
import { SortList } from "mods/Pickers/SortList";
import styles from "./controlPopover.module.scss";

export interface ControlPopoverProps {
  open: OpenPopover | null;
  /** Where a popover may end, in the box: its right edge, or 6 rem short of the chirper. */
  limit: number;
  /** Its offset from the box's bottom: the box's height and the gap above it. */
  bottom: number;
  onClose: () => void;
}

/**
 * The open control's popover: a child of the box, so it takes the look, opening upward above the
 * box. One at a time; a press outside it and the controls closes it. See docs/design-notes.md, "The
 * top row".
 */
export const ControlPopover = ({ open, limit, bottom, onClose }: ControlPopoverProps) => {
  // Set while one of the game's dropdowns this popover opened is open: its menu draws outside.
  const keepOpen = useRef(false);

  useEffect(() => {
    if (open === null) return undefined;
    keepOpen.current = false;

    // Captured, and on mousedown: the game's input sends mouse events, never pointer events.
    const onPress = (event: MouseEvent) => {
      if (keepOpen.current || isWithin(event.target, POPOVER_MARK) || isWithin(event.target, CONTROLS_MARK)) return;
      onClose();
    };

    document.addEventListener("mousedown", onPress, true);
    return () => document.removeEventListener("mousedown", onPress, true);
  }, [open, onClose]);

  // SORT and GROUP have lists; FILTER's and VIEW's cells open none yet.
  if (open === null || (open.kind !== "sort" && open.kind !== "group")) return null;

  return (
    <div className={styles.popover} style={{ left: `${popoverLeft(open.left, limit)}rem`, bottom: `${bottom}rem` }} {...{ [POPOVER_MARK]: "true" }}>
      {open.kind === "sort" && <SortList onPicked={onClose} />}
      {open.kind === "group" && <GroupList onPicked={onClose} />}
    </div>
  );
};
