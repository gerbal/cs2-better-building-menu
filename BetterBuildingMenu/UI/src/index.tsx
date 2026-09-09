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
  // The vanilla component resolver is a singleton that helps extrant and maintain components from game that were not specifically exposed.
  VanillaComponentResolver.setRegistry(moduleRegistry);

  // This repalaces the asset grid.
  moduleRegistry.extend("game-ui/game/components/asset-menu/asset-menu.tsx", "AssetMenu", RemoveVanillaAssetMenuComponent);

  // The extension picker — the panel a building with upgrades opens — which
  // the game renders into the same column with the same toolPanel class as
  // the asset menu above. Same shape of replacement, same fall-through to
  // vanilla when we decline; see ExtensionMenu for the rule.
  moduleRegistry.extend("game-ui/game/components/upgrades-menu/upgrades-menu.tsx", "UpgradesMenu", ExtensionMenuComponent);

  // No toolbar glyph and no picker tool of our own: Find It ships that
  // picker, and the separation left it there. This is a build menu.

  // Availability lives in the game's own bank now (cm-2xvs.15).
  moduleRegistry.extend("game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", "MouseToolOptions", LensToolOptions);
  // The lens's filters used to be injected here, into the game's own options
  // bank beside Theme and Pack. They render in the control plane now — see
  // LensControlPane for why the move, and what it costs.
  moduleRegistry.extend("game-ui/game/components/tool-options/tool-options-panel.tsx", "useToolOptionsVisible", ToolOptionsVisibility);

  // Renders nothing; watches the vanilla toolbar so its menus can open the
  // lens when the player has opted into replacing the build menu.
  moduleRegistry.append("Game", VanillaMenuWatcher);
  // Also renders nothing; forwards the game's own theme/pack/Vanilla/Mods row
  // so the catalog hides what the vanilla grid would have hidden.
  moduleRegistry.append("Game", VanillaToolbarWatcher);

};

export default register;
