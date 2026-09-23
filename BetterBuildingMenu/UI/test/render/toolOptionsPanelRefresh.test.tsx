import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { forwardRef, useState } from "react";
import { act, create, type ReactTestRendererJSON } from "react-test-renderer";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { ToolOptionsVisibility } from "../../src/mods/ToolOptionsVisibility/ToolOptionsVisibility";
import { ToolOptionsPanelRefresh } from "../../src/mods/ToolOptionsVisibility/ToolOptionsPanelRefresh";

// The visibility wrapper reads the binding without a hook, so something else
// has to re-render the panel when ownership changes. That is this wrapper.

describe("ToolOptionsPanelRefresh", () => {
  beforeEach(() => resetBindings());

  it("re-renders the vanilla panel when lens ownership changes", () => {
    const useToolOptionsVisible = ToolOptionsVisibility(() => { const [v] = useState(false); return v; });
    const Vanilla = forwardRef<HTMLDivElement, { className?: string }>((props, ref) => (
      <div ref={ref} className={props.className}>{useToolOptionsVisible() ? "shown" : "hidden"}</div>
    ));
    const Panel = ToolOptionsPanelRefresh(Vanilla) as typeof Vanilla;

    let root!: ReturnType<typeof create>;
    act(() => { root = create(<Panel className="bank" />); });
    assert.equal((root.toJSON() as { children: string[] }).children[0], "hidden");

    setBinding("BetterBuildingMenu", "LensOwnsCurrentMenu", true);
    act(() => { root.update(<Panel className="bank" />); });
    const json = root.toJSON() as ReactTestRendererJSON;
    assert.equal(json.children?.[0], "shown");
    assert.equal(json.props.className, "bank", "props pass through");
  });
});
