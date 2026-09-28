import { trigger } from "cs2/api";
import mod from "../../mod.json";
import {
  createAssetMenuPort,
  toAssetMenuTrigger,
} from "./assetMenuContracts";

function dispatch(action: Parameters<typeof toAssetMenuTrigger>[0]): void {
  const binding = toAssetMenuTrigger(action);
  trigger(mod.id, binding.method, ...binding.args);
}

export const assetMenuPort = createAssetMenuPort(dispatch);
