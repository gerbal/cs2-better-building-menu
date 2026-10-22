/**
 * How the vanilla toolbar identifies one of its own entries: an ECS entity,
 * arriving as a bare index, a string, or an {index, version} pair, so a reader
 * accepts all three. Indices are RUNTIME values and must never be persisted.
 */

export interface ToolbarEntityRef {
  index: number;
  version?: number;
}

export type ToolbarEntity = number | string | ToolbarEntityRef;

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
