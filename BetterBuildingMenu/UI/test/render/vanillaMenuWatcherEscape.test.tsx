import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act } from "react-test-renderer";
import { installFakeBrowser } from "../harness/fakeBrowser";
import { mountEach } from "../harness/mount";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { consumers, resetConsumers } from "../harness/stubs/cs2-input";
import { seed } from "../harness/seed";
import { VanillaMenuWatcher } from "../../src/mods/VanillaMenuWatcher/VanillaMenuWatcher";
import { OwnsCurrentMenu$, ReplaceVanillaBuildMenu$ } from "../../src/mods/bindings";

// Escape with our menu open: claimed as the game's Back on the default tool, so one press
// closes the menu without opening the pause menu. See domain/vanillaMenuWatch, escapeRoute.
const open = (toolId: string) => {
  seed(ReplaceVanillaBuildMenu$, true);
  seed(OwnsCurrentMenu$, true);
  setBinding("tool", "activeTool", { id: toolId });
};

describe("VanillaMenuWatcher and Escape", () => {
  beforeEach(() => {
    resetBindings();
    resetConsumers();
  });

  it("claims Back on the default tool, and Back closes the menu", () => {
    open("Default Tool");

    assert.match(renderHtml(<VanillaMenuWatcher />), /data-input-actions="Back"/);

    consumers.at(-1)?.Back?.();
    assert.deepEqual(triggers.at(-1), { group: "toolbar", name: "clearAssetSelection", args: [] });
  });

  it("leaves Back to the game while a tool is armed", () => {
    open("Net Tool");

    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);
  });

  it("leaves Back to the game while a selection or game panel is open", () => {
    open("Default Tool");
    setBinding("selectedInfo", "activeSelection", true);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);

    setBinding("selectedInfo", "activeSelection", false);
    setBinding("game", "activeGamePanel", { __Type: "Game.UI.InGame.EconomyPanel" });
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);
  });

  it("claims nothing while our menu is closed, Find It's panel is up, or the setting is off", () => {
    open("Default Tool");
    seed(OwnsCurrentMenu$, false);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);

    open("Default Tool");
    setBinding("FindIt", "ShowFindItPanel", true);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);

    setBinding("FindIt", "ShowFindItPanel", false);
    seed(ReplaceVanillaBuildMenu$, false);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);
  });
});

describe("VanillaMenuWatcher and Escape on the keydown", () => {
  type Listener = (event: { keyCode: number }) => void;
  const tree = mountEach();
  let captured: Listener[] = [];
  let restore: () => void;

  beforeEach(() => {
    resetBindings();
    resetConsumers();
    captured = [];
    ({ restore } = installFakeBrowser({
      frames: "none",
      document: {
        // Only a capture-phase listener hears a key: the game's app container stops keydown.
        addEventListener: (type: string, listener: Listener, capture?: boolean) => {
          if (type === "keydown" && capture === true) captured.push(listener);
        },
        removeEventListener: (type: string, listener: Listener, capture?: boolean) => {
          if (type === "keydown" && capture === true) captured = captured.filter((other) => other !== listener);
        },
      },
    }));
  });

  afterEach(() => restore());

  const press = (keyCode: number) => act(() => {
    for (const listener of [...captured]) listener({ keyCode });
  });
  const clears = () => triggers.filter((call) => call.name === "clearAssetSelection").length;

  it("clears the game's selection on Escape while a tool is armed, and on no other key", () => {
    open("Net Tool");
    tree.mount(<VanillaMenuWatcher />);

    press(13);
    assert.equal(clears(), 0);

    press(27);
    assert.equal(clears(), 1);
  });

  it("stops listening once it claims Back instead, and when it unmounts", () => {
    open("Net Tool");
    tree.mount(<VanillaMenuWatcher />);
    assert.equal(captured.length, 1);

    act(() => setBinding("tool", "activeTool", { id: "Default Tool" }));
    assert.equal(captured.length, 0);

    act(() => setBinding("tool", "activeTool", { id: "Net Tool" }));
    assert.equal(captured.length, 1);
    act(() => tree.renderer.unmount());
    assert.equal(captured.length, 0);
  });
});
