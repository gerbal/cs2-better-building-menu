import style from "./ToolbarIcon.module.scss";
import { useValue, trigger, bindValue } from "cs2/api";
import { Theme, tool } from "cs2/bindings";
import { getModule, ModuleRegistryExtend } from "cs2/modding";
import { Button } from "cs2/ui";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import mod from "../../../mod.json";
import PickerIconSrc from "images/PickerPicker.svg";
import classNames from "classnames";

const PickerActive$ = bindValue<boolean>(mod.id, "PickerActive");

// Getting the vanilla theme css for compatibility
const ToolBarButtonTheme: Theme | any = getModule(
  "game-ui/game/components/toolbar/components/feature-button/toolbar-feature-button-new.module.scss",
  "classes"
);
// Getting the vanilla theme css for compatibility
const ToolBarTheme: Theme | any = getModule("game-ui/game/components/toolbar/toolbar.module.scss", "classes");
const EditorButtonTheme: Theme | any = getModule("game-ui/editor/themes/editor-tool-button.module.scss", "classes");

// Trigger Icon Click on the C# side
function HandlePickerClick() {
  trigger(mod.id, "PickerIconToggled");
}

/**
 * Our toolbar buttons: the picker, and nothing else.
 *
 * The magnifier that opened a standalone asset browser is gone. The product
 * decision that removed it, settled 2026-08-09: "There is no one standalone
 * entry point, just the-menu-you-opened." This is a build menu, so it appears
 * when you open a build menu, and a floating browser of every asset is the
 * thing we said we would not try to beat FindIt at.
 *
 * It also settles half of a coexistence problem (cm-wf6g.4): a player running
 * both mods had two visually identical magnifiers side by side in the same
 * toolbar, and only one of them was FindIt's.
 *
 * The picker stays. "What is this building I am looking at, and what does it
 * cost" is our sentence, not FindIt's.
 */
export const ToolbarIconComponent: ModuleRegistryExtend = (Component) => {
  return (props) => {
    const { children, ...otherProps } = props || {};
    const PickerActive = useValue(PickerActive$); // Get if your tool is active

    return (
      <>
        <Button
          src={PickerIconSrc}
          className={classNames(ToolBarButtonTheme.button, style.ToolbarIcon, PickerActive && style.selected)}
          variant="icon"
          focusKey={VanillaComponentResolver.instance.FOCUS_DISABLED}
          selected={PickerActive}
          onSelect={HandlePickerClick}
        ></Button>

        <div className={ToolBarTheme.divider}></div>

        <Component {...otherProps}></Component>
      </>
    );
  };
};
