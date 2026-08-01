import { trigger } from "cs2/api";
import mod from "../../mod.json";
import {
  activatePrefabAction,
  findItOptionAction,
  locatePrefabAction,
  pickerOptionAction,
  toFindItSurfaceTrigger,
} from "./findItSurfaceContracts";

export interface FindItSurfacePort {
  activatePrefab(args: { prefabId: number }): void;
  locatePrefab(args: { prefabId: number }): void;
  findItOption(args: { sectionId: number; optionId: number; value: number }): void;
  pickerOption(args: { sectionId: number; optionId: number; value: number }): void;
}

function dispatch(action: Parameters<typeof toFindItSurfaceTrigger>[0]): void {
  const binding = toFindItSurfaceTrigger(action);
  trigger(mod.id, binding.method, ...binding.args);
}

export const findItSurfacePort: FindItSurfacePort = {
  activatePrefab: ({ prefabId }) => dispatch(activatePrefabAction(prefabId)),
  locatePrefab: ({ prefabId }) => dispatch(locatePrefabAction(prefabId)),
  findItOption: ({ sectionId, optionId, value }) => dispatch(findItOptionAction(sectionId, optionId, value)),
  pickerOption: ({ sectionId, optionId, value }) => dispatch(pickerOptionAction(sectionId, optionId, value)),
};
