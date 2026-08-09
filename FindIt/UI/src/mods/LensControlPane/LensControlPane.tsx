import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import type { BuildingCatalogPage } from "domain/buildingCatalog";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  getCatalogWindowBadge,
  getCatalogWindowSummary,
  nextSortState,
  setSortColumnCommand,
  setSortDescendingCommand,
} from "domain/buildingCatalogContracts";
import { getNumberSeparators } from "domain/buildingLensMetricFormat";
import {
  canToggleBuildingLensHeight,
  isBuildingLensExpanded,
} from "domain/buildingLensLayout";
import { getBuildingLensSortPresentation } from "domain/buildingLensSortPresentation";
import {
  GROUP_DIMENSIONS,
  defaultGroupDimensionFor,
  groupDimensionLabel,
  isGroupDimension,
  type GroupDimensionId,
} from "domain/buildingGroups";
import { ChipRow } from "mods/ChipRow/ChipRow";
import { ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import type { CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { useLensChoice } from "mods/useLensChoice";
import { useState } from "react";
import styles from "./lensControlPane.module.scss";

const BuildingCatalog$ = bindValue<BuildingCatalogPage>(mod.id, "BuildingCatalog");
const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn");
const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending");
const BuildingLensSection$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");
const BuildingLensMenuCategories$ = bindValue<unknown[]>(mod.id, "BuildingLensMenuCategories", []);
const ShowZoningHierarchy$ = bindValue<boolean>(mod.id, "ShowZoningHierarchy", false);
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
const IsExpanded$ = bindValue<boolean>(mod.id, "IsExpanded", false);

/**
 * What the pane takes out of the panel's width: its own 379rem plus the 6rem
 * gap in lensControlPane.module.scss.
 *
 * 379rem, not 253rem. The target is vanilla's tool-side-column, measured at
 * 253 PIXELS, and 1rem is 0.6667px here. Written as 253rem it would draw at
 * two thirds the width and look nearly right — the same units slip that hid in
 * BuildingLensTileSize and in lensToolOptions' row height.
 */
export const LENS_CONTROL_PANE_TOTAL = 385;

const LENS_VIEW_MODE_KEY = "viewMode";
const LENS_GROUP_KEY = "groupBy";

/**
 * The Building Lens control plane.
 *
 * A column to the right of the build menu, mirroring vanilla's tool-options
 * column on the left. The dividing line between the two is what they act on,
 * not who owns them: the left bank holds everything that narrows the set —
 * vanilla's Theme, our filter rail, the active-filter chips — and this pane
 * holds everything that decides how the qualifying set is presented.
 *
 * That line matters because Theme is a filter. Splitting on ownership instead
 * would have put our rail here and left a control doing the same job on the
 * far side of the screen.
 *
 * Why a pane at all: these controls used to live in a band inside the panel
 * that rendered only when it was expanded, so at the strip height the lens
 * rests at there was no count, no sort, no grouping and no view switch at all.
 */
export const LensControlPane = () => {
  const { translate } = useLocalization();
  const page = useValue(BuildingCatalog$);
  // Master replaced paging with a growing window, so "how many" has two halves
  // now: how many are loaded and how many match. The badge shows both while
  // they differ and collapses to one figure once the window covers everything,
  // because "401 / 401" asks the reader to compare two numbers to learn they
  // are the same. The sentence is the tooltip, where it has room.
  const separators = getNumberSeparators(translate);
  const totalCount = page?.totalCount ?? 0;
  const renderedCount = page?.items?.length ?? 0;
  const windowBadge = getCatalogWindowBadge(renderedCount, totalCount, separators);
  const windowSummary = getCatalogWindowSummary(renderedCount, totalCount, separators);
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  const section = useValue(BuildingLensSection$);
  const menuHasCategories = (useValue(BuildingLensMenuCategories$) ?? []).length > 0;
  const showZoning = useValue(ShowZoningHierarchy$);
  const currentSearch = useValue(CurrentSearch$);
  const isExpanded = useValue(IsExpanded$);

  // Height, from the same rule the panel draws itself with.
  const heightState = { isExpanded, section, searchText: currentSearch };
  const expanded = isBuildingLensExpanded(heightState);
  const canToggleHeight = canToggleBuildingLensHeight(heightState);

  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  const [viewModeChoice, setViewModeChoice] = useLensChoice(LENS_VIEW_MODE_KEY, "grid");
  const [chosenGroupBy, setChosenGroupBy] = useLensChoice(LENS_GROUP_KEY, "");
  const groupBy: GroupDimensionId = isGroupDimension(chosenGroupBy)
    ? chosenGroupBy
    : defaultGroupDimensionFor(section, menuHasCategories);

  const sortPresentation = getBuildingLensSortPresentation({ column: sortColumn, descending });
  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const groupByLabel =
    translate(`Tooltip.LABEL[FindItBuildingMenu.GroupBy_${groupBy}]`, groupDimensionLabel(groupBy))
    ?? groupDimensionLabel(groupBy);

  const setSort = (column: SortColumn) => {
    const next = nextSortState({ column: sortColumn, descending }, column);

    // No local echo: the backend owns the order and publishes it back, so
    // mirroring it here would reintroduce a second source of truth.
    for (const command of [
      setSortColumnCommand(next.column),
      setSortDescendingCommand(next.descending),
    ]) {
      trigger(mod.id, command.method, ...command.args);
    }
  };

  return (
    <div className={styles.pane}>
      {/* Identity first: which menu, which section, which category — "what am
          I looking at", above the count of what that scope holds and the
          controls that reorder it. It was gated on `expanded` in the top bar,
          so the answer was missing at the height the lens rests at; here it
          costs the panel no row and is always on screen. */}
      <div className={styles.scope}>
        <ChipRow />
      </div>
      <div className={styles.countRow}>
        <div className={styles.countLine} title={windowSummary} aria-label={windowSummary}>
          <span className={styles.count}>{windowBadge}</span>
          <span className={styles.countUnit}>
            {label("Tooltip.LABEL[FindItBuildingMenu.Buildings]", "buildings")}
          </span>
        </div>
        {/* Only while a search is active. A static caption here would cost a
            line on every frame to say something the panel already implies;
            naming the query the count is counting is the informative case. */}
        {currentSearch?.trim() && (
          <div className={styles.searchContext} title={currentSearch}>
            {translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLensSearchResults]", "Results for {0}")
              ?.replace("{0}", currentSearch)}
          </div>
        )}
      </div>

      {/* The zoning view is a different renderer over a different catalog:
          there are no rows to order, group or switch the shape of. The count
          still means something, so it stays above. */}
      {!showZoning && (
        <>
          <div className={styles.row}>
            <span className={styles.rowLabel}>
              {label("Tooltip.LABEL[FindItBuildingMenu.GroupBy]", "Group by")}
            </span>
            <div className={styles.rowValue}>
              <div className={styles.picker}>
                <Button
                  className={styles.pickerSummary}
                  variant="icon"
                  onSelect={() => setGroupPickerOpen((open) => !open)}
                  aria-expanded={groupPickerOpen}
                  title={groupByLabel}
                >
                  <span className={styles.pickerLabel}>{groupByLabel}</span>
                  {/* U+25BC, not the small U+25BE: the game's font stack has no
                      small triangles, so the one mark saying this control opens
                      would be the one glyph that would not render. */}
                  <span className={styles.caret} aria-hidden="true">▼</span>
                </Button>
                {groupPickerOpen && (
                  <div className={styles.pickerOptions}>
                    {GROUP_DIMENSIONS.map((dimension) => {
                      const optionLabel = translate(
                        `Tooltip.LABEL[FindItBuildingMenu.GroupBy_${dimension.id}]`,
                        dimension.label
                      ) ?? dimension.label;

                      return (
                        <Button
                          key={dimension.id}
                          className={classNames(
                            styles.pickerOption,
                            dimension.id === groupBy && styles.pickerOptionSelected
                          )}
                          variant="icon"
                          onSelect={() => {
                            setChosenGroupBy(dimension.id);
                            setGroupPickerOpen(false);
                          }}
                          aria-label={optionLabel}
                        >
                          <span>{optionLabel}</span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>
              {label("Tooltip.LABEL[FindItBuildingMenu.SortBy]", "Sort by")}
            </span>
            <div className={styles.rowValue}>
              <div className={styles.picker}>
                <Button
                  className={styles.pickerSummary}
                  variant="icon"
                  onSelect={() => setSortPickerOpen((open) => !open)}
                  aria-expanded={sortPickerOpen}
                  title={sortPresentation.compact.label}
                >
                  <span className={styles.pickerLabel}>{sortPresentation.compact.label}</span>
                  <span className={styles.caret} aria-hidden="true">▼</span>
                </Button>
                {sortPickerOpen && (
                  <div className={styles.pickerOptions}>
                    {sortPresentation.expanded.map((option) => (
                      <Button
                        key={option.key}
                        className={classNames(
                          styles.pickerOption,
                          option.selected && styles.pickerOptionSelected
                        )}
                        variant="icon"
                        onSelect={() => {
                          setSort(option.key);
                          setSortPickerOpen(false);
                        }}
                        aria-label={option.label}
                      >
                        <span>{option.label}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              {/* Its own button, deliberately. As a span inside the summary
                  above, the one gesture that reads as "reverse this" was the
                  one that could not: the click bubbled and opened the menu. */}
              <Button
                className={styles.direction}
                variant="icon"
                onSelect={() => setSort(sortColumn)}
                aria-label={label("Tooltip.LABEL[FindItBuildingMenu.ReverseSort]", "Reverse sort")}
                title={label("Tooltip.LABEL[FindItBuildingMenu.ReverseSort]", "Reverse sort")}
              >
                <span aria-hidden="true">{sortPresentation.compact.indicator}</span>
              </Button>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>
              {label("Tooltip.LABEL[FindItBuildingMenu.ViewMode]", "View")}
            </span>
            <div className={styles.rowValue}>
              <ViewModeBar
                value={viewModeChoice as CatalogViewMode}
                onChange={(next) => setViewModeChoice(next)}
              />
            </div>
          </div>
        </>
      )}

      {/* Height, and deliberately outside the block above.
          Group, sort and view describe rows the zoning hierarchy does not
          have; how tall the panel is applies to it just as much.

          This control exists because caf59a8 removed the panel's top bar in
          lens mode as duplicated chrome, and the expand toggle went with it —
          but unlike search, close and the count, nothing else could do its job.
          SetIsExpanded had exactly one caller, so the lens was left resting at
          the strip with no way to grow it, while the automatic floor's own
          comment still promised "a manual expand always wins". This is that
          manual expand, in the column the other relocated controls moved to. */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>
          {label("Tooltip.LABEL[FindItBuildingMenu.PanelHeight]", "Height")}
        </span>
        <div className={styles.rowValue}>
          <Button
            className={classNames(styles.heightToggle, expanded && styles.heightToggleOn)}
            variant="icon"
            disabled={!canToggleHeight}
            onSelect={() => canToggleHeight && trigger(mod.id, "SetIsExpanded", !isExpanded)}
            aria-pressed={expanded}
            title={
              canToggleHeight
                ? label(
                    expanded
                      ? "Tooltip.LABEL[FindItBuildingMenu.Shrink]"
                      : "Tooltip.LABEL[FindItBuildingMenu.Expand]",
                    expanded ? "Shrink Panel" : "Expand Panel",
                  )
                : label(
                    "Tooltip.LABEL[FindItBuildingMenu.PanelHeightAutomatic]",
                    "Kept tall while the results are not narrowed to one category",
                  )
            }
          >
            <span className={styles.heightLabel}>
              {label(
                expanded
                  ? "Tooltip.LABEL[FindItBuildingMenu.Shrink]"
                  : "Tooltip.LABEL[FindItBuildingMenu.Expand]",
                expanded ? "Shrink Panel" : "Expand Panel",
              )}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
