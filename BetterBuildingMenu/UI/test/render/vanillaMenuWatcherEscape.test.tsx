import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { consumers, resetConsumers } from "../harness/stubs/cs2-input";
import { VanillaMenuWatcher } from "../../src/mods/VanillaMenuWatcher/VanillaMenuWatcher";

// Escape with our menu open: claimed as the game's Back on the default tool, so one press
// closes the menu without opening the pause menu. See domain/vanillaMenuWatch, escapeRoute.
const open = (toolId: string) => {
  setBinding("BetterBuildingMenu", "ReplaceVanillaBuildMenu", true);
  setBinding("BetterBuildingMenu", "OwnsCurrentMenu", true);
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
    setBinding("BetterBuildingMenu", "OwnsCurrentMenu", false);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);

    open("Default Tool");
    setBinding("FindIt", "ShowFindItPanel", true);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);

    setBinding("FindIt", "ShowFindItPanel", false);
    setBinding("BetterBuildingMenu", "ReplaceVanillaBuildMenu", false);
    assert.doesNotMatch(renderHtml(<VanillaMenuWatcher />), /data-input-actions/);
  });
});
