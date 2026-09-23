export type ActivatePrefabAction = {
  type: "activatePrefab";
  prefabId: number;
};

export type MenuSurfaceAction = ActivatePrefabAction;

export interface MenuSurfacePort {
  activatePrefab(args: { prefabId: number }): void;
}

export type MenuSurfaceTrigger = { method: "SetCurrentPrefab"; args: readonly [number] };

export const activatePrefabAction = (prefabId: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId });

export function createMenuSurfacePort(emit: (action: MenuSurfaceAction) => void): MenuSurfacePort {
  return {
    activatePrefab: ({ prefabId }) => emit(activatePrefabAction(prefabId)),
  };
}

export function toMenuSurfaceTrigger(action: MenuSurfaceAction): MenuSurfaceTrigger {
  return { method: "SetCurrentPrefab", args: [action.prefabId] };
}
