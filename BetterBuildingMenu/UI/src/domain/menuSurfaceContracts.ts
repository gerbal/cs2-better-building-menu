export type ActivatePrefabAction = {
  type: "activatePrefab";
  prefabId: number;
};

export type LocatePrefabAction = {
  type: "locatePrefab";
  prefabId: number;
};

export type PickerOptionAction = {
  type: "pickerOption";
  sectionId: number;
  optionId: number;
  value: number;
};

export type MenuSurfaceAction = ActivatePrefabAction | LocatePrefabAction | PickerOptionAction;

export interface MenuSurfacePort {
  activatePrefab(args: { prefabId: number }): void;
  locatePrefab(args: { prefabId: number }): void;
  pickerOption(args: { sectionId: number; optionId: number; value: number }): void;
}

export type MenuSurfaceTrigger =
  | { method: "SetCurrentPrefab"; args: readonly [number] }
  | { method: "OnLocateButtonClicked"; args: readonly [number] }
  | { method: "PickerOptionClicked"; args: readonly [number, number, number] };

export const activatePrefabAction = (prefabId: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId });
export const locatePrefabAction = (prefabId: number): LocatePrefabAction => ({ type: "locatePrefab", prefabId });
export const pickerOptionAction = (sectionId: number, optionId: number, value: number): PickerOptionAction => ({
  type: "pickerOption",
  sectionId,
  optionId,
  value,
});

export function createMenuSurfacePort(emit: (action: MenuSurfaceAction) => void): MenuSurfacePort {
  return {
    activatePrefab: ({ prefabId }) => emit(activatePrefabAction(prefabId)),
    locatePrefab: ({ prefabId }) => emit(locatePrefabAction(prefabId)),
    pickerOption: ({ sectionId, optionId, value }) => emit(pickerOptionAction(sectionId, optionId, value)),
  };
}

export function toMenuSurfaceTrigger(action: MenuSurfaceAction): MenuSurfaceTrigger {
  switch (action.type) {
    case "activatePrefab":
      return { method: "SetCurrentPrefab", args: [action.prefabId] };
    case "locatePrefab":
      return { method: "OnLocateButtonClicked", args: [action.prefabId] };
    case "pickerOption":
      return { method: "PickerOptionClicked", args: [action.sectionId, action.optionId, action.value] };
  }
}
