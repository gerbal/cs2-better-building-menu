import { Scrollable } from "cs2/ui";
import { useEffect, useRef } from "react";

import { CONTROLS_MARK, isWithin, POPOVER_MARK, popoverLeft, type OpenPopover, type PopoverAnchor } from "domain/topRow";
import { FilterPanel } from "mods/Pickers/FilterPanel";
import { GroupList } from "mods/Pickers/GroupList";
import { SortList } from "mods/Pickers/SortList";
import { ViewList } from "mods/Pickers/ViewList";
import styles from "./controlPopover.module.scss";

export interface ControlPopoverProps {
  open: OpenPopover | null;
  /** Where a popover may end, in the box: its right edge, or 6 rem short of the chirper. */
  limit: number;
  /** How it hangs in the box: above it by a fixed bottom offset, or under the top row by a fixed top. */
  anchor: PopoverAnchor;
  onClose: () => void;
}

/**
 * The open control's popover: a child of the box, so it takes the look, opening upward above the
 * box, or down from under the top row when the box leaves no room above it. One at a time; a press
 * outside it and the controls closes it, except while one of the game's dropdowns FILTER opened is
 * open. See docs/design-notes.md, "The top row".
 */
export const ControlPopover = ({ open, limit, anchor, onClose }: ControlPopoverProps) => {
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

  const hangsDown = "top" in anchor;
  const offset = hangsDown ? { top: `${anchor.top}rem` } : { bottom: `${anchor.bottom}rem` };

  return (
    <div className={styles.popover} style={{ left: `${popoverLeft(open.left, limit)}rem`, ...offset }} {...{ [POPOVER_MARK]: "true" }}>
      {open.kind === "sort" && <SortList onPicked={onClose} />}
      {/* FILTER stays open on a pick: a filter is often one of several. */}
      {open.kind === "filter" && (
        <Scrollable className={styles.filterBody} vertical trackVisibility="scrollable">
          <FilterPanel onDropdownToggle={(shown) => { keepOpen.current = shown; }} />
        </Scrollable>
      )}
      {open.kind === "group" && <GroupList onPicked={onClose} />}
      {open.kind === "view" && <ViewList onPicked={onClose} opensDown={hangsDown} />}
    </div>
  );
};
