import { getModule } from "cs2/modding";
import { useEffect } from "react";
import { firstClassToken, setInlineStyle } from "./vanillaLayoutPure";

export { firstClassToken, setInlineStyle } from "./vanillaLayoutPure";

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

/** Vanilla's `.toolLayout`: the side + main + side trio the menu sits in. */
export function findVanillaToolLayout(doc: Document): HTMLElement | null {
  const cls = vanillaClass(GAME_MAIN_SCREEN, "toolLayout");

  return cls ? doc.querySelector<HTMLElement>(`.${cls}`) : null;
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
 * The two patches vanilla's layout needs while the lens is open, applied on
 * mount and undone on unmount: `toolLayout` left-aligned, and the toolbar sunk
 * below us. See docs/design-notes.md, "Patching vanilla's layout for the lens".
 */
export function useVanillaLayoutForLens(): void {
  useEffect(() => {
    const restores: Array<() => void> = [];
    const layout = findVanillaToolLayout(document);
    const toolbar = findVanillaToolbar(document);

    if (layout) {
      restores.push(setInlineStyle(layout, "justifyContent", "flex-start"));
    }

    if (toolbar) {
      restores.push(setInlineStyle(toolbar, "zIndex", "-1"));
    }

    return () => {
      for (const restore of restores) {
        restore();
      }
    };
  }, []);
}
