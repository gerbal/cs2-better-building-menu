import { Dropdown, DropdownItem, DropdownToggle, Scrollable, Tooltip } from "cs2/ui";
import { getModule } from "cs2/modding";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
import classNames from "classnames";
import {
  RAIL_METRICS_ID,
  buildFilterRail,
  filterRailOptions,
  railHomeFor,
  type RailFacetState,
} from "domain/filterRail";
import styles from "./filterRail.module.scss";

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");

interface FilterRailProps {
  facets: RailFacetState | null | undefined;
  metricsActive: number;
  onToggleOption: (groupId: string, optionId: string) => void;
  renderMetrics: () => JSX.Element;
}

/** One icon per dimension. Popovers float, so a closed rail costs one row. */
const DIMENSION_ICONS: Record<string, string> = {
  buildingType: "Media/Game/Icons/Healthcare.svg",
  provenance: "coui://finditbuildingmenu/Icons/Colored/BaseGame.svg",
  availability: "Media/Game/Icons/LockClosed.svg",
  dlc: "coui://finditbuildingmenu/Icons/Colored/BaseGame.svg",
  theme: "coui://finditbuildingmenu/Icons/Colored/HouseAlternative.svg",
  assetPack: "coui://finditbuildingmenu/Icons/Colored/StarFilled.svg",
  placement: "coui://finditbuildingmenu/Icons/Colored/Road.svg",
  extension: "coui://finditbuildingmenu/Icons/Colored/ServiceBuilding.svg",
  zone: "Media/Game/Icons/Zones.svg",
  [RAIL_METRICS_ID]: "coui://finditbuildingmenu/Icons/Standard/StarAll.svg",
};

export const FilterRail = ({
  facets,
  metricsActive,
  onToggleOption,
  renderMetrics,
}: FilterRailProps) => {
  const { translate } = useLocalization();
  const [query, setQuery] = useState("");

  const rail = buildFilterRail(facets, { active: metricsActive });

  return (
    <div className={styles.rail}>
      <div className={styles.icons}>
        {rail.map((dimension) => {
          const label = dimension.id === RAIL_METRICS_ID
            ? translate("Options.LABEL[FindItBuildingMenu.MetricFilters]", "Metric filters") ?? "Metric filters"
            : dimension.label;
          const home = railHomeFor(dimension.optionCount);
          const searchable = home === "searchableDropdown";

          return (
            <Dropdown
              key={dimension.id}
              // Opening a dropdown resets the search: `query` is one piece of
              // state shared by every dimension's menu, so a stale value would
              // otherwise leak from one dimension into the next, or between
              // two searchable dropdowns opened in turn.
              onToggle={(visible) => visible && setQuery("")}
              content={
                <div className={styles.menu}>
                  {searchable && (
                    <TextInput
                      className={styles.menuSearch}
                      value={query}
                      placeholder={translate("Tooltip.LABEL[FindItBuildingMenu.FilterOptions]", "Filter options…") ?? "Filter options…"}
                      onChange={setQuery}
                    />
                  )}
                  {dimension.id === RAIL_METRICS_ID ? (
                    renderMetrics()
                  ) : (
                    <Scrollable className={styles.menuList} vertical trackVisibility="scrollable">
                      {filterRailOptions(facets, dimension.id, searchable ? query : "").map((option) => (
                        // closeOnSelect={false} is what makes a vanilla dropdown a
                        // multi-select control; onToggleSelected is its own API for it,
                        // so nothing here reimplements selection.
                        <DropdownItem<string>
                          key={option.id}
                          value={option.id}
                          selected={option.selected}
                          closeOnSelect={false}
                          onToggleSelected={() => onToggleOption(dimension.id, option.id)}
                        >
                          {option.label}
                        </DropdownItem>
                      ))}
                    </Scrollable>
                  )}
                </div>
              }
            >
              <Tooltip tooltip={label}>
                <DropdownToggle
                  className={classNames(styles.icon, dimension.selected > 0 && styles.iconActive)}
                  aria-label={label}
                >
                  <img src={DIMENSION_ICONS[dimension.id] ?? ""} />
                  {dimension.selected > 0 && <span className={styles.badge}>{dimension.selected}</span>}
                </DropdownToggle>
              </Tooltip>
            </Dropdown>
          );
        })}

        {/* No Clear here any more. The chip row owns clearing, and it sits
            immediately to the right of this rail, so both rendered and the
            player saw "Clear filters" twice in one band. */}
      </div>
    </div>
  );
};
