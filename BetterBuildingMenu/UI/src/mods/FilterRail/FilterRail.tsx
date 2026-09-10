import { Dropdown, DropdownItem, DropdownToggle, Scrollable, Tooltip } from "cs2/ui";
import { getModule } from "cs2/modding";
import { Theme } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
import classNames from "classnames";
import {
  RAIL_METRICS_ID,
  buildFilterRail,
  filterRailOptions,
  type RailFacetState,
} from "domain/filterRail";
import lockIcon from "images/lock.svg";
import unlockIcon from "images/unlock.svg";
import styles from "./filterRail.module.scss";

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");

/**
 * The game's in-game dropdown theme. cs2/ui's Dropdown defaults to the light
 * settings-screen look, which draws a white panel over the map; taking the
 * game's own theme also keeps its hover, focus and open states.
 */
const GameDropdownTheme: Theme | any = getModule(
  "game-ui/game/themes/game-dropdown.module.scss",
  "classes"
);

/**
 * The menu half of that theme, and only that half: whole, it also replaces the
 * toggle with a labeled chevron control and the rail's dimension icons become a
 * row of carets. The toggle's chrome comes from filterRail.module.scss instead.
 */
const GameDropdownMenuTheme = {
  dropdownMenu: GameDropdownTheme?.dropdownMenu,
  dropdownItem: GameDropdownTheme?.dropdownItem,
};

interface FilterRailProps {
  facets: RailFacetState | null | undefined;
  metricsActive: number;
  onToggleOption: (groupId: string, optionId: string) => void;
  renderMetrics: () => JSX.Element;
}

/** One icon per dimension. Popovers float, so a closed rail costs one row. */
const DIMENSION_ICONS: Record<string, string> = {
  buildingType: "Media/Game/Icons/Healthcare.svg",
  provenance: "coui://betterbuildingmenu/Icons/Colored/BaseGame.svg",
  // Our own padlock: "Media/Game/Icons/LockClosed.svg" does not exist, and an
  // invisible icon in a rail of icons reads as a filter that does not work.
  // It is the glyph the tiles use, so filter and filtered look alike.
  availability: lockIcon,
  dlc: "coui://betterbuildingmenu/Icons/Colored/BaseGame.svg",
  theme: "coui://betterbuildingmenu/Icons/Colored/HouseAlternative.svg",
  assetPack: "coui://betterbuildingmenu/Icons/Colored/StarFilled.svg",
  placement: "coui://betterbuildingmenu/Icons/Colored/Road.svg",
  extension: "coui://betterbuildingmenu/Icons/Colored/ServiceBuilding.svg",
  zone: "Media/Game/Icons/Zones.svg",
  [RAIL_METRICS_ID]: "coui://betterbuildingmenu/Icons/Standard/StarAll.svg",
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
            ? translate("Options.LABEL[BetterBuildingMenu.MetricFilters]", "Metric filters") ?? "Metric filters"
            : dimension.label;
          // buildFilterRail already worked this out against
          // RAIL_SEARCH_THRESHOLD.
          const searchable = dimension.needsSearch;
          const options = filterRailOptions(facets, dimension.id, "");
          // The icon only claims a state when exactly that one state is
          // selected; anything else falls back to the dimension's identity
          // mark, which claims nothing.
          const chosen = options.filter((option) => option.selected);
          const only = chosen.length === 1 ? chosen[0].id : "";
          const icon = dimension.id === "availability" && (only === "Locked" || only === "Unlocked")
            ? (only === "Unlocked" ? unlockIcon : lockIcon)
            : (DIMENSION_ICONS[dimension.id] ?? "");
          // The tooltip names the dimension when it is doing nothing, and names
          // what survives when it is. A count alone ("2") says how many boxes
          // are ticked, which is not the question the player has.
          const selectedLabels = options.filter((option) => option.selected).map((option) => option.label);
          const tooltip = dimension.selected > 0 && selectedLabels.length > 0
            ? `${label}: ${selectedLabels.join(", ")}`
            : label;

          return (
            <Dropdown
              key={dimension.id}
              theme={GameDropdownMenuTheme}
              // Opening a dropdown resets the search: `query` is one piece of
              // state shared by every dimension's menu, so a stale value would
              // otherwise leak from one dimension into the next.
              onToggle={(visible) => visible && setQuery("")}
              content={
                <div className={styles.menu}>
                  {searchable && (
                    <TextInput
                      className={styles.menuSearch}
                      value={query}
                      placeholder={translate("Tooltip.LABEL[BetterBuildingMenu.FilterOptions]", "Filter options…") ?? "Filter options…"}
                      onChange={setQuery}
                    />
                  )}
                  {dimension.id === RAIL_METRICS_ID ? (
                    renderMetrics()
                  ) : (
                    <Scrollable className={styles.menuList} vertical trackVisibility="scrollable">
                      {(searchable ? filterRailOptions(facets, dimension.id, query) : options).map((option) => (
                        // BOTH callbacks: the vanilla item dispatches a click
                        // as `selected ? onToggleSelected : onChange`, so one
                        // alone wires half a toggle. closeOnSelect multi-selects.
                        <DropdownItem<string>
                          key={option.id}
                          value={option.id}
                          selected={option.selected}
                          closeOnSelect={false}
                          onChange={() => onToggleOption(dimension.id, option.id)}
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
              <Tooltip tooltip={tooltip}>
                <DropdownToggle
                  className={classNames(styles.icon, dimension.selected > 0 && styles.iconActive)}
                  aria-label={label}
                >
                  <img src={icon} />
                  {dimension.selected > 0 && <span className={styles.badge}>{dimension.selected}</span>}
                </DropdownToggle>
              </Tooltip>
            </Dropdown>
          );
        })}

        {/* No Clear here: the chip row owns clearing and sits immediately to
            the right, so a second one would say it twice in one band. */}
      </div>
    </div>
  );
};
