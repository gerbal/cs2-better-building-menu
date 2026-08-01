import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activatePrefabAction,
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
});
