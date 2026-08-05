import { bindValue, trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Button, Scrollable, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useState } from "react";
import mod from "../../../mod.json";
import { buildFilterChips, removableChipCount } from "domain/filterChips";
import { clearBuildingLensFiltersCommand } from "domain/buildingLensFilterSummary";
import { toggleBuildingLensFacetCommand } from "domain/buildingCatalogFacets";
import { lensSectionCommand, lensSubCategoryCommand, type VanillaBuildMenuTab } from "domain/vanillaBuildMenuContracts";
// The flat-state counter, not the NormalizedMetricRange one of the same name
// in buildingCatalogRanges — the binding publishes min/max as sibling fields.
import { countActiveMetricRanges } from "domain/filterRail";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "domain/buildingLensFilterSummary";
import { FilterRail } from "mods/FilterRail/FilterRail";
import { BuildingCatalogMetricFilters } from "mods/BuildingCatalog/BuildingCatalogMetricFilters";
import styles from "./chipRow.module.scss";

/**
 * The single band that says how the result set has been narrowed.
 *
 * It replaces four stacked selector bands — mode, scope, category, family —
 * that together cost 142px of a 625px panel. Three of them were filters drawn
 * as tab strips, which meant a permanent band per dimension and no way to ask
 * for two values at once.
 *
 * Reading order is deliberate: breadcrumbs first (what the navigation set),
 * then the rail opener, then the filters the player added. Which is also why
 * this sits between the top bar and the content rather than in a drawer — it is
 * the visible record of what the vanilla toolbar did to the catalog.
 */

const SUBCATEGORY_ANY = "Any";

const BuildingLensSection$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");
const BuildingLensSubCategory$ = bindValue<string>(mod.id, "BuildingLensSubCategory", "Any");
const BuildingLensSectionList$ = bindValue<VanillaBuildMenuTab[]>(mod.id, "BuildingLensSectionList", []);
const BuildingLensSubCategoryList$ = bindValue<VanillaBuildMenuTab[]>(mod.id, "BuildingLensSubCategoryList", []);
const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState | null>(
  mod.id,
  "BuildingCatalogMetricRanges",
  null
);

type PickerId = "section" | "subCategory" | null;

export const ChipRow = () => {
  const { translate } = useLocalization();
  const [picker, setPicker] = useState<PickerId>(null);

  const section = useValue(BuildingLensSection$);
  const subCategory = useValue(BuildingLensSubCategory$);
  const sectionList = useValue(BuildingLensSectionList$) ?? [];
  const subCategoryList = useValue(BuildingLensSubCategoryList$) ?? [];
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);

  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const tabLabel = (list: readonly VanillaBuildMenuTab[], id: string) =>
    list.find((tab) => tab.id === id)?.toolTip ?? id;

  const chips = buildFilterChips({
    section: { id: section, label: tabLabel(sectionList, section) },
    subCategory: { id: subCategory, label: tabLabel(subCategoryList, subCategory) },
    facets,
    metricRanges,
  });

  // Breadcrumbs are navigation and render as pickers; everything after them is
  // a filter the player can remove.
  const filterChips = chips.filter((chip) => chip.dimension !== "section" && chip.dimension !== "subCategory");
  const removable = removableChipCount(chips);

  // readonly, because TriggerCommand declares its args that way and the facet
  // and chip commands do not.
  const fire = (command: { method: string; args: readonly any[] }) =>
    trigger(mod.id, command.method, ...command.args);

  const togglePicker = (id: Exclude<PickerId, null>) =>
    setPicker((current) => (current === id ? null : id));

  const renderBreadcrumb = (
    id: Exclude<PickerId, null>,
    text: string,
    active: boolean,
    onClear: (() => void) | null
  ) => (
    <div className={classNames(styles.chip, styles.breadcrumb, active && styles.breadcrumbActive)} key={id}>
      <Button
        className={styles.breadcrumbLabel}
        variant="icon"
        onSelect={() => togglePicker(id)}
        aria-label={text}
        title={text}
      >
        <span className={styles.chipText}>{text}</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </Button>
      {onClear && (
        <Button
          className={styles.chipRemove}
          variant="icon"
          onSelect={onClear}
          aria-label={`${label("Tooltip.LABEL[FindItBuildingMenu.Remove]", "Remove")} ${text}`}
        >
          ×
        </Button>
      )}
    </div>
  );

  const openList = picker === "section" ? sectionList : picker === "subCategory" ? subCategoryList : null;
  const openSelected = picker === "section" ? section : subCategory;

  const choose = (id: string) => {
    fire(picker === "section" ? lensSectionCommand(id) : lensSubCategoryCommand(id));
    setPicker(null);
  };

  const clearAllLabel = label("Tooltip.LABEL[FindItBuildingMenu.ClearFilters]", "Clear filters");
  const allTypesLabel = label("Tooltip.LABEL[FindItBuildingMenu.AllTypes]", "All types");

  return (
    <div className={styles.chipRow}>
      <div className={styles.chips}>
        {renderBreadcrumb("section", tabLabel(sectionList, section), picker === "section", null)}

        {/* Always offered when the section has types, even at "Any": without
            it the only way back to a type would be the vanilla toolbar. */}
        {subCategoryList.length > 0
          && renderBreadcrumb(
            "subCategory",
            subCategory === SUBCATEGORY_ANY ? allTypesLabel : tabLabel(subCategoryList, subCategory),
            picker === "subCategory",
            subCategory === SUBCATEGORY_ANY ? null : () => fire(lensSubCategoryCommand(SUBCATEGORY_ANY))
          )}

        <div className={styles.railSlot}>
          <FilterRail
            facets={facets}
            metricsActive={countActiveMetricRanges(metricRanges as unknown as Record<string, unknown>)}
            onToggleOption={(groupId, optionId) => fire(toggleBuildingLensFacetCommand(groupId, optionId))}
            renderMetrics={() => <BuildingCatalogMetricFilters />}
          />
        </div>

        {filterChips.map((chip) => (
          <Tooltip key={chip.id} tooltip={chip.label}>
            <div className={styles.chip}>
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
          </Tooltip>
        ))}

        {removable > 1 && (
          <Button
            className={styles.clearAll}
            variant="icon"
            onSelect={() => {
              fire(clearBuildingLensFiltersCommand());
              fire(lensSubCategoryCommand(SUBCATEGORY_ANY));
            }}
            aria-label={clearAllLabel}
            title={clearAllLabel}
          >
            {clearAllLabel}
          </Button>
        )}
      </div>

      {openList && (
        // Absolutely positioned, so an open picker costs nothing in layout —
        // the same reason the rail's popovers replaced the drawers.
        <div className={styles.picker}>
          <Scrollable className={styles.pickerList} vertical trackVisibility="scrollable">
            {openList.map((tab) => (
              <Button
                key={tab.id}
                className={classNames(styles.pickerItem, tab.id === openSelected && styles.pickerItemSelected)}
                variant="icon"
                onSelect={() => choose(tab.id)}
                aria-label={tab.toolTip}
              >
                <img className={styles.pickerIcon} src={tab.icon} alt="" aria-hidden="true" />
                <span className={styles.pickerLabel}>{tab.toolTip}</span>
              </Button>
            ))}
          </Scrollable>
        </div>
      )}
    </div>
  );
};
