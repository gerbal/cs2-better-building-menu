import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { forwardRef, useState } from "react";
import { act, create, type ReactTestRendererJSON } from "react-test-renderer";
import { resetBindings } from "../harness/stubs/cs2-api";
import { resetModules, setModule } from "../harness/stubs/cs2-modding";
import { seed } from "../harness/seed";
import { ToolOptionsVisibility } from "../../src/mods/ToolOptionsVisibility/ToolOptionsVisibility";
import { ToolOptionsPanelRefresh } from "../../src/mods/ToolOptionsVisibility/ToolOptionsPanelRefresh";
import { OwnsCurrentMenu$, ReplaceVanillaBuildMenu$ } from "../../src/mods/bindings";

// The visibility wrapper reads the binding without a hook, so something else
// has to re-render the panel when ownership changes. That is this wrapper.

describe("ToolOptionsPanelRefresh", () => {
  beforeEach(() => {
    resetBindings();
    resetModules();
  });

  it("re-renders the vanilla panel when asset menu ownership changes", () => {
    const useToolOptionsVisible = ToolOptionsVisibility(() => { const [v] = useState(false); return v; });
    const Vanilla = forwardRef<HTMLDivElement, { className?: string }>((props, ref) => (
      <div ref={ref} className={props.className}>{useToolOptionsVisible() ? "shown" : "hidden"}</div>
    ));
    const Panel = ToolOptionsPanelRefresh(Vanilla) as typeof Vanilla;

    let root!: ReturnType<typeof create>;
    act(() => { root = create(<Panel className="bank" />); });
    assert.equal((root.toJSON() as { children: string[] }).children[0], "hidden");

    seed(OwnsCurrentMenu$, true);
    act(() => { root.update(<Panel className="bank" />); });
    const json = root.toJSON() as ReactTestRendererJSON;
    assert.equal(json.children?.[0], "shown");
    assert.equal(json.props.className, "bank", "props pass through");
  });

  // The game mounts the panel from its main screen, which asks useToolOptionsVisible
  // only when it re-renders itself. Closing the asset menu re-renders the panel (above)
  // but not the main screen, so the panel stayed mounted, empty, until something else
  // re-rendered the screen: a blue bar above the toolbar.
  const panelPath = "game-ui/game/components/tool-options/tool-options-panel.tsx";

  function stuckPanel(vanillaVisible: () => boolean) {
    setModule(panelPath, "useToolOptionsVisible", ToolOptionsVisibility(() => { useState(0); return vanillaVisible(); }));
    const Vanilla = forwardRef<HTMLDivElement>((_props, ref) => <div ref={ref}>bank</div>);
    const Panel = ToolOptionsPanelRefresh(Vanilla) as typeof Vanilla;
    let root!: ReturnType<typeof create>;
    // Mounted unconditionally: the main screen never re-renders to take it down.
    act(() => { root = create(<Panel />); });
    return root;
  }

  it("draws nothing once the asset menu that held the panel up closes", () => {
    seed(OwnsCurrentMenu$, true);
    const root = stuckPanel(() => false);
    assert.notEqual(root.toJSON(), null);

    act(() => { seed(OwnsCurrentMenu$, false); });
    assert.equal(root.toJSON(), null);
  });

  it("leaves a panel a game tool held up to the game, so it closes as vanilla's does", () => {
    let toolActive = true;
    const root = stuckPanel(() => toolActive);
    assert.notEqual(root.toJSON(), null);

    // The tool ends; any of the panel's subscriptions re-renders it before the screen.
    toolActive = false;
    act(() => { seed(ReplaceVanillaBuildMenu$, false); });
    assert.notEqual(root.toJSON(), null);
  });
});
