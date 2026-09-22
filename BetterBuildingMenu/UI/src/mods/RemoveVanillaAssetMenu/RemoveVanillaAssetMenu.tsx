import { useValue } from "cs2/api";
import { game } from "cs2/bindings";
import { ModuleRegistryExtend } from "cs2/modding";
import { BuildingMenuSurface } from "mods/BuildingMenu/BuildingMenuSurface";
import { shouldMountInAssetMenu } from "domain/buildingMenuMount";
import { FindItPanelShown$, LensOwnsCurrentMenu$ } from "mods/bindings";

export const RemoveVanillaAssetMenuComponent: ModuleRegistryExtend = (Component) => {
  // I believe you should not put anything here.
  return (props) => {
    const { children, ...otherProps } = props || {};

    const LensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);
    const findItPanelShown = useValue(FindItPanelShown$) === true;
    const isPhotoMode = useValue(game.activeGamePanel$)?.__Type == game.GamePanelType.PhotoMode;

    // Do not put any Hooks (i.e. UseXXXX) after this point.

    // When the toolbar's open menu is one we stand in for, we ARE the asset
    // menu rather than something drawn over the hole, so vanilla has no gap to
    // redraw into. The condition lives in buildingMenuMount, where it is tested.
    if (shouldMountInAssetMenu({ lensOwnsCurrentMenu: LensOwnsCurrentMenu, isPhotoMode, findItPanelShown })) {
      // onClose is the game's own menu close: it clears the toolbar selection,
      // so the panel goes with no vanilla grid behind it and the button unlit.
      // The extension point's own prop needs no round trip through C#.
      return <BuildingMenuSurface onClose={otherProps.onClose} />;
    }

    // Photo mode is the one case where we own the menu and decline to draw it,
    // so the one case where vanilla's grid could appear in the space ours left.
    // The player asked for a clean frame, not for a different menu.
    if (isPhotoMode && LensOwnsCurrentMenu) {
      return <></>;
    }

    return <Component {...otherProps}>{children}</Component>;
  };
};
