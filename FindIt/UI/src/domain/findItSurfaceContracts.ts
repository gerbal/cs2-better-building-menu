export type ActivatePrefabAction = {
  type: "activatePrefab";
  prefabId: number;
};

export type LocatePrefabAction = {
  type: "locatePrefab";
  prefabId: number;
};

export type FindItOptionAction = {
  type: "findItOption";
  sectionId: number;
  optionId: number;
  value: number;
};

export type PickerOptionAction = {
  type: "pickerOption";
  sectionId: number;
  optionId: number;
  value: number;
};

export type FindItSurfaceAction = ActivatePrefabAction | LocatePrefabAction | FindItOptionAction | PickerOptionAction;

export type FindItSurfaceTrigger =
  | { method: "SetCurrentPrefab"; args: readonly [number] }
  | { method: "OnLocateButtonClicked"; args: readonly [number] }
  | { method: "OptionClicked"; args: readonly [number, number, number] }
  | { method: "PickerOptionClicked"; args: readonly [number, number, number] };

export const activatePrefabAction = (prefabId: number): ActivatePrefabAction => ({ type: "activatePrefab", prefabId });
export const locatePrefabAction = (prefabId: number): LocatePrefabAction => ({ type: "locatePrefab", prefabId });
export const findItOptionAction = (sectionId: number, optionId: number, value: number): FindItOptionAction => ({
  type: "findItOption",
  sectionId,
  optionId,
  value,
});
export const pickerOptionAction = (sectionId: number, optionId: number, value: number): PickerOptionAction => ({
  type: "pickerOption",
  sectionId,
  optionId,
  value,
});

export function toFindItSurfaceTrigger(action: FindItSurfaceAction): FindItSurfaceTrigger {
  switch (action.type) {
    case "activatePrefab":
      return { method: "SetCurrentPrefab", args: [action.prefabId] };
    case "locatePrefab":
      return { method: "OnLocateButtonClicked", args: [action.prefabId] };
    case "findItOption":
      return { method: "OptionClicked", args: [action.sectionId, action.optionId, action.value] };
    case "pickerOption":
      return { method: "PickerOptionClicked", args: [action.sectionId, action.optionId, action.value] };
  }
}
