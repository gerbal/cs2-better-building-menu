import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createRef, forwardRef } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { ExtensionBoundary, safeAppend, safeExtension } from "../../src/mods/ExtensionBoundary";
import { gameClasses, gameModule, PlainTextInput } from "../../src/mods/gameModules";
import { AssetMenuToolOptions } from "../../src/mods/AssetMenuToolOptions/AssetMenuToolOptions";
import register from "../../src/index";
import { installVanillaRegistry } from "../harness/vanillaRegistry";

// React and the boundary both log a caught render error; the tests count ours.
const originalError = console.error;
const originalWarn = console.warn;
let logged: string[] = [];

const Vanilla = ({ label }: { label?: string }) => <div data-vanilla="true">{label}</div>;
const Broken = (): JSX.Element => {
  throw new Error("ours broke");
};

describe("a component we put into vanilla's tree", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    logged = [];
    console.error = (...args: unknown[]) => { logged.push(String(args[0])); };
    console.warn = (...args: unknown[]) => { logged.push(String(args[0])); };
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it("draws the game's own component, with its props, when ours throws", () => {
    const Safe = safeExtension("AssetMenu", () => Broken)(Vanilla as never) as (props: { label: string }) => JSX.Element;

    act(() => { root = create(<Safe label="vanilla grid" />); });

    assert.deepEqual(root!.toJSON(), { type: "div", props: { "data-vanilla": "true" }, children: ["vanilla grid"] });
    assert.ok(logged.some((line) => line.includes("[BetterBuildingMenu] AssetMenu failed")));
  });

  it("draws ours when ours works", () => {
    const Ours = () => <span>ours</span>;
    const Safe = safeExtension("AssetMenu", () => Ours)(Vanilla as never) as (props: object) => JSX.Element;

    act(() => { root = create(<Safe />); });

    assert.deepEqual(root!.toJSON(), { type: "span", props: {}, children: ["ours"] });
  });

  it("passes the ref vanilla gives to ours, and to the game's own in its place", () => {
    const node = { measured: true };
    const OursWithRef = forwardRef<unknown, object>((_, ref) => <span ref={ref as never}>ours</span>);
    const VanillaWithRef = forwardRef<unknown, object>((_, ref) => <div ref={ref as never}>vanilla</div>);

    const oursRef = createRef<unknown>();
    const Working = safeExtension("ToolOptionsPanel", (() => OursWithRef) as never)(VanillaWithRef as never) as never as (props: { ref: unknown }) => JSX.Element;
    act(() => { root = create(<Working ref={oursRef} />, { createNodeMock: () => node }); });
    assert.equal(oursRef.current, node);
    act(() => root?.unmount());

    const vanillaRef = createRef<unknown>();
    const Failing = safeExtension("ToolOptionsPanel", () => Broken)(VanillaWithRef as never) as never as (props: { ref: unknown }) => JSX.Element;
    act(() => { root = create(<Failing ref={vanillaRef} />, { createNodeMock: () => node }); });
    assert.equal(vanillaRef.current, node);
  });

  it("drops an appended watcher that throws, and nothing else", () => {
    const Watcher = safeAppend("VanillaMenuWatcher", Broken);

    act(() => { root = create(<><Watcher /><Vanilla label="game" /></>); });

    assert.deepEqual(root!.toJSON(), { type: "div", props: { "data-vanilla": "true" }, children: ["game"] });
  });

  it("stays on the game's component once ours has failed", () => {
    let fail = true;
    const Flaky = () => {
      if (fail) throw new Error("once");
      return <span>ours</span>;
    };

    act(() => {
      root = create(<ExtensionBoundary name="Flaky" fallback={() => <Vanilla label="game" />}><Flaky /></ExtensionBoundary>);
    });
    fail = false;
    act(() => {
      root!.update(<ExtensionBoundary name="Flaky" fallback={() => <Vanilla label="game" />}><Flaky /></ExtensionBoundary>);
    });

    assert.deepEqual(root!.toJSON(), { type: "div", props: { "data-vanilla": "true" }, children: ["game"] });
  });
});

