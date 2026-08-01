import { trigger } from "cs2/api";
import mod from "../../mod.json";
import {
  createFindItSurfacePort,
  toFindItSurfaceTrigger,
} from "./findItSurfaceContracts";

function dispatch(action: Parameters<typeof toFindItSurfaceTrigger>[0]): void {
  const binding = toFindItSurfaceTrigger(action);
  trigger(mod.id, binding.method, ...binding.args);
}

export const findItSurfacePort = createFindItSurfacePort(dispatch);
