import { useEffect, useRef, type RefObject } from "react";

import { moveEnterTargetCommand } from "domain/buildingCatalogContracts";
import { searchFieldKey } from "domain/buildingSearchRank";
import { pageScrollTop } from "domain/catalogWindow";
import { send } from "mods/bindings";
import { isSearchField } from "mods/TopRow/searchField";
import { listScroller } from "./catalogDom";

/** The list a screen down or up, on the element that scrolls it. */
function pageList(root: HTMLElement | null, direction: 1 | -1): void {
  const scroller = root ? listScroller(root) : null;

  if (scroller) {
    scroller.scrollTop = pageScrollTop(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight, direction);
  }
}

/** How long a move waits for its answer before the next may go: a move past an end changes no page. */
const MOVE_WAIT_MS = 250;

/**
 * While the search field has the keys, Up and Down move Enter's target a row that can be placed at a
 * time, and PageUp and PageDown scroll the list a screen; the game's input waits then, so the keys
 * are BBM's. From anywhere else they stay the camera's. Captured, since the app container stops
 * keydown from bubbling. One move is in flight: the next goes once `answered` changes (the page
 * landed) or a moment passes, so a key held down costs one refresh at a time. See
 * docs/design-notes.md, "The search field's keys".
 */
export function useSearchFieldKeys(rootRef: RefObject<HTMLElement>, canMove: boolean, answered: string): void {
  // Read at the press, so the one listener sees this render's page.
  const movable = useRef(canMove);
  movable.current = canMove;
  const inFlight = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = () => {
    if (inFlight.current !== null) {
      clearTimeout(inFlight.current);
      inFlight.current = null;
    }
  };

  // The page answered: a new step, or a page for a new query.
  useEffect(release, [answered]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = isSearchField(event.target) ? searchFieldKey(event) : null;

      if (key === null) {
        return;
      }

      // The one-line field has no use for them.
      event.preventDefault();

      if (key === "pageUp" || key === "pageDown") {
        pageList(rootRef.current, key === "pageDown" ? 1 : -1);
      } else if (movable.current && inFlight.current === null) {
        send(moveEnterTargetCommand(key === "down" ? 1 : -1));
        inFlight.current = setTimeout(release, MOVE_WAIT_MS);
      }
    };

    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      release();
    };
  }, [rootRef]);
}
