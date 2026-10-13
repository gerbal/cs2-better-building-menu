import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { VanillaMenuWatcher } from "../../src/mods/VanillaMenuWatcher/VanillaMenuWatcher";

const globals = globalThis as unknown as Record<string, unknown>;

describe("the small menus the watcher tells C#", () => {
  let root: ReactTestRenderer | undefined;
  const saved = globals.document;
  const told = () => triggers.filter((call) => call.name === "SetMenusOpeningOnAll").map((call) => call.args[0]);
  const shares = (rows: number) => [{ menu: "Garbage Management", rows, costOrCapacity: rows, capacity: rows, locked: 0 }];

  beforeEach(() => {
    resetBindings();
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
    setBinding("BetterBuildingMenu", "ReplaceVanillaBuildMenu", true);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  it("says nothing until C# has counted a menu, then names the small ones, and again only when they change", () => {
    act(() => { root = create(<VanillaMenuWatcher />); });
    assert.deepEqual(told(), []);

    act(() => setBinding("BetterBuildingMenu", "MenuShares", shares(7)));
    // The shares again, the same rows counted once more: the set is the same, so nothing goes.
    act(() => setBinding("BetterBuildingMenu", "MenuShares", shares(7)));
    act(() => setBinding("BetterBuildingMenu", "MenuShares", shares(40)));

    assert.deepEqual(told(), ["Garbage Management", ""]);
  });

  it("tells C# its set again after a remount, since C# keeps the last one it was told", () => {
    setBinding("BetterBuildingMenu", "MenuShares", shares(7));
    act(() => { root = create(<VanillaMenuWatcher />); });
    act(() => root!.unmount());

    // The menu stopped being small while the watcher was away.
    setBinding("BetterBuildingMenu", "MenuShares", shares(40));
    act(() => { root = create(<VanillaMenuWatcher />); });

    assert.deepEqual(told(), ["Garbage Management", ""]);
  });
});
