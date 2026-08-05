import { Button, Scrollable } from "cs2/ui";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import { useLocalization } from "cs2/l10n";
import { useState } from "react";
import classNames from "classnames";
import {
  RAIL_METRICS_ID,
  buildFilterRail,
  filterRailOptions,
  type RailFacetState,
} from "domain/filterRail";
import styles from "./filterRail.module.scss";

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
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rail = buildFilterRail(facets, { active: metricsActive });
  const openDimension = rail.find((dimension) => dimension.id === open);

  const toggleOpen = (id: string) => {
    setQuery("");
    setOpen((current) => (current === id ? null : id));
  };

  return (
    <div className={styles.rail}>
      <div className={styles.icons}>
        {rail.map((dimension) => {
          const label = dimension.id === RAIL_METRICS_ID
            ? translate("Options.LABEL[FindItBuildingMenu.MetricFilters]", "Metric filters") ?? "Metric filters"
            : dimension.label;

          return (
            // The game's own filter button, the one Theme and Pack are built
            // from, rather than a hand-styled lookalike sitting next to them in
            // the same panel. Sizing, hover and selected state all come from
            // the component.
            <VanillaComponentResolver.instance.ToolButton
              key={dimension.id}
              selected={dimension.selected > 0}
              tooltip={label}
              onSelect={() => toggleOpen(dimension.id)}
              src={DIMENSION_ICONS[dimension.id] ?? ""}
              focusKey={VanillaComponentResolver.instance.FOCUS_DISABLED}
              className={classNames(
                VanillaComponentResolver.instance.toolButtonTheme.button,
                styles.icon,
                open === dimension.id && styles.iconOpen
              )}
              aria-label={label}
            >
              {/* The badge is the only thing that has to be readable at a
                  glance: it answers "is anything filtered" without opening a
                  single popover. */}
              {dimension.selected > 0
                ? <span className={styles.badge}>{dimension.selected}</span>
                : <span />}
            </VanillaComponentResolver.instance.ToolButton>
          );
        })}

        {/* No Clear here any more. The chip row owns clearing, and it sits
            immediately to the right of this rail, so both rendered and the
            player saw "Clear filters" twice in one band. */}
      </div>

      {openDimension && (
        // Absolutely positioned: an open popover costs nothing in the layout,
        // which is the entire point of replacing the drawers.
        <div className={styles.popover}>
          <div className={styles.popoverHead}>
            <span className={styles.popoverTitle}>{openDimension.label}</span>
            <span className={styles.popoverCount}>{openDimension.optionCount}</span>
          </div>

          {openDimension.needsSearch && (
            <input
              className={styles.popoverSearch}
              type="text"
              value={query}
              placeholder={translate("Tooltip.LABEL[FindItBuildingMenu.FilterOptions]", "Filter options…") ?? "Filter options…"}
              onChange={(event) => setQuery((event.target as HTMLInputElement).value)}
            />
          )}

          {openDimension.id === RAIL_METRICS_ID ? (
            <div className={styles.popoverMetrics}>{renderMetrics()}</div>
          ) : (
            <Scrollable className={styles.popoverList} vertical trackVisibility="scrollable">
              {filterRailOptions(facets, openDimension.id, query).map((option) => (
                <Button
                  key={option.id}
                  className={classNames(styles.option, option.selected && styles.optionSelected)}
                  variant="icon"
                  onSelect={() => onToggleOption(openDimension.id, option.id)}
                  aria-label={option.label}
                >
                  <span className={styles.optionMark} aria-hidden="true">{option.selected ? "✓" : "○"}</span>
                  <span className={styles.optionLabel}>{option.label}</span>
                </Button>
              ))}
            </Scrollable>
          )}
        </div>
      )}
    </div>
  );
};
