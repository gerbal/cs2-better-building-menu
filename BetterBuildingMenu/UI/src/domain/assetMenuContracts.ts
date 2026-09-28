export type ActivatePrefabAction = {
  type: "activatePrefab";
  prefabId: number;
};

export type AssetMenuAction = ActivatePrefabAction;

export interface AssetMenuPort {
  activatePrefab(args: { prefabId: number }): void;
}

export type AssetMenuTrigger = { method: "SetCurrentPrefab"; args: readonly [number] };

export const activatePrefabAction = (prefabId: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId });

export function createAssetMenuPort(emit: (action: AssetMenuAction) => void): AssetMenuPort {
  return {
    activatePrefab: ({ prefabId }) => emit(activatePrefabAction(prefabId)),
  };
}

export function toAssetMenuTrigger(action: AssetMenuAction): AssetMenuTrigger {
  return { method: "SetCurrentPrefab", args: [action.prefabId] };
}
