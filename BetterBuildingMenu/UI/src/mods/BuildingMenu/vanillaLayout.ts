import { getModule } from "cs2/modding";
import { useEffect } from "react";
import { firstClassToken, setInlineStyle } from "./vanillaLayoutPure";

const GAME_MAIN_SCREEN = "game-ui/game/components/game-main-screen.module.scss";
const TOOLBAR = "game-ui/game/components/toolbar/toolbar.module.scss";

/** A class the game's stylesheet module exports, or null — never a guess. */
export function vanillaClass(modulePath: string, key: string): string | null {
  let classes: unknown;

  try {
    classes = getModule(modulePath, "classes");
  } catch {
    return null;
  }

  return firstClassToken((classes as Record<string, unknown> | undefined)?.[key]);
}

/**
 * Vanilla's bottom toolbar: a CHILD of `game-main-screen`, because the pair
 * whose paint order we change are defined by being siblings, and matched on the
 * module's own class, because a prefix on a hashed name also matches ours.
 */
export function findVanillaToolbar(doc: Document): HTMLElement | null {
  const screenClass = vanillaClass(GAME_MAIN_SCREEN, "gameMainScreen");
  const toolbarClass = vanillaClass(TOOLBAR, "toolbar");

  if (!screenClass || !toolbarClass) {
    return null;
  }

  const screen = doc.querySelector<HTMLElement>(`.${screenClass}`);

  if (!screen) {
    return null;
  }

  for (const child of Array.from(screen.children)) {
    if (child instanceof HTMLElement && child.classList.contains(toolbarClass)) {
      return child;
    }
  }

  return null;
}

/**
 * Vanilla's tool options column: the first child of `toolLayout`, left of the slot, matched on the
 * module's own classes. The column right of the slot carries the same class and holds nothing.
 */
export function findVanillaToolOptionsColumn(doc: Pick<Document, "querySelector">): HTMLElement | null {
  const layoutClass = vanillaClass(GAME_MAIN_SCREEN, "toolLayout");
  const columnClass = vanillaClass(GAME_MAIN_SCREEN, "toolSideColumn");

  if (!layoutClass || !columnClass) {
    return null;
  }

  const first = doc.querySelector<HTMLElement>(`.${layoutClass}`)?.children[0] as HTMLElement | undefined;

  return first?.classList?.contains(columnClass) ? first : null;
}

/**
 * The patches vanilla's layout needs while the asset menu is open, each undone when no longer
 * needed and on unmount: the toolbar sunk below the box and the pane, and the tool options column
 * moved left by `toolOptionsShift` rem while the box reaches left of the game's slot. The game's
 * own centring is left alone. See docs/design-notes.md, "Patching vanilla's layout for the asset menu".
 */
export function useVanillaLayoutForAssetMenu(toolOptionsShift: number | null): void {
  useEffect(() => {
    const toolbar = findVanillaToolbar(document);

    return toolbar ? setInlineStyle(toolbar, "zIndex", "-1") : undefined;
  }, []);

  useEffect(() => {
    const column = toolOptionsShift === null ? null : findVanillaToolOptionsColumn(document);

    return column ? setInlineStyle(column, "left", `${toolOptionsShift}rem`) : undefined;
  }, [toolOptionsShift]);
}
