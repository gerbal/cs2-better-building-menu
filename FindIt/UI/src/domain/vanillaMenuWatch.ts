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
  if (!state.seen || index === null) {
    return false;
  }

  return state.last !== index;
}
