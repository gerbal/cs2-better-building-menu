import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry, showBody } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

// Mounted, so the effect that tells C# runs. The other effects need a document and a frame clock;
// neither does anything here, and both go back after each case.
const globals = globalThis as unknown as Record<string, unknown>;

describe("the screen the catalog tells C#", () => {
  let root: ReactTestRenderer | undefined;
  let saved: Record<string, unknown>;
  const screens = () => triggers.filter((call) => call.name === "SetCatalogScreen").map((call) => call.args[0]);
  const mount = () => act(() => {
    root = create(<BuildingCatalogComponent />);
  });

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    saved = { document: globals.document, requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame };
    globals.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
    globals.requestAnimationFrame = () => 0;
    globals.cancelAnimationFrame = () => undefined;
    setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage([entry(1), entry(2)]));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    Object.assign(globals, saved);
  });

  it("is 20 for the list and for the tiles in the game's own box", () => {
    showBody("list");
    mount();
    showBody("tiles");
    act(() => root!.update(<BuildingCatalogComponent />));

    assert.deepEqual(screens(), [20]);
  });

  it("is told again when the screen changes, and for Cards the cards a screen's rows hold", () => {
    showBody("list");
    mount();
    act(() => setBinding("options", "textScale", 1.3));
    act(() => setBinding("BetterBuildingMenu", "AssetMenuViews", [{ menu: "Roads", value: "cards" }]));

    // The page's two cards both sit in the first of the rows a screen shows.
    assert.deepEqual(screens(), [20, 18, 2]);
  });

  it("follows the body's height: a body dragged taller holds more lines", () => {
    showBody("tiles");
    setBinding("BetterBuildingMenu", "AssetMenuHeight", 400);
    mount();

    assert.deepEqual(screens(), [60]);
  });
});
