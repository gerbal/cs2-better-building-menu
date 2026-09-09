import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activatePrefabAction,
  createMenuSurfacePort,
  locatePrefabAction,
  toMenuSurfaceTrigger,
} from "../src/domain/menuSurfaceContracts.ts";

describe("Menu surface commands", () => {
  it("maps semantic activation and locate actions to their legacy bindings", () => {
    assert.deepEqual(toMenuSurfaceTrigger(activatePrefabAction(17)), { method: "SetCurrentPrefab", args: [17] });
    assert.deepEqual(toMenuSurfaceTrigger(locatePrefabAction(17)), { method: "OnLocateButtonClicked", args: [17] });
  });

  it("keeps named port methods at the semantic handoff boundary", () => {
    const actions: unknown[] = [];
    const port = createMenuSurfacePort((action) => actions.push(action));

    port.activatePrefab({ prefabId: 17 });
    port.locatePrefab({ prefabId: 18 });

    assert.deepEqual(actions, [
      { type: "activatePrefab", prefabId: 17 },
      { type: "locatePrefab", prefabId: 18 },
    ]);
  });
});
