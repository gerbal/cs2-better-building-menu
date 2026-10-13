import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";

import { groupDimensionLabel, groupDimensionsFor, type GroupDimensionId } from "domain/buildingGroups";
import { AssetMenuGroupDimensions$, BuildingCatalogGroupBy$, send } from "mods/bindings";
import { PickerRow } from "./PickerRow";
import styles from "./pickerList.module.scss";

export interface GroupOption {
  id: GroupDimensionId;
  label: string;
  selected: boolean;
}

/** The groupings that can act on this menu, its own lit, and the pick that sends one. */
export function useGroupOptions(): { current: string; options: GroupOption[]; pick: (id: GroupDimensionId) => void } {
  const { translate } = useLocalization();
  // C# judges which can act on the menu; an empty list means it has not said yet.
  const offered = useValue(AssetMenuGroupDimensions$) ?? [];
  // Resolved on the C# side: the player's choice, or the menu's default.
  const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;
  const labelOf = (id: GroupDimensionId) =>
    translate(`Tooltip.LABEL[BetterBuildingMenu.GroupBy_${id}]`, groupDimensionLabel(id)) ?? groupDimensionLabel(id);

  return {
    current: labelOf(groupBy),
    options: groupDimensionsFor(offered).map((dimension) => ({ id: dimension.id, label: labelOf(dimension.id), selected: dimension.id === groupBy })),
    pick: (id) => send({ method: "SetBuildingCatalogGroupBy", args: [id] }),
  };
}

/** GROUP's list, in a popover or the control pane: the groupings this menu offers, its own lit. */
export const GroupList = ({ onPicked }: { onPicked: () => void }) => {
  const group = useGroupOptions();

  return (
    <div className={styles.list}>
      {group.options.map((option) => (
        <PickerRow
          key={option.id}
          label={option.label}
          lit={option.selected}
          onSelect={() => {
            group.pick(option.id);
            onPicked();
          }}
        />
      ))}
    </div>
  );
};
