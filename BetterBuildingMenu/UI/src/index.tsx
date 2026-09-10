import { ModRegistrar } from "cs2/modding";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

import mod from "../mod.json";
import { RemoveVanillaAssetMenuComponent } from "mods/RemoveVanillaAssetMenu/RemoveVanillaAssetMenu";
import { ExtensionMenuComponent } from "mods/ExtensionMenu/ExtensionMenu";
import { ToolOptionsVisibility } from "mods/ToolOptionsVisibility/ToolOptionsVisibility";
import { LensToolOptions } from "mods/LensToolOptions/LensToolOptions";

import { VanillaMenuWatcher } from "mods/VanillaMenuWatcher/VanillaMenuWatcher";
import { VanillaToolbarWatcher } from "mods/VanillaMenuWatcher/VanillaToolbarWatcher";

const register: ModRegistrar = (moduleRegistry) => {
  // The vanilla component resolver is a singleton that extracts and holds on to
  // game components the modding API does not expose directly.
  VanillaComponentResolver.setRegistry(moduleRegistry);

  // This replaces the asset grid.
  moduleRegistry.extend("game-ui/game/components/asset-menu/asset-menu.tsx", "AssetMenu", RemoveVanillaAssetMenuComponent);

  // The extension picker — the panel a building with upgrades opens — which
  // the game renders into the same column with the same toolPanel class as
  // the asset menu above. Same shape of replacement, same fall-through to
  // vanilla when we decline; see ExtensionMenu for the rule.
  moduleRegistry.extend("game-ui/game/components/upgrades-menu/upgrades-menu.tsx", "UpgradesMenu", ExtensionMenuComponent);

  // No toolbar glyph and no picker tool of our own: Find It ships that
  // picker, and the separation left it there. This is a build menu.

  // Availability, drawn into the game's own tool-options bank beside Theme and
  // Pack; the filter rail draws every other dimension.
  moduleRegistry.extend("game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", "MouseToolOptions", LensToolOptions);
  // That bank only mounts for an active tool, and browsing the menu is not a
  // tool, so this holds it open while the lens owns the menu.
  moduleRegistry.extend("game-ui/game/components/tool-options/tool-options-panel.tsx", "useToolOptionsVisible", ToolOptionsVisibility);

  // Renders nothing; watches the vanilla toolbar so its menus can open the
  // lens when the player has opted into replacing the build menu.
  moduleRegistry.append("Game", VanillaMenuWatcher);
  // Also renders nothing; forwards the game's own theme/pack/Vanilla/Mods row
  // so the catalog hides what the vanilla grid would have hidden.
  moduleRegistry.append("Game", VanillaToolbarWatcher);

};

export default register;
