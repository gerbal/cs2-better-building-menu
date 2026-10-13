import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import type { CatalogViewMode } from "./GroupedResults";
import styles from "./groupedResults.module.scss";
import { VIEW_MODES } from "domain/viewModeChoice";

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
