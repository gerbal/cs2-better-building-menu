import type { ToolbarEntity } from "./toolbarEntity";

/**
 * The entity index behind a toolbar selection, or null when nothing is
 * selected. Index 0 is `Entity.Null`: treating it as a real selection would
 * reopen the asset menu every time the player closes a menu.
 */
export function toolbarEntityIndex(entity: ToolbarEntity | null | undefined): number | null {
  if (entity === null || entity === undefined) {
    return null;
  }

  const index = typeof entity === "object" ? entity.index : Number(entity);

  return Number.isFinite(index) && index > 0 ? (index as number) : null;
}

/** Hands a toolbar menu selection to the backend, which resolves its preset. */
export function vanillaMenuSelectedCommand(entityIndex: number) {
  return {
    method: "VanillaMenuSelected",
    args: [entityIndex],
  } as const;
}

/** Tells the backend the toolbar dropped its menu, so the asset menu should go too. */
export function vanillaMenuDeselectedCommand() {
  return {
    method: "VanillaMenuDeselected",
    args: [] as const,
  } as const;
}

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
  /** Whether the press came from the search field, which holds the keys while it has focus. */
  fieldFocused?: boolean;
  /** Whether a list is open, in the top row's popover or over the pane. */
  listOpen?: boolean;
  /** Whether the field holds a query. */
  queryTyped?: boolean;
}

/** What an Escape does on BBM's side: nothing, close the open list, clear the query, or close the menu. */
export type EscapeAction = "none" | "closeList" | "clearQuery" | "closeMenu";

/**
 * What an Escape does. From the search field, whose press is BBM's alone: the open list, then the
 * query, then the menu. From anywhere else the menu closes, whatever is open in it, because the
 * game's own Escape acts at the same time. See docs/design-notes.md, "Escape".
 */
export function escapeAction({
  assetMenuOpen,
  findItPanelShown = false,
  fieldFocused = false,
  listOpen = false,
  queryTyped = false,
}: EscapeContext): EscapeAction {
  // Escape belongs to Find It's panel while it is up; clearing the menu
  // selection underneath it would close our menu behind their back.
  if (!assetMenuOpen || findItPanelShown) return "none";
  if (fieldFocused && listOpen) return "closeList";
  if (fieldFocused && queryTyped) return "clearQuery";
  return "closeMenu";
}
