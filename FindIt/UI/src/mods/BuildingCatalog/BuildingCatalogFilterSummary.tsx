import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import mod from "../../../mod.json";
import {
  clearBuildingLensFiltersCommand,
  getBuildingLensFilterSummary,
  type BuildingLensMetricRangeState,
} from "domain/buildingLensFilterSummary";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import styles from "./buildingCatalog.module.scss";

const BuildingLensFacets$ = bindValue<BuildingLensFacetState>(mod.id, "BuildingLensFacets");
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState>(mod.id, "BuildingCatalogMetricRanges");
const BuildingLensLegacyFilters$ = bindValue<string[]>(mod.id, "BuildingLensLegacyFilters");

export const BuildingCatalogFilterSummary = () => {
  const { translate } = useLocalization();
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const legacyFilters = useValue(BuildingLensLegacyFilters$);
  const summary = getBuildingLensFilterSummary({ facets, metricRanges, legacyFilters });

  return (
    <div className={styles.capacityFilter} data-filter-summary="true" data-active-count={summary.count}>
      <span className={styles.capacityFilterLabel}>{summary.text}</span>
      {summary.details.map((detail) => (
        <span className={styles.facetOptionLabel} key={detail}>{detail}</span>
      ))}
      {summary.lensCount > 0 && (
        <Button
          className={styles.facetClear}
          variant="icon"
          onSelect={() => {
            const command = clearBuildingLensFiltersCommand();
            trigger(mod.id, command.method, ...command.args);
          }}
        >
          {translate("Tooltip.LABEL[FindItBuildingMenu.ClearLensFilters]", "Clear lens filters")}
        </Button>
      )}
    </div>
  );
};
