import { bindValue, useValue } from "cs2/api";
import { game } from "cs2/bindings";
import mod from "../../../mod.json";
import { ModuleRegistryExtend } from "cs2/modding";
import { BuildingMenuSurface } from "mods/BuildingMenu/BuildingMenuSurface";
import { shouldMountInAssetMenu } from "domain/buildingMenuMount";

// These establishes the binding with C# side.
const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel");
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked");
// True while the toolbar's open menu is one the lens takes over.
const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);
const BuildingLensEnabled$ = bindValue<boolean>(mod.id, "BuildingLensEnabled", false);

export const RemoveVanillaAssetMenuComponent: ModuleRegistryExtend = (Component) => {
  // I believe you should not put anything here.
  return (props) => {
    const { children, ...otherProps } = props || {};

    // These get the value of the bindings. Without C# side game ui will crash. Or they will when we have bindings.
    const IsWindowLocked = useValue(IsWindowLocked$);
    const ShowFindItPanel = useValue(ShowFindItPanel$);
    const LensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);
    const BuildingLensEnabled = useValue(BuildingLensEnabled$);
    const isPhotoMode = useValue(game.activeGamePanel$)?.__Type == game.GamePanelType.PhotoMode;

    // Do not put any Hooks (i.e. UseXXXX) after this point.

    // Phase 2: when the menu the toolbar has open is one we stand in for, we
    // ARE the asset menu rather than something drawn over the hole where it
    // used to be. The game mounts and unmounts this on its own menu lifecycle,
    // which is what makes the vacate-and-vanilla-redraws-behind-us problem
    // unstateable — there is no gap for it to draw into.
    //
    // The condition is shared with MainContainer rather than restated, so the
    // two can never both draw or both decline. See buildingMenuMount.
    //
    // This branch is deliberately first and deliberately narrow. Every other
    // path below still behaves exactly as it did, so the legacy panel keeps
    // working while the surfaces that feed it are retired one at a time.
    if (shouldMountInAssetMenu({
      lensOwnsCurrentMenu: LensOwnsCurrentMenu,
      buildingLensEnabled: BuildingLensEnabled,
      showFindItPanel: ShowFindItPanel,
      isWindowLocked: IsWindowLocked,
      isPhotoMode,
    })) {
      // onClose is the game's own close, and the only route to clearing the
      // toolbar selection. Handed straight down rather than read anywhere else,
      // because this is the one place it exists.
      return <BuildingMenuSurface />;
    }

    // Suppressing the vanilla grid after the panel closed was tried and
    // reverted. It fixed the cosmetic complaint — closing the lens revealed the
    // menu sitting underneath — but broke a working control: the game still had
    // that menu selected, so the next press of its toolbar button deselected it
    // and appeared to do nothing, making the zoning icon take two clicks. A
    // closing animation is worth less than a button that works.
    //
    // The note that used to sit here said the real fix "needs the game's menu
    // selection cleared when the panel closes, and ToolbarUISystem.SelectAssetMenu
    // early-returns on Entity.Null — there is no binding that does it".
    //
    // That was wrong about the binding. ToolbarUISystem exposes
    // `toolbar.clearAssetSelection`, whose C# side applies Entity.Null to the
    // menu, the category AND the asset; CloseLens has been calling the C#
    // method for a while. What was actually missing was a close CONTROL — this
    // mode hides the top bar row the legacy X lives in.
    //
    // The branch above is now handed `onClose` from the extension point's own
    // props, which is the natural close for a component standing in as the
    // asset menu and needs no round trip through C#.
    if (ShowFindItPanel || IsWindowLocked) {
      return <></>;
    }

    return <Component {...otherProps}>{children}</Component>;
  };
};
