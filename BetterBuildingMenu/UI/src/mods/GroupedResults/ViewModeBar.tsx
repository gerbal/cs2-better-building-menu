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
 * Where the asset menu opens, and what "Reset menu" goes back to. ONE constant, so
 * moving the default cannot leave the catalog, the view bar and Reset
 * disagreeing about which mode that is.
 */
export const DEFAULT_VIEW_MODE: CatalogViewMode = "cards";

/**
 * The order the control draws them in: most picture to most data, so moving
 * along the row trades thumbnail for numbers in one direction, with the
 * default at the end you start from.
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
  /** Modes this list cannot render. Table has no zone equivalent. */
  omit?: readonly CatalogViewMode[];
}

/**
 * The Cards/List/Grid/Table control, shared by every list that has one, so
 * the same results carry the same affordances however they were reached. On
 * the vanilla ToolButton, so the selected state is the game's.
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
