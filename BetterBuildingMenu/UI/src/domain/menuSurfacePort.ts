import { trigger } from "cs2/api";
import mod from "../../mod.json";
import {
  createMenuSurfacePort,
  toMenuSurfaceTrigger,
} from "./menuSurfaceContracts";

function dispatch(action: Parameters<typeof toMenuSurfaceTrigger>[0]): void {
  const binding = toMenuSurfaceTrigger(action);
  trigger(mod.id, binding.method, ...binding.args);
}

export const menuSurfacePort = createMenuSurfacePort(dispatch);
