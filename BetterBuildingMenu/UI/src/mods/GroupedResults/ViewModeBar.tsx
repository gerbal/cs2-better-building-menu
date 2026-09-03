import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import type { CatalogViewMode } from "./GroupedResults";
import styles from "./groupedResults.module.scss";

export interface ViewModeOption {
  id: CatalogViewMode;
  localizationKey: string;
  fallback: string;
}

/**
 * Where the lens opens, and what "Reset menu" goes back to.
 *
 * ONE constant, because this was three literals and moving the default moved
 * one of them: the catalog rendered cards while the view bar highlighted grid
 * and Reset put you back to grid.
 *
 * Cards keep the thumbnail the grid was defaulted for, at a larger size, add
 * footprint and cost, and never truncate a name — which is the whole problem
 * the tile's character budget exists to manage.
 */
export const DEFAULT_VIEW_MODE: CatalogViewMode = "cards";

/**
 * The order the control draws them in.
 *
 * Cards first, because that is where the lens opens. The row then runs from
 * the most picture to the most data — cards, list, grid, table — so moving
 * along it trades thumbnail for numbers in one direction rather than jumping
 * about, and the default sits at the end you start from rather than in the
 * middle of the row.
 */
export const VIEW_MODES: readonly ViewModeOption[] = [
  { id: "cards", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewCards]", fallback: "Cards" },
  { id: "list", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewList]", fallback: "List" },
  { id: "grid", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewGrid]", fallback: "Grid" },
  { id: "table", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewTable]", fallback: "Table" },
];

interface ViewModeBarProps {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
  /** Modes this surface cannot render. Table has no zone equivalent. */
  omit?: readonly CatalogViewMode[];
}

/**
 * The Cards/List/Grid/Table control, shared by every surface that has one.
 *
 * Zoning had no view control at all: it inherited whatever the catalog was
 * last set to and gave the player no way to change it from where they were
 * standing. The same set of results deserves the same affordances however you
 * arrived at it, so this is one component rather than markup the catalog owns.
 *
 * Built from the vanilla ToolButton the game's own Pack and Theme filters use,
 * so the selected state is the game's rather than a hand-styled lookalike.
 */
export const ViewModeBar = ({ value, onChange, omit = [] }: ViewModeBarProps) => {
  const { translate } = useLocalization();

  return (
    <div className={styles.viewModes}>
      {VIEW_MODES.filter((option) => !omit.includes(option.id)).map((option) => {
        const label = translate(option.localizationKey, option.fallback) ?? option.fallback;

        return (
          <VanillaComponentResolver.instance.ToolButton
            key={option.id}
            selected={option.id === value}
            tooltip={label}
            onSelect={() => onChange(option.id)}
            src=""
            focusKey={VanillaComponentResolver.instance.FOCUS_DISABLED}
            className={classNames(
              VanillaComponentResolver.instance.toolButtonTheme.button,
              styles.viewMode,
              option.id === value && styles.viewModeSelected
            )}
          >
            <span className={styles.viewModeLabel}>{label}</span>
          </VanillaComponentResolver.instance.ToolButton>
        );
      })}
    </div>
  );
};
