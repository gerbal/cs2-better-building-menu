import { ModRegistrar } from "cs2/modding";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

import { RemoveVanillaAssetMenuComponent } from "mods/RemoveVanillaAssetMenu/RemoveVanillaAssetMenu";
import { ExtensionMenuComponent } from "mods/ExtensionMenu/ExtensionMenu";
import { ToolOptionsVisibility } from "mods/ToolOptionsVisibility/ToolOptionsVisibility";
import { ToolOptionsPanelRefresh } from "mods/ToolOptionsVisibility/ToolOptionsPanelRefresh";
import { LensToolOptions } from "mods/LensToolOptions/LensToolOptions";

import { VanillaMenuWatcher } from "mods/VanillaMenuWatcher/VanillaMenuWatcher";
import { VanillaToolbarWatcher } from "mods/VanillaMenuWatcher/VanillaToolbarWatcher";
import { safeAppend, safeExtension } from "mods/ExtensionBoundary";

const register: ModRegistrar = (moduleRegistry) => {
  // A singleton holding the game components the modding API does not expose
  // directly.
  VanillaComponentResolver.setRegistry(moduleRegistry);

  // Every component we put into vanilla's tree sits behind a boundary: a
  // render error in ours draws the game's own instead of taking the screen.
  // Not the useToolOptionsVisible hook, which no boundary can wrap.

  // Replaces the asset grid.
  moduleRegistry.extend("game-ui/game/components/asset-menu/asset-menu.tsx", "AssetMenu", safeExtension("AssetMenu", RemoveVanillaAssetMenuComponent));

  // The panel a building with upgrades opens, which the game renders into the
  // same column as the asset menu above. Same shape of replacement, same
  // fall-through to vanilla when we decline; see ExtensionMenu for the rule.
  moduleRegistry.extend("game-ui/game/components/upgrades-menu/upgrades-menu.tsx", "UpgradesMenu", safeExtension("UpgradesMenu", ExtensionMenuComponent));

  // Availability, drawn into the game's own tool-options bank beside Theme and
  // Pack; the filter rail draws every other dimension.
  moduleRegistry.extend("game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", "MouseToolOptions", safeExtension("MouseToolOptions", LensToolOptions));
  // That bank only mounts for an active tool and browsing is not one, so this
  // holds it open while the lens owns the menu.
  moduleRegistry.extend("game-ui/game/components/tool-options/tool-options-panel.tsx", "useToolOptionsVisible", ToolOptionsVisibility);
  // The hook above reads its binding without subscribing; this re-renders the
  // panel when that value changes.
  moduleRegistry.extend("game-ui/game/components/tool-options/tool-options-panel.tsx", "ToolOptionsPanel", safeExtension("ToolOptionsPanel", ToolOptionsPanelRefresh));

  // Renders nothing; watches the vanilla toolbar so its menus open the lens.
  moduleRegistry.append("Game", safeAppend("VanillaMenuWatcher", VanillaMenuWatcher));
  // Also renders nothing; forwards the game's own theme/pack/Vanilla/Mods row
  // so the catalog hides what the vanilla grid would hide.
  moduleRegistry.append("Game", safeAppend("VanillaToolbarWatcher", VanillaToolbarWatcher));

};

export default register;
