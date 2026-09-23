import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useState } from "react";
import { act, create } from "react-test-renderer";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { ToolOptionsVisibility } from "../../src/mods/ToolOptionsVisibility/ToolOptionsVisibility";

// The game can add a mod's UI module to a page whose components are already
// mounted (subscribe, then load a city in the same session). A wrapper around
// a vanilla hook is then called by an instance that rendered without it.

const useVanillaToolOptionsVisible = () => {
  const [visible] = useState(false);
  return visible;
};

describe("ToolOptionsVisibility on a panel mounted before the mod loaded", () => {
  beforeEach(() => resetBindings());

  it("adds no hook of its own, so the panel's next render survives the swap", () => {
    let useToolOptionsVisible = useVanillaToolOptionsVisible;
    const Panel = () => <>{useToolOptionsVisible() ? "shown" : "hidden"}</>;

    let root!: ReturnType<typeof create>;
    act(() => { root = create(<Panel />); });
    assert.equal(root.toJSON(), "hidden");

    useToolOptionsVisible = ToolOptionsVisibility(useVanillaToolOptionsVisible);
    setBinding("BetterBuildingMenu", "LensOwnsCurrentMenu", true);

    assert.doesNotThrow(() => act(() => { root.update(<Panel />); }));
    assert.equal(root.toJSON(), "shown");
  });

  it("still keeps the bank open for the lens on a fresh mount", () => {
    const useToolOptionsVisible = ToolOptionsVisibility(useVanillaToolOptionsVisible);
    const Panel = () => <>{useToolOptionsVisible() ? "shown" : "hidden"}</>;
    setBinding("BetterBuildingMenu", "LensOwnsCurrentMenu", true);
    let root!: ReturnType<typeof create>;
    act(() => { root = create(<Panel />); });
    assert.equal(root.toJSON(), "shown");
  });
});
