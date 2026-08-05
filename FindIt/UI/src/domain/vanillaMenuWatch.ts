import type { ToolbarEntity } from "./toolSurfaceContracts";

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
