import { bindValue, useValue } from "cs2/api";
import mod from "../../../mod.json";
import { ModuleRegistryExtend } from "cs2/modding";

// These establishes the binding with C# side.
const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel");
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked");
// True while the toolbar's open menu is one the lens takes over.
const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);

export const RemoveVanillaAssetMenuComponent: ModuleRegistryExtend = (Component) => {
  // I believe you should not put anything here.
  return (props) => {
    const { children, ...otherProps } = props || {};

    // These get the value of the bindings. Without C# side game ui will crash. Or they will when we have bindings.
    const IsWindowLocked = useValue(IsWindowLocked$);
    const ShowFindItPanel = useValue(ShowFindItPanel$);
    const LensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);

    // Do not put any Hooks (i.e. UseXXXX) after this point.
    //
    // Suppressing the vanilla grid after the panel closed was tried and
    // reverted. It fixed the cosmetic complaint — closing the lens revealed the
    // menu sitting underneath — but broke a working control: the game still had
    // that menu selected, so the next press of its toolbar button deselected it
    // and appeared to do nothing, making the zoning icon take two clicks. A
    // closing animation is worth less than a button that works.
    //
    // A real fix needs the game's menu selection cleared when the panel closes,
    // and ToolbarUISystem.SelectAssetMenu early-returns on Entity.Null — there
    // is no binding that does it. Left unsolved rather than papered over.
    if (ShowFindItPanel || IsWindowLocked) {
      return <></>;
    }

    return <Component {...otherProps}>{children}</Component>;
  };
};
