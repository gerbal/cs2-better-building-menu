import { useValue } from "cs2/api";

import { getAssetMenuSortPresentation, type AssetMenuSortChoice } from "domain/assetMenuSortPresentation";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { BuildingCatalog$, BuildingCatalogSortColumn$, BuildingCatalogSortDescending$, sendSort } from "mods/bindings";
import { PickerRow } from "./PickerRow";
import styles from "./pickerList.module.scss";

export interface SortOptions {
  column: SortColumn;
  /** The current sort's name. */
  current: string;
  /** Its direction, ▲ or ▼. */
  indicator: string;
  options: AssetMenuSortChoice[];
  pick: (column: SortColumn) => void;
}

/** The sorts this menu's results can use, the current one and its direction, and the pick that sends one. */
export function useSortOptions(): SortOptions {
  const column = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  // Only for which sorts can move these results: see BuildingCatalogPage.
  const page = useValue(BuildingCatalog$);
  const presentation = getAssetMenuSortPresentation({ column, descending }, page?.reorderableSortColumns ?? []);

  return {
    column,
    current: presentation.compact.label,
    indicator: presentation.compact.indicator,
    options: presentation.expanded,
    pick: (next) => sendSort({ column, descending }, next),
  };
}

/**
 * SORT's list, in a popover or the control pane: Default, then the sorts that can move this menu's
 * rows; the current one lit with its direction, which picking it again flips.
 */
export const SortList = ({ onPicked }: { onPicked: () => void }) => {
  const sort = useSortOptions();

  return (
    <div className={styles.list}>
      {sort.options.map((option) => (
        <PickerRow
          key={option.key}
          label={option.label}
          lit={option.selected}
          note={option.selected ? sort.indicator : undefined}
          onSelect={() => {
            sort.pick(option.key);
            onPicked();
          }}
        />
      ))}
    </div>
  );
};
