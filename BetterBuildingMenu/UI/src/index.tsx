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
  // A singleton holding the game components the modding API does not expose
  // directly.
  VanillaComponentResolver.setRegistry(moduleRegistry);

  // Replaces the asset grid.
  moduleRegistry.extend("game-ui/game/components/asset-menu/asset-menu.tsx", "AssetMenu", RemoveVanillaAssetMenuComponent);

  // The panel a building with upgrades opens, which the game renders into the
  // same column as the asset menu above. Same shape of replacement, same
  // fall-through to vanilla when we decline; see ExtensionMenu for the rule.
  moduleRegistry.extend("game-ui/game/components/upgrades-menu/upgrades-menu.tsx", "UpgradesMenu", ExtensionMenuComponent);

  // Availability, drawn into the game's own tool-options bank beside Theme and
  // Pack; the filter rail draws every other dimension.
  moduleRegistry.extend("game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", "MouseToolOptions", LensToolOptions);
  // That bank only mounts for an active tool and browsing is not one, so this
  // holds it open while the lens owns the menu.
  moduleRegistry.extend("game-ui/game/components/tool-options/tool-options-panel.tsx", "useToolOptionsVisible", ToolOptionsVisibility);

  // Renders nothing; watches the vanilla toolbar so its menus open the lens.
  moduleRegistry.append("Game", VanillaMenuWatcher);
  // Also renders nothing; forwards the game's own theme/pack/Vanilla/Mods row
  // so the catalog hides what the vanilla grid would hide.
  moduleRegistry.append("Game", VanillaToolbarWatcher);

};

export default register;
