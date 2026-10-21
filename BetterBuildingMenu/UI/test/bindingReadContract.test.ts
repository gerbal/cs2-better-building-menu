import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

// Every toolbar menu keeps a built panel, and the hidden ones are frozen through
// mods/panelValue's useValue. A component inside the menu that read a binding with
// cs2/api's useValue would follow the open menu while hidden: fifteen panels
// re-rendering on every page and setting change. So only code that never renders
// inside the kept menu may use the game's hook.

const SRC = join(import.meta.dirname, "..", "src");

/** Never rendered inside the kept menu: the game's own trees, and watchers outside it. */
const OUTSIDE_THE_MENU = new Set([
  "mods/AssetMenuToolOptions/AssetMenuToolOptions.tsx",
  "mods/ExtensionMenu/ExtensionMenu.tsx",
  "mods/RemoveVanillaAssetMenu/RemoveVanillaAssetMenu.tsx",
  "mods/ToolOptionsVisibility/ToolOptionsPanelRefresh.tsx",
  "mods/VanillaMenuWatcher/VanillaMenuWatcher.tsx",
  "mods/VanillaMenuWatcher/VanillaToolbarWatcher.tsx",
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const importsGameUseValue = (text: string) => /import\s*\{[^}]*\buseValue\b[^}]*\}\s*from\s*"cs2\/api"/.test(text);

describe("how the build menu reads bindings", () => {
  it("reads them through the kept menu's useValue everywhere inside the menu", () => {
    const offenders = sources(SRC)
      .map((path) => relative(SRC, path).split("\\").join("/"))
      .filter((path) => !OUTSIDE_THE_MENU.has(path) && importsGameUseValue(readFileSync(join(SRC, path), "utf8")));

    assert.deepEqual(offenders, [], "import useValue from mods/panelValue, or list the file as outside the menu");
  });

  it("lists only files that exist and still use the game's hook", () => {
    for (const path of OUTSIDE_THE_MENU) {
      assert.ok(importsGameUseValue(readFileSync(join(SRC, path), "utf8")), `${path} no longer needs listing`);
    }
  });
});
