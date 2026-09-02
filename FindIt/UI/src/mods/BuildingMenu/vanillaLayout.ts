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
 * Vanilla's bottom toolbar, as the child of `game-main-screen` carrying the
 * toolbar module's own class.
 *
 * A child of the screen rather than a document-wide match, because the pair
 * whose paint order we change are defined by being siblings; and the
 * module's class rather than `className.startsWith("toolbar_")`, because a
 * prefix on a hashed name is a guess that also matches our own toolbars.
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
 * The two things vanilla's layout has to do differently while the lens is
 * open, applied on mount and undone on unmount.
 *
 * 1. `toolLayout` left-aligned. Vanilla centres side + main + side (990px)
 *    in 1267px, putting the main column at x=403; this panel and its
 *    control pane need 980px from that edge, and the tool-options column
 *    sits at 145→398 beside it. Left-aligned, the column starts at 264 and
 *    everything fits. Only vanilla's element decides it — a container of
 *    ours can neither shift left over the options column nor fit to the
 *    right (measured; see the phase-6 spec).
 *
 * 2. The toolbar sunk to `z-index: -1`. The chirper hangs off `toolbar`, we
 *    hang off `main-container`, both are children of `game-main-screen` and
 *    paint in tree order at `z-index: auto` — so the toast covered the
 *    control pane and no z-index of OURS could change it (measured: `lensRow`
 *    at 40 changed nothing). Raising main-container broke the game's
 *    portalled dropdowns, which count on tree order to win; lowering the
 *    toolbar changes exactly the one pair. Verified live at 1280x720: the
 *    toast is hidden, the Locked/Unlocked popup draws over the pane, the
 *    toolbar still renders (the screen paints no background) and is still
 *    hit-testable. Still a stopgap — the real fix is moving the toast lane.
 *
 * Imperative and scoped to the mount because these are vanilla's elements:
 * a stylesheet rule would restyle the game for the whole session, including
 * while the panel is closed and for whatever other mod is looking at the
 * same node. A missing module or class makes the patch a no-op.
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
