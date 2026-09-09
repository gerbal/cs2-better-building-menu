export type ActivatePrefabAction = {
  type: "activatePrefab";
  prefabId: number;
};

export type LocatePrefabAction = {
  type: "locatePrefab";
  prefabId: number;
};

export type MenuSurfaceAction = ActivatePrefabAction | LocatePrefabAction;

export interface MenuSurfacePort {
  activatePrefab(args: { prefabId: number }): void;
  locatePrefab(args: { prefabId: number }): void;
}

export type MenuSurfaceTrigger =
  | { method: "SetCurrentPrefab"; args: readonly [number] }
  | { method: "OnLocateButtonClicked"; args: readonly [number] };

export const activatePrefabAction = (prefabId: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId });
export const locatePrefabAction = (prefabId: number): LocatePrefabAction => ({ type: "locatePrefab", prefabId });

export function createMenuSurfacePort(emit: (action: MenuSurfaceAction) => void): MenuSurfacePort {
  return {
    activatePrefab: ({ prefabId }) => emit(activatePrefabAction(prefabId)),
    locatePrefab: ({ prefabId }) => emit(locatePrefabAction(prefabId)),
  };
}

export function toMenuSurfaceTrigger(action: MenuSurfaceAction): MenuSurfaceTrigger {
  switch (action.type) {
    case "activatePrefab":
      return { method: "SetCurrentPrefab", args: [action.prefabId] };
    case "locatePrefab":
      return { method: "OnLocateButtonClicked", args: [action.prefabId] };
  }
}
