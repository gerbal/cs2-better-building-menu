import { bindValue, trigger, useValue } from "cs2/api";
import { ModuleRegistryExtend } from "cs2/modding";
import { useLocalization } from "cs2/l10n";
import { Button } from "cs2/ui";
import classNames from "classnames";
import mod from "../../../mod.json";
import { buildFilterChips, removableChipCount } from "domain/filterChips";
import { clearBuildingLensFiltersCommand } from "domain/buildingLensFilterSummary";
import { toggleBuildingLensFacetCommand } from "domain/buildingCatalogFacets";
import { countActiveMetricRanges } from "domain/filterRail";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "domain/buildingLensFilterSummary";
import { FilterRail } from "mods/FilterRail/FilterRail";
import { BuildingCatalogMetricFilters } from "mods/BuildingCatalog/BuildingCatalogMetricFilters";
import styles from "./lensToolOptions.module.scss";

const ShowFindItPanel$ = bindValue<boolean>(mod.id, "ShowFindItPanel", false);
const BuildingLensEnabled$ = bindValue<boolean>(mod.id, "BuildingLensEnabled", false);
const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState | null>(
  mod.id,
  "BuildingCatalogMetricRanges",
  null
);
const ShowZoningHierarchy$ = bindValue<boolean>(mod.id, "ShowZoningHierarchy", false);
const BuildingLensZoneFamilies$ = bindValue<string[]>(mod.id, "BuildingLensZoneFamilies", []);

/**
 * The lens's narrowing controls, rendered into the game's own options bank.
 *
 * Filters belong where the game already puts filters. The tool-options panel is
 * that place: Theme and Pack live there as a label and a row of icon buttons,
 * which is exactly the shape a facet dimension wants. Keeping our own band for
 * them meant the player learned two idioms for one job.
 *
 * The chips come too. They are the record of what the navigation did — clicking
 * Healthcare arrives as chips you can read and drop — and separating the record
 * from the controls would leave each half explaining the other from across the
 * screen.
 *
 * The panel keeps the breadcrumbs: those answer "what am I looking at", which
 * is identity rather than narrowing, and belongs with the results.
 */
export const LensToolOptions = () => {
  const { translate } = useLocalization();

  const showPanel = useValue(ShowFindItPanel$);
  const lensEnabled = useValue(BuildingLensEnabled$);
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const showZoning = useValue(ShowZoningHierarchy$);
  const zoneFamilies = useValue(BuildingLensZoneFamilies$) ?? [];

  if (!showPanel || !lensEnabled) {
    return null;
  }

  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const familyLabel = (id: string) =>
    translate(`Tooltip.LABEL[FindItBuildingMenu.Zoning_${id}]`, id) ?? id;

  const chips = buildFilterChips({
    zoneFamilies: showZoning ? zoneFamilies.map((id) => ({ id, label: familyLabel(id) })) : null,
    facets,
    metricRanges,
  });

  const fire = (command: { method: string; args: readonly any[] }) =>
    trigger(mod.id, command.method, ...command.args);

  const clearLabel = label("Tooltip.LABEL[FindItBuildingMenu.ClearFilters]", "Clear filters");

  return (
    <>
      <div className={styles.item}>
        <div className={styles.label}>
          {label("Tooltip.LABEL[FindItBuildingMenu.Filters]", "Filters")}
        </div>
        <div className={styles.content}>
          <FilterRail
            facets={facets}
            metricsActive={countActiveMetricRanges(metricRanges as unknown as Record<string, unknown>)}
            onToggleOption={(groupId, optionId) => fire(toggleBuildingLensFacetCommand(groupId, optionId))}
            renderMetrics={() => <BuildingCatalogMetricFilters />}
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className={classNames(styles.item, styles.itemChips)}>
          <div className={styles.label}>
            {label("Tooltip.LABEL[FindItBuildingMenu.ActiveFilters]", "Active")}
          </div>
          <div className={styles.content}>
            {chips.map((chip) => (
              <div className={styles.chip} key={chip.id}>
                <span className={styles.chipText}>{chip.label}</span>
                <Button
                  className={styles.chipRemove}
                  variant="icon"
                  onSelect={() => chip.remove && fire(chip.remove)}
                  aria-label={`${label("Tooltip.LABEL[FindItBuildingMenu.Remove]", "Remove")} ${chip.label}`}
                >
                  ×
                </Button>
              </div>
            ))}
            {removableChipCount(chips) > 1 && (
              <Button
                className={styles.clearAll}
                variant="icon"
                onSelect={() => fire(clearBuildingLensFiltersCommand())}
                aria-label={clearLabel}
                title={clearLabel}
              >
                {clearLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Injects the rows into the game's options bank.
 *
 * The vanilla panel builds its own children from tool bindings and ignores any
 * passed in, so the rows have to be pushed onto the element it returns — the
 * same way the Picker adds its own section. Discovered by passing children
 * first and getting an 8px empty panel.
 */
export const LensToolOptionsExtend: ModuleRegistryExtend = (Component: any) => {
  return (props: any) => {
    const result: JSX.Element = Component(props);

    // The panel renders nothing at all for a tool with no options, in which
    // case there is no element to extend and the lens keeps its own row.
    if (result?.props?.children && Array.isArray(result.props.children)) {
      result.props.children.push(<LensToolOptions key="findit-lens-options" />);
    }

    return result;
  };
};
