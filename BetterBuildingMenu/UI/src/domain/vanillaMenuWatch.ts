/** What the watcher remembers between emissions. */
export interface WatchState {
  /** Whether any selection has been observed since mount. */
  seen: boolean;
  /** The last index actually routed to the backend. */
  last: number | null;
}

/** What an observed selection asks the watcher to do. */
export type WatchAction = "ignore" | "open" | "close";

/**
 * Reads an observed selection as an instruction. Clicking an open toolbar menu
 * deselects it, so a null has to mean "close"; `close` is only produced once a
 * menu was actually routed, so the subscribe-time null dismisses nothing.
 */
export function watchAction(state: WatchState, index: number | null): WatchAction {
  if (!state.seen) {
    return "ignore";
  }

  if (index === null) {
    return state.last === null ? "ignore" : "close";
  }

  return state.last === index ? "ignore" : "open";
}

/**
 * What the watcher remembers while the setting is off: observations still count,
 * so the menu open when the setting comes on reads as a fresh selection and the
 * asset menu takes it over at once. Nothing is routed while off, so `last` is null.
 */
export function watchStateWhileOff(): WatchState {
  return { seen: true, last: null };
}

/** What the watcher should remember after acting on an observation. */
export function nextWatchState(state: WatchState, index: number | null, action: WatchAction): WatchState {
  if (action === "ignore") {
    return { seen: true, last: state.last };
  }

  // A close forgets the menu, so clicking the same icon again reopens it
  // rather than reading as a repeat.
  return { seen: true, last: action === "close" ? null : index };
}

/** What the Escape rule needs to know. */
export interface EscapeContext {
  /** Whether the asset menu is on screen. */
  assetMenuOpen: boolean;
  /** Upstream Find It's panel is up; Escape is theirs then. */
  findItPanelShown?: boolean;
  /** The game's default tool is active: nothing is armed. */
  defaultTool: boolean;
  /** One of the game's panels is open (economy, progression, photo mode...). */
  gamePanelOpen: boolean;
  /** Something in the world is selected, with its info panel. */
  hasSelection: boolean;
}

/**
 * How an Escape takes the asset menu down, if at all:
 * - `claim-back`: claim the game's Back action, and close the menu on it. Nothing else claims
 *   Back on the default tool, and an unclaimed Back opens the pause menu on the same press.
 * - `clear-on-keydown`: the game claims Back itself (dropping the tool, closing its panel or the
 *   selection), and the keydown listener closes the menu on that press.
 * - `none`: no menu of ours is open, or Find It's panel is up and the press is theirs.
 *
 * See docs/design-notes.md, "Escape closes the asset menu unconditionally".
 */
export type EscapeRoute = "claim-back" | "clear-on-keydown" | "none";

export function escapeRoute({ assetMenuOpen, findItPanelShown = false, defaultTool, gamePanelOpen, hasSelection }: EscapeContext): EscapeRoute {
  // Escape belongs to Find It's panel while it is up; clearing the menu
  // selection underneath it would close our menu behind their back.
  if (!assetMenuOpen || findItPanelShown) {
    return "none";
  }

  return defaultTool && !gamePanelOpen && !hasSelection ? "claim-back" : "clear-on-keydown";
}
