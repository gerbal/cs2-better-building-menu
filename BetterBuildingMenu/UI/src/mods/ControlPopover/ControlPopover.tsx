import { Scrollable } from "cs2/ui";
import { useEffect, useRef } from "react";

import { CONTROLS_MARK, isWithin, POPOVER_MARK, popoverLeft, type OpenPopover } from "domain/topRow";
import { FilterPanel } from "mods/Pickers/FilterPanel";
import { GroupList } from "mods/Pickers/GroupList";
import { SortList } from "mods/Pickers/SortList";
import { ViewList } from "mods/Pickers/ViewList";
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
 * box. One at a time; a press outside it and the controls closes it, except while one of the game's
 * dropdowns FILTER opened is open. See docs/design-notes.md, "The top row".
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

  if (open === null) return null;

  return (
    <div className={styles.popover} style={{ left: `${popoverLeft(open.left, limit)}rem`, bottom: `${bottom}rem` }} {...{ [POPOVER_MARK]: "true" }}>
      {open.kind === "sort" && <SortList onPicked={onClose} />}
      {/* FILTER stays open on a pick: a filter is often one of several. */}
      {open.kind === "filter" && (
        <Scrollable className={styles.filterBody} vertical trackVisibility="scrollable">
          <FilterPanel onDropdownToggle={(shown) => { keepOpen.current = shown; }} />
        </Scrollable>
      )}
      {open.kind === "group" && <GroupList onPicked={onClose} />}
      {open.kind === "view" && <ViewList onPicked={onClose} />}
    </div>
  );
};
