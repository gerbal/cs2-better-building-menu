import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activatePrefabAction,
  createMenuSurfacePort,
  locatePrefabAction,
  pickerOptionAction,
  toMenuSurfaceTrigger,
} from "../src/domain/menuSurfaceContracts.ts";

describe("FindIt surface commands", () => {
  it("maps semantic activation and locate actions to their legacy bindings", () => {
    assert.deepEqual(toMenuSurfaceTrigger(activatePrefabAction(17)), { method: "SetCurrentPrefab", args: [17] });
    assert.deepEqual(toMenuSurfaceTrigger(locatePrefabAction(17)), { method: "OnLocateButtonClicked", args: [17] });
  });

  it("maps picker option arguments in backend order", () => {
    assert.deepEqual(toMenuSurfaceTrigger(pickerOptionAction(1.5, -2, 3)), { method: "PickerOptionClicked", args: [1.5, -2, 3] });
  });

  it("keeps named port methods at the semantic handoff boundary", () => {
    const actions: unknown[] = [];
    const port = createMenuSurfacePort((action) => actions.push(action));

    port.activatePrefab({ prefabId: 17 });
    port.locatePrefab({ prefabId: 18 });
    port.pickerOption({ sectionId: 4, optionId: 5, value: 6 });

    assert.deepEqual(actions, [
      { type: "activatePrefab", prefabId: 17 },
      { type: "locatePrefab", prefabId: 18 },
      { type: "pickerOption", sectionId: 4, optionId: 5, value: 6 },
    ]);
  });
});
