import { ModuleRegistryExtend } from "cs2/modding";
import { bindValue, useValue } from "cs2/api";
import mod from "../../../mod.json";
import { OptionsPanelComponent } from "mods/OptionsPanel/OptionsPanel";
import { OptionSection } from "domain/ContentViewType";
import { tool } from "cs2/bindings";
import { findItSurfacePort } from "domain/findItSurfacePort";

const PickerOptionsList$ = bindValue<OptionSection[]>(mod.id, "PickerOptionsList");

export const PickerComponent: ModuleRegistryExtend = (Component: any) => {
  // I believe you should not put anything here.
  return (props) => {
    // This defines aspects of the components.
    const { children, ...otherProps } = props || {};
    const PickerOptionsList = useValue(PickerOptionsList$);

    // This gets the original component that we may alter and return.
    var result: JSX.Element = Component();

    function OnOptionClicked(x: number, y: number, z: number) {
      findItSurfacePort.pickerOption({ sectionId: x, optionId: y, value: z });
    }

    if (tool.activeTool$.value.id === "FindItBuildingMenu.Picker") {
      result.props.children?.push(<OptionsPanelComponent options={PickerOptionsList} OnChange={OnOptionClicked}></OptionsPanelComponent>);
    }

    return result;
  };
};
