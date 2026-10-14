import { Scrollable } from "cs2/ui";
import { useEffect } from "react";

import { POPOVER_ROOM } from "domain/assetMenuLayout";
import { CONTROLS_MARK, gameMenuOpen, isWithin, POPOVER_MARK, popoverLeft, type OpenPopover, type PopoverAnchor } from "domain/topRow";
import { vanillaClass } from "mods/BuildingMenu/vanillaLayout";
import { GAME_DROPDOWN_THEME } from "mods/FilterRail/FilterRail";
import { FilterPanel } from "mods/Pickers/FilterPanel";
import { GroupList } from "mods/Pickers/GroupList";
import { SortList } from "mods/Pickers/SortList";
import { ViewList } from "mods/Pickers/ViewList";
import styles from "./controlPopover.module.scss";

/** cs2/ui's own dropdown theme, whose menu class a Dropdown draws when the game's in-game theme gives none. */
const CS2_DROPDOWN_THEME = "game-ui/common/input/dropdown/themes/default.module.scss";

/**
 * The class of a game dropdown's open menu: the in-game theme's, else cs2/ui's own, else null, and
 * with null a press in a menu counts as outside.
 */
const dropdownMenuClass = () => vanillaClass(GAME_DROPDOWN_THEME, "dropdownMenu") ?? vanillaClass(CS2_DROPDOWN_THEME, "dropdownMenu");

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
 * outside it and the controls closes it, except FILTER while one of the game's dropdown menus is
 * open. See docs/design-notes.md, "The top row".
 */
export const ControlPopover = ({ open, limit, anchor, onClose }: ControlPopoverProps) => {
  useEffect(() => {
    if (open === null) return undefined;

    // Captured, and on mousedown: the game's input sends mouse events, never pointer events. Captured,
    // it runs before the game's dropdown closes itself on the same press, so the menu is still drawn:
    // that press closes the dropdown, and the next one FILTER.
    const onPress = (event: MouseEvent) => {
      if (isWithin(event.target, POPOVER_MARK) || isWithin(event.target, CONTROLS_MARK)) return;
      if (open.kind === "filter" && gameMenuOpen(document, dropdownMenuClass())) return;
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
          <FilterPanel />
        </Scrollable>
      )}
      {open.kind === "group" && <GroupList onPicked={onClose} />}
      {open.kind === "view" && <ViewList onPicked={onClose} opensDown={hangsDown} room={POPOVER_ROOM} />}
    </div>
  );
};
