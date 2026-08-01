import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activatePrefabAction,
  createFindItSurfacePort,
  findItOptionAction,
  locatePrefabAction,
  pickerOptionAction,
  toFindItSurfaceTrigger,
} from "../src/domain/findItSurfaceContracts.ts";

describe("FindIt surface commands", () => {
  it("maps semantic activation and locate actions to their legacy bindings", () => {
    assert.deepEqual(toFindItSurfaceTrigger(activatePrefabAction(17)), { method: "SetCurrentPrefab", args: [17] });
    assert.deepEqual(toFindItSurfaceTrigger(locatePrefabAction(17)), { method: "OnLocateButtonClicked", args: [17] });
  });

  it("maps FindIt and picker option arguments in backend order", () => {
    assert.deepEqual(toFindItSurfaceTrigger(findItOptionAction(-1, 0, 1)), { method: "OptionClicked", args: [-1, 0, 1] });
    assert.deepEqual(toFindItSurfaceTrigger(pickerOptionAction(1.5, -2, 3)), { method: "PickerOptionClicked", args: [1.5, -2, 3] });
  });

  it("keeps named port methods at the semantic handoff boundary", () => {
    const actions: unknown[] = [];
    const port = createFindItSurfacePort((action) => actions.push(action));

    port.activatePrefab({ prefabId: 17 });
    port.locatePrefab({ prefabId: 18 });
    port.findItOption({ sectionId: -1, optionId: 2, value: 3 });
    port.pickerOption({ sectionId: 4, optionId: 5, value: 6 });

    assert.deepEqual(actions, [
      { type: "activatePrefab", prefabId: 17 },
      { type: "locatePrefab", prefabId: 18 },
      { type: "findItOption", sectionId: -1, optionId: 2, value: 3 },
      { type: "pickerOption", sectionId: 4, optionId: 5, value: 6 },
    ]);
  });
});
