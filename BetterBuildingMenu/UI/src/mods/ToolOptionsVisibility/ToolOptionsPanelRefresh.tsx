import { ModuleRegistryExtend } from "cs2/modding";
import { useValue } from "cs2/api";
import { forwardRef, useRef, useState } from "react";
import { OwnedAssetMenus$, OwnsCurrentMenu$, ReplaceVanillaBuildMenu$, SelectedAssetMenu$ } from "mods/bindings";
import { gameModule } from "mods/gameModules";
import { assetMenuOwnsMenu, type ToolOptionsVisibleHook } from "./ToolOptionsVisibility";

const alwaysVisible: ToolOptionsVisibleHook = () => true;

/**
 * Re-renders the vanilla tool options panel whenever asset menu ownership changes,
 * so the hook-free ToolOptionsVisibility reads a fresh value. A component of
 * our own can subscribe freely: a swap of the panel's type remounts it.
 *
 * The game mounts the panel from its main screen, which asks useToolOptionsVisible
 * only when it re-renders itself, and closing the asset menu does not re-render it.
 * So a panel the asset menu held up draws nothing once the hook says hidden, rather
 * than staying on screen empty. One a game tool held up is left to the game, which
 * closes it with vanilla's transition.
 */
export const ToolOptionsPanelRefresh: ModuleRegistryExtend = (Component: any) => {
  const Refresh = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    // Everything ToolOptionsVisibility decides ownership from.
    useValue(OwnsCurrentMenu$);
    useValue(OwnedAssetMenus$);
    useValue(ReplaceVanillaBuildMenu$);
    useValue(SelectedAssetMenu$);

    // The game's hook as extended by ToolOptionsVisibility, the one the main screen asks.
    // Read once per mount: a mod extending it later would change the hooks this calls.
    const [useToolOptionsVisible] = useState(() =>
      gameModule<ToolOptionsVisibleHook>("game-ui/game/components/tool-options/tool-options-panel.tsx", "useToolOptionsVisible") ?? alwaysVisible);
    const visible = useToolOptionsVisible();
    const heldByAssetMenu = useRef(false);

    if (visible) {
      heldByAssetMenu.current = assetMenuOwnsMenu();
    } else if (heldByAssetMenu.current) {
      return null;
    }

    return <Component {...props} ref={ref} />;
  });

  // The registry's type wants a plain function component; forwardRef's
  // exotic component renders the same way.
  return Refresh as unknown as (props: unknown) => JSX.Element;
};
