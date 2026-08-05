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

export const VIEW_MODES: readonly ViewModeOption[] = [
  { id: "grid", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewGrid]", fallback: "Grid" },
  { id: "list", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewList]", fallback: "List" },
  { id: "cards", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewCards]", fallback: "Cards" },
  { id: "table", localizationKey: "Tooltip.LABEL[FindItBuildingMenu.ViewTable]", fallback: "Table" },
];

interface ViewModeBarProps {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
  /** Modes this surface cannot render. Table has no zone equivalent. */
  omit?: readonly CatalogViewMode[];
}

/**
 * The Grid/List/Cards/Table control, shared by every surface that has one.
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
