import { useValue } from "cs2/api";
import { Button, Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";

import panelRight from "images/panel-right.svg";
import panelRightOff from "images/panel-right-off.svg";
import { buildFilterChips, removableChipCount } from "domain/filterChips";
import { AssetMenuFacets$, BuildingCatalogMetricRanges$ } from "mods/bindings";
import styles from "mods/ControlPaneToggle/controlPaneToggle.module.scss";

export interface ControlPaneToggleProps {
  shown: boolean;
  /** Filters on, counted as the pane counts its removable chips. */
  filterCount: number;
  onToggle: () => void;
}

/**
 * Shows and hides the control pane. It lives in the build menu rather than the
 * pane, so it is there while the pane is hidden, and its look and place change
 * here alone.
 */
export const ControlPaneToggle = ({ shown, filterCount, onToggle }: ControlPaneToggleProps) => {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;

  const action = shown
    ? label("Tooltip.LABEL[BetterBuildingMenu.HideOptions]", "Hide options")
    : label("Tooltip.LABEL[BetterBuildingMenu.ShowOptions]", "Show options");
  const filters = filterCount === 1
    ? label("Tooltip.LABEL[BetterBuildingMenu.FilterOnCount]", "1 filter on")
    : label("Tooltip.LABEL[BetterBuildingMenu.FiltersOnCount]", "{0} filters on").replace("{0}", String(filterCount));
  const description = filterCount > 0 ? `${action} (${filters})` : action;

  return (
    <Tooltip tooltip={description}>
      <Button
        className={styles.toggle}
        variant="round"
        aria-label={description}
        aria-pressed={shown}
        onSelect={onToggle}
      >
        <img className={styles.glyph} style={{ maskImage: `url(${shown ? panelRight : panelRightOff})` }} alt="" aria-hidden="true" />
        {filterCount > 0 && <span className={styles.badge} aria-hidden="true">{filterCount}</span>}
      </Button>
    </Tooltip>
  );
};

/** The filters on now: the chips the pane would show as removable. */
export function useActiveFilterCount(): number {
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);

  return removableChipCount(buildFilterChips({ facets, metricRanges }));
}
