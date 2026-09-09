import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * The object picker went with the Find It separation. Find It ships the same
 * tool, so a second toolbar glyph, a second "BetterBuildingMenu.Picker" tool
 * and a second options bank beside it were the conflict the separation was
 * for. These read source: the registrations are what put the picker on
 * screen, and no render test can see a module that was never extended.
 */
const src = (relative: string): string => readFileSync(new URL(`../src/${relative}`, import.meta.url), "utf8");
const has = (relative: string): boolean => existsSync(new URL(`../src/${relative}`, import.meta.url));

describe("the object picker is gone", () => {
  it("registers no toolbar glyph, tool options or menu opener for it", () => {
    const index = src("index.tsx");
    assert.doesNotMatch(index, /ToolbarIcon/);
    assert.doesNotMatch(index, /PickerComponent/);
    assert.doesNotMatch(index, /PickerMenuOpener/);
  });

  it("ships none of its modules or its glyph", () => {
    for (const path of [
      "mods/ToolbarIcon/ToolbarIcon.tsx",
      "mods/PickerComponent/PickerComponent.tsx",
      "mods/OptionsPanel/OptionsPanel.tsx",
      "mods/VanillaMenuWatcher/PickerMenuOpener.tsx",
      "domain/pickerMenuRequest.ts",
      "images/PickerPicker.svg",
    ]) {
      assert.equal(has(path), false, `${path} still ships`);
    }
  });

  it("keeps the options bank visible for the lens alone", () => {
    const visibility = src("mods/ToolOptionsVisibility/ToolOptionsVisibility.tsx");
    assert.doesNotMatch(visibility, /BetterBuildingMenu\.Picker/);
    assert.match(visibility, /lensOwnsCurrentMenu/);
  });

  it("offers no picker action on the menu surface", () => {
    assert.doesNotMatch(src("domain/menuSurfaceContracts.ts"), /PickerOption/);
    assert.doesNotMatch(src("domain/buildingCatalogContracts.ts"), /pickerOption/);
  });
});
