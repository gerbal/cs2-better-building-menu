import type { ToolbarEntity } from "./toolbarEntity";

/**
 * The entity index behind a toolbar selection, or null when nothing is selected.
 *
 * The toolbar bindings hand back a bare number in some places and an
 * `{index, version}` ref in others, and ToolbarEntity permits a string too.
 *
 * Index 0 is `Entity.Null`. Treating it as a real selection would fire the
 * interception every time the player *closes* a menu, reopening the lens they
 * just dismissed.
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

/** Tells the backend the toolbar dropped its menu, so the lens should go too. */
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

/**
 * Whether an observed selection is a real user action worth routing.
 *
 * The binding emits its current value on subscribe, so the first thing the
 * watcher sees is existing state rather than a click. Acting on it closed the
 * lens panel the instant it was opened whenever a non-building menu happened to
 * be the stale selection — the decline path fighting the player.
 *
 * Repeats are ignored too, since the binding re-emits on unrelated toolbar
 * churn, and a null (menu closed) is remembered but never routed.
 */
export function shouldRouteSelection(state: WatchState, index: number | null): boolean {
  return watchAction(state, index) === "open";
}

/** What an observed selection asks the watcher to do. */
export type WatchAction = "ignore" | "open" | "close";

/**
 * Reads an observed selection as an instruction.
 *
 * The `close` case is why this exists. Clicking a toolbar menu that is already
 * open deselects it — measured, not assumed: the vanilla button fires
 * `toolbar.clearAssetSelection` and `toolbar.selectedAssetMenu` goes to
 * `Entity.Null`. The lens was only ever told about openings, so a second click
 * on the same icon left it sitting there: the button un-lit, the menu it stood
 * for closed, and the panel still covering the screen.
 *
 * `close` is only produced when a menu was actually routed, so the null the
 * binding emits on subscribe cannot dismiss a panel nobody opened.
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

/** What the watcher should remember after acting on an observation. */
export function nextWatchState(state: WatchState, index: number | null, action: WatchAction): WatchState {
  if (action === "ignore") {
    return { seen: true, last: state.last };
  }

  // A close forgets the menu, so clicking the same icon again reopens it
  // rather than reading as a repeat.
  return { seen: true, last: action === "close" ? null : index };
}