describe("a game UI module a game update has moved", () => {
  beforeEach(() => {
    logged = [];
    console.warn = (...args: unknown[]) => { logged.push(String(args[0])); };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it("is undefined, logged once, rather than a throw", () => {
    assert.equal(gameModule("game-ui/moved/away.tsx", "Gone"), undefined);
    assert.equal(gameModule("game-ui/moved/away.tsx", "Gone"), undefined);

    assert.equal(logged.filter((line) => line.includes("game-ui/moved/away.tsx#Gone")).length, 1);
  });

  it("leaves a stylesheet's classes empty rather than undefined", () => {
    assert.deepEqual(gameClasses("game-ui/moved/away.tsx"), {});
  });

  it("leaves the search box a plain text box", () => {
    let root: ReactTestRenderer | undefined;
    act(() => { root = create(<PlainTextInput value="clinic" className="box" placeholder="Search..." onChange={() => {}} />); });

    const input = root!.root.findByType("input");
    assert.equal(input.props.value, "clinic");
    assert.equal(input.props.className, "box");
    act(() => root!.unmount());
  });
});

describe("the tool-options bank", () => {
  beforeEach(() => {
    resetBindings();
    setBinding("BetterBuildingMenu", "OwnsCurrentMenu", true);
    setBinding("BetterBuildingMenu", "AssetMenuFacets", {
      groups: [{ id: "availability", label: "Availability", options: [{ id: "Locked", label: "Locked", selected: false }] }],
      hasSelection: false,
    });
  });

  it("adds our section after a vanilla bank that holds a single child, and leaves vanilla's element alone", () => {
    // push() would throw here: one child is an element, not an array.
    const vanillaElement = <div data-bank="true"><span>Theme</span></div>;
    const Bank = AssetMenuToolOptions(() => vanillaElement) as () => JSX.Element;
    let root: ReactTestRenderer | undefined;

    act(() => { root = create(<Bank />); });

    const bank = root!.root.find((node) => node.props["data-bank"] === "true");
    assert.ok(bank.findAll((node) => node.props["data-section"] === "Availability").length === 1);
    assert.equal((vanillaElement.props as { children: unknown }).children instanceof Array, false);
    act(() => root!.unmount());
  });

  it("stays a function a later mod can call and push into, as Anarchy and Find It do", () => {
    // Their extensions run `const result = Component(); result.props.children.push(...)`.
    // A boundary or forwardRef in place of our function broke that and took the UI down.
    const extensions = new Map<string, (component: unknown) => unknown>();
    register({
      extend: (_path: string, name: string, extension: (component: unknown) => unknown) => { extensions.set(name, extension); },
      append: () => undefined,
    } as never);
    // register() hands the resolver the registry it was given; put the harness's back.
    installVanillaRegistry();
    const vanillaElement = <div data-bank="true"><span>Theme</span><span>Pack</span></div>;
    const Ours = extensions.get("MouseToolOptions")!(() => vanillaElement) as () => JSX.Element;
    const TheirsAfterUs = (Component: () => JSX.Element) => () => {
      const result = Component();
      (result.props as { children: JSX.Element[] }).children.push(<span key="theirs" data-theirs="true">Anarchy</span>);
      return result;
    };
    const Chain = TheirsAfterUs(Ours);
    let root: ReactTestRenderer | undefined;

    act(() => { root = create(<Chain />); });

    const bank = root!.root.find((node) => node.props["data-bank"] === "true");
    assert.equal(bank.findAll((node) => node.props["data-section"] === "Availability").length, 1);
    assert.equal(bank.findAll((node) => node.props["data-theirs"] === "true").length, 1);
    act(() => root!.unmount());
  });

  it("drops only our section when it throws, keeping vanilla's bank", () => {
    setBinding("BetterBuildingMenu", "AssetMenuFacets", {
      get groups(): never { throw new Error("our section broke"); },
      hasSelection: false,
    });
    const originalError = console.error;
    console.error = () => undefined;
    const vanillaElement = <div data-bank="true"><span data-theme="true">Theme</span></div>;
    const Bank = AssetMenuToolOptions(() => vanillaElement) as () => JSX.Element;
    let root: ReactTestRenderer | undefined;

    try {
      act(() => { root = create(<Bank />); });
      const bank = root!.root.find((node) => node.props["data-bank"] === "true");
      assert.equal(bank.findAll((node) => node.props["data-theme"] === "true").length, 1);
    } finally {
      console.error = originalError;
      act(() => root?.unmount());
    }
  });
});
