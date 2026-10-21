import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";
import { bindValue, resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { createPanelFreeze, PanelFreezeContext, setPanelFrozen, useValue } from "../../src/mods/panelValue";
import { useAssetMenuView } from "../../src/mods/useAssetMenuView";
import { resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import type { ValueBinding } from "cs2/api";

// Every toolbar menu keeps a built panel; the hidden ones are frozen so they do no
// work while another menu is open. Inside the menu, bindings and the view store are
// read through hooks that hold still while frozen and otherwise behave as before.

const Value$ = bindValue<unknown>("Test", "Value", 0) as unknown as ValueBinding<unknown>;

function reader(renders: unknown[]) {
  return function Reader() {
    const value = useValue(Value$);
    renders.push(value);
    return <span>{JSON.stringify(value)}</span>;
  };
}

const text = (root: ReturnType<typeof create>) => (root.toJSON() as { children: string[] }).children[0];

describe("the kept menu's useValue", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("follows its binding outside a kept panel, as cs2/api's does", () => {
    const Reader = reader([]);
    let root!: ReturnType<typeof create>;
    act(() => { root = create(<Reader />); });

    act(() => setBinding("Test", "Value", 3));
    assert.equal(text(root), "3");
  });

  it("skips an update equal to what it delivered, as cs2/api's does", () => {
    const renders: unknown[] = [];
    const Reader = reader(renders);
    act(() => setBinding("Test", "Value", { menu: "Roads" }));
    act(() => { create(<Reader />); });
    const before = renders.length;

    act(() => setBinding("Test", "Value", { menu: "Roads" }));
    assert.equal(renders.length, before);
  });

  it("delivers numbers cut to six decimals, as cs2/api's does", () => {
    const Reader = reader([]);
    let root!: ReturnType<typeof create>;
    act(() => { root = create(<Reader />); });

    act(() => setBinding("Test", "Value", 0.12345678));
    assert.equal(text(root), "0.123456");
  });

  it("holds still in a frozen panel, and catches up when it thaws", () => {
    const renders: unknown[] = [];
    const Reader = reader(renders);
    const panel = createPanelFreeze(false);
    let root!: ReturnType<typeof create>;
    act(() => { root = create(<PanelFreezeContext.Provider value={panel}><Reader /></PanelFreezeContext.Provider>); });
    act(() => setBinding("Test", "Value", 1));
    assert.equal(text(root), "1");

    act(() => setPanelFrozen(panel, true));
    const frozenAt = renders.length;
    act(() => setBinding("Test", "Value", 2));
    act(() => setBinding("Test", "Value", 5));
    assert.equal(renders.length, frozenAt, "a frozen panel does not re-render");
    assert.equal(text(root), "1");

    act(() => setPanelFrozen(panel, false));
    assert.equal(text(root), "5");
  });

  it("holds the view store still in a frozen panel, and catches up when it thaws", () => {
    const renders: string[] = [];
    const ViewReader = () => {
      const mode = useAssetMenuView((view) => view.viewMode);
      renders.push(mode);
      return <span>{mode}</span>;
    };
    const panel = createPanelFreeze(false);
    let root!: ReturnType<typeof create>;
    act(() => { root = create(<PanelFreezeContext.Provider value={panel}><ViewReader /></PanelFreezeContext.Provider>); });
    act(() => setAssetMenuView({ viewMode: "grid" }));
    assert.equal(text(root), "grid");

    act(() => setPanelFrozen(panel, true));
    const frozenAt = renders.length;
    act(() => setAssetMenuView({ viewMode: "table" }));
    assert.equal(renders.length, frozenAt, "a frozen panel does not re-render");

    act(() => setPanelFrozen(panel, false));
    assert.equal(text(root), "table");
  });
});
