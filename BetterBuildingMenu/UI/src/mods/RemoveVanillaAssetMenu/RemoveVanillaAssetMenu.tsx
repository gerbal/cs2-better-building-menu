import { useValue } from "cs2/api";
import { game } from "cs2/bindings";
import { ModuleRegistryExtend } from "cs2/modding";
import { AssetMenuSlot, useKeptAssetMenuFailed } from "mods/BuildingMenu/KeptAssetMenu";
import { shouldMountInAssetMenu } from "domain/buildingMenuMount";
import { ownedMenuName, ownsSelectedMenu } from "domain/menuOwnership";
import { toolbarEntityIndex } from "domain/vanillaMenuWatch";
import { FindItPanelShown$, OwnedAssetMenus$, OwnsCurrentMenu$, ReplaceVanillaBuildMenu$, SelectedAssetMenu$ } from "mods/bindings";

export const RemoveVanillaAssetMenuComponent: ModuleRegistryExtend = (Component) => {
  // I believe you should not put anything here.
  return function AssetMenuOrOurs(props) {
    const { children, ...otherProps } = props || {};

    const OwnsCurrentMenu = useValue(OwnsCurrentMenu$);
    const findItPanelShown = useValue(FindItPanelShown$) === true;
    const isPhotoMode = useValue(game.activeGamePanel$)?.__Type == game.GamePanelType.PhotoMode;
    const keptMenuFailed = useKeptAssetMenuFailed();
    const replaceEnabled = useValue(ReplaceVanillaBuildMenu$);
    const selectedIndex = toolbarEntityIndex(useValue(SelectedAssetMenu$));
    const owned = useValue(OwnedAssetMenus$);

    // Do not put any Hooks (i.e. UseXXXX) after this point.

    // Decided here, in the frame the game opens the menu, from the menus C# lists as
    // ones it takes over: waiting for OwnsCurrentMenu would leave vanilla's grid up for
    // a frame and the asset menu a frame late. See domain/menuOwnership.
    const ownsMenu = ownsSelectedMenu({ replaceEnabled, ownsCurrentMenu: OwnsCurrentMenu, selectedIndex, owned });

    // When the toolbar's open menu is one we stand in for, we ARE the asset
    // menu rather than something drawn over the hole, so vanilla has no gap to
    // redraw into. The condition lives in buildingMenuMount, where it is tested.
    if (!keptMenuFailed && shouldMountInAssetMenu({ ownsCurrentMenu: ownsMenu, isPhotoMode, findItPanelShown })) {
      // onClose is the game's own menu close: it clears the toolbar selection,
      // so the asset menu goes with no vanilla grid behind it and the button unlit.
      // The extension point's own prop needs no round trip through C#.
      // The menu itself is kept built in KeptAssetMenu and moves in here.
      return <AssetMenuSlot onClose={otherProps.onClose} menu={ownedMenuName(selectedIndex, owned)} />;
    }

    // Photo mode is the one case where we own the menu and decline to draw it,
    // so the one case where vanilla's grid could appear in the space ours left.
    // The player asked for a clean frame, not for a different menu.
    if (isPhotoMode && ownsMenu) {
      return <></>;
    }

    return <Component {...otherProps}>{children}</Component>;
  };
};
