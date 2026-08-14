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
import lockIcon from "images/findit_lock.svg";
import unlockIcon from "images/findit_unlock.svg";
import styles from "./filterRail.module.scss";

const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput");

/**
 * The game's in-game dropdown theme, rather than the default one.
 *
 * cs2/ui's Dropdown ships two looks and picks the light one unless told
 * otherwise: read off the shipped bundle, the default `dropdown-menu_rL4` is
 * `background:#fff` with a black border, which is the settings-screen control.
 * Opened over the map from the dark options bank it drew a solid white panel
 * with black text — the same mistake the toggles made before they were pinned
 * to the Theme row's chrome, one level deeper.
 *
 * `game-dropdown.module.scss` is the in-game one: `dropdown-menu_xq2` is
 * #0f1013 with a #3c404c border and a 3rem radius. Taking the game's own theme
 * rather than restyling the default keeps the hover, focus and open states we
 * would otherwise have to reimplement — .menu below has always claimed colour
 * and border came from here; until now nothing passed it.
 */
const GameDropdownTheme: Theme | any = getModule(
  "game-ui/game/themes/game-dropdown.module.scss",
  "classes"
);

/**
 * The menu half of that theme, and only that half.
 *
 * Passed whole, it also replaces the toggle — and its toggle is a labeled
 * control with an open/close chevron, not an icon button. On screen the rail's
 * eight dimension icons vanished and became a row of carets. The theme is a
 * Partial, so the keys left out here keep their defaults, which is what the
 * toggle wants: its chrome is already pinned to the Theme row's in
 * filterRail.module.scss.
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
  provenance: "coui://finditbuildingmenu/Icons/Colored/BaseGame.svg",
  // Our own padlock, not the game's. "Media/Game/Icons/LockClosed.svg" does
  // not exist — UI.log recorded seven "Asset not found" failures per session
  // for it (cm-p5gj), so this dimension has been drawing NOTHING since it was
  // added. An invisible icon in a rail of icons is indistinguishable from a
  // filter that does not work, which is how it was reported.
  //
  // The same glyph the tiles already use for a locked asset, so the filter and
  // the thing it filters on look like each other.
  availability: lockIcon,
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
          // buildFilterRail already worked this out against
          // RAIL_SEARCH_THRESHOLD. It used to go through railHomeFor, which
          // also decided whether the dimension belonged in the options bank
          // rather than here — a split that is gone, along with the bank.
          const searchable = dimension.needsSearch;
          const options = filterRailOptions(facets, dimension.id, "");
          // What the selector shows has to match what the menu is showing.
          // Reported from play: "it shows locked when only unlocked are shown"
          // — the dimension's icon was a closed padlock whatever the state, so
          // filtering to Unlocked left a lock on screen saying the opposite.
          //
          // Narrowed, the icon becomes the state it is showing. At rest it is
          // the dimension's identity mark and carries no claim, which is why
          // the closed padlock is fine there and not fine when narrowed.
          const icon = dimension.id === "availability" && dimension.selected > 0
            ? (options.some((option) => option.selected && option.id === "Unlocked") ? unlockIcon : lockIcon)
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
                      {(searchable ? filterRailOptions(facets, dimension.id, query) : options).map((option) => (
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

        {/* No Clear here any more. The chip row owns clearing, and it sits
            immediately to the right of this rail, so both rendered and the
            player saw "Clear filters" twice in one band. */}
      </div>
    </div>
  );
};
