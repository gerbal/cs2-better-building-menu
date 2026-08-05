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
    // The last clause is why closing the lens no longer reveals a second menu.
    // This component only hid the vanilla grid while the panel was up, so
    // closing un-hid a menu that had been sitting underneath the whole time and
    // the armed tool gave it something to show — "close" read as "swap".
    //
    // Scoped to menus the lens actually takes over: Landscaping and Areas are
    // declined, and hiding those would leave the player with nothing at all.
    if (ShowFindItPanel || IsWindowLocked || LensOwnsCurrentMenu) {
      return <></>;
    }

    return <Component {...otherProps}>{children}</Component>;
  };
};
