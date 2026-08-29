import { bindValue, useValue } from "cs2/api";
import mod from "../../../mod.json";
import { ModuleRegistryExtend } from "cs2/modding";
import styles from "./WrapToolOptionsPanel.module.scss";

// These establishes the binding with C# side.
const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel");
const AlignmentStyle$ = bindValue<string>(mod.id, "AlignmentStyle");
const PanelWidth$ = bindValue<number>(mod.id, "PanelWidth");

export const WrapToolOptionsPanel: ModuleRegistryExtend = (Component) => {
  // I believe you should not put anything here.
  return (props) => {
    const { children, ...otherProps } = props || {};

    // These get the value of the bindings. Without C# side game ui will crash. Or they will when we have bindings.
    const ShowFindItPanel = useValue(ShowFindItPanel$);
    const AlignmentStyle = useValue(AlignmentStyle$);
    const PanelWidth = useValue(PanelWidth$) + 15 + 20 + 20 + 15;

    // Do not put any Hooks (i.e. UseXXXX) after this point.
    // IsWindowLocked was ORed in here. Nothing can set it any more — its only
    // control was TopBar's lock button, deleted with the shell — so the binding
    // went and this reads the one flag that still moves.
    if (!ShowFindItPanel || AlignmentStyle === "Center") {
      return <Component {...otherProps}>{children}</Component>;
    }

    return (
      <div
        className={styles.wrapper}
        style={
          AlignmentStyle === "Right"
            ? { alignItems: "flex-end", paddingRight: PanelWidth + "rem" }
            : { alignItems: "flex-start", paddingLeft: PanelWidth - 20 + "rem" }
        }
      >
        <Component {...otherProps}>{children}</Component>
      </div>
    );
  };
};
