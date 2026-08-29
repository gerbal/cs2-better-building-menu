import { ModRegistrar } from "cs2/modding";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

import mod from "../mod.json";
import { ToolbarIconComponent } from "mods/ToolbarIcon/ToolbarIcon";
import { RemoveVanillaAssetMenuComponent } from "mods/RemoveVanillaAssetMenu/RemoveVanillaAssetMenu";
import { WrapToolOptionsPanel } from "mods/WrapToolOptionsPanel/WrapToolOptionsPanel";
import { PickerComponent } from "mods/PickerComponent/PickerComponent";
import { ToolOptionsVisibility } from "mods/PickerComponent/ToolOptionsVisibility";
import { LensToolOptions } from "mods/LensToolOptions/LensToolOptions";

import { VanillaMenuWatcher } from "mods/VanillaMenuWatcher/VanillaMenuWatcher";
import { VanillaToolbarWatcher } from "mods/VanillaMenuWatcher/VanillaToolbarWatcher";
import { PickerMenuOpener } from "mods/VanillaMenuWatcher/PickerMenuOpener";

const register: ModRegistrar = (moduleRegistry) => {
  // The vanilla component resolver is a singleton that helps extrant and maintain components from game that were not specifically exposed.
  VanillaComponentResolver.setRegistry(moduleRegistry);

  // This repalaces the asset grid.
  moduleRegistry.extend("game-ui/game/components/asset-menu/asset-menu.tsx", "AssetMenu", RemoveVanillaAssetMenuComponent);
  moduleRegistry.extend("game-ui/game/components/tool-options/tool-options-panel.tsx", "ToolOptionsPanel", WrapToolOptionsPanel);

  // This adds the fint it and picker icons to the toolbar
  moduleRegistry.extend("game-ui/game/components/toolbar/top/toggles.tsx", "PhotoModeToggle", ToolbarIconComponent);

  // Add picker UI
  moduleRegistry.extend("game-ui/game/components/tool-options/mouse-tool-options/mouse-tool-options.tsx", "MouseToolOptions", PickerComponent);
  // Availability lives in the game's own bank now (cm-2xvs.15). Registered
  // after the Picker so both can push into the same panel.
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
  // Also renders nothing; opens the vanilla menu the picker asked for, since
  // toolbar.selectAssetMenu is a trigger only the UI can call.
  moduleRegistry.append("Game", PickerMenuOpener);

};

export default register;
