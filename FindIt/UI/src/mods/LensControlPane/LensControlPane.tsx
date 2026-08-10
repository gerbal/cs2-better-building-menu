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
import { getBuildingLensSortPresentation } from "domain/buildingLensSortPresentation";
import {
  GROUP_DIMENSIONS,
  defaultGroupDimensionFor,
  groupDimensionLabel,
  isGroupDimension,
  type GroupDimensionId,
} from "domain/buildingGroups";
import { ChipRow } from "mods/ChipRow/ChipRow";
import { FilterRail } from "mods/FilterRail/FilterRail";
import { BuildingCatalogMetricFilters } from "mods/BuildingCatalog/BuildingCatalogMetricFilters";
import { buildFilterChips, removableChipCount } from "domain/filterChips";
import { clearBuildingLensFiltersCommand } from "domain/buildingLensFilterSummary";
import { toggleBuildingLensFacetCommand } from "domain/buildingCatalogFacets";
import { countActiveMetricRanges } from "domain/filterRail";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "domain/buildingLensFilterSummary";
import { ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import type { CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { useLensChoice } from "mods/useLensChoice";
import lock from "images/findit_lock.svg";
import unlock from "images/findit_unlock.svg";
import { useState } from "react";
import styles from "./lensControlPane.module.scss";

const BuildingCatalog$ = bindValue<BuildingCatalogPage>(mod.id, "BuildingCatalog");
const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn");
const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending");
const BuildingLensSection$ = bindValue<string>(mod.id, "BuildingLensSection", "AllBuildings");
const BuildingLensMenuCategories$ = bindValue<unknown[]>(mod.id, "BuildingLensMenuCategories", []);
const ShowZoningHierarchy$ = bindValue<boolean>(mod.id, "ShowZoningHierarchy", false);
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
const IsWindowLocked$ = bindValue<boolean>(mod.id, "IsWindowLocked", false);
const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState | null>(
  mod.id,
  "BuildingCatalogMetricRanges",
  null
);
const BuildingLensZoneFamilies$ = bindValue<string[]>(mod.id, "BuildingLensZoneFamilies", []);

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
  const isWindowLocked = useValue(IsWindowLocked$);
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const zoneFamilies = useValue(BuildingLensZoneFamilies$) ?? [];

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

  const fire = (command: { method: string; args: readonly any[] }) =>
    trigger(mod.id, command.method, ...command.args);

  const familyLabel = (id: string) =>
    translate(`Tooltip.LABEL[FindItBuildingMenu.Zoning_${id}]`, id) ?? id;

  const chips = buildFilterChips({
    zoneFamilies: showZoning ? zoneFamilies.map((id) => ({ id, label: familyLabel(id) })) : null,
    facets,
    metricRanges,
  });

  const clearLabel = label("Tooltip.LABEL[FindItBuildingMenu.ClearFilters]", "Clear filters");

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

      {/* The narrowing controls, moved here from the game's own options bank.
          They were put in that bank because filters belong where the game
          already puts filters, and vanilla's Theme sits there as a label and a
          row of icon buttons — the exact shape a facet dimension wants.
          Left-aligning vanilla's column trio then moved that bank to the screen
          edge, a full panel's width away from the results it narrows, so the
          filters follow the results instead.

          Vanilla's own Theme stays behind in that bank: it is the game's
          control, not ours to relocate. Filters therefore sit on both sides —
          the cost of this move, and the reason the split used to run the other
          way. */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>
          {label("Tooltip.LABEL[FindItBuildingMenu.Filters]", "Filters")}
        </span>
        <div className={styles.rowValue}>
          <FilterRail
            facets={facets}
            metricsActive={countActiveMetricRanges(metricRanges as unknown as Record<string, unknown>)}
            onToggleOption={(groupId, optionId) => fire(toggleBuildingLensFacetCommand(groupId, optionId))}
            renderMetrics={() => <BuildingCatalogMetricFilters />}
          />
        </div>
      </div>

      {/* The record of what the filters did. It comes with them: separating the
          two left each half explaining the other from across the screen. */}
      {chips.length > 0 && (
        <div className={classNames(styles.row, styles.rowChips)}>
          <span className={styles.rowLabel}>
            {label("Tooltip.LABEL[FindItBuildingMenu.ActiveFilters]", "Active")}
          </span>
          <div className={styles.rowValue}>
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

      {/* Panel-level controls, below a rule because they are a different kind
          of thing from the rows above: those decide how the qualifying set is
          presented, these act on the panel itself.

          Both were in the top bar caf59a8 deleted, and both were left with
          nowhere else to go. ToggleLock has no other caller in the UI, and
          neither has SetBuildingLensEnabled — which made the lens a one-way
          door, since the only control that could turn it off was inside the
          bank that stops rendering the moment it is turned on. There is no
          keybinding and no setting for either. */}
      <div className={styles.panelControls}>
        <Button
          className={classNames(styles.panelButton, isWindowLocked && styles.panelButtonOn)}
          variant="icon"
          onSelect={() => trigger(mod.id, "ToggleLock")}
          aria-pressed={isWindowLocked}
          title={label("Tooltip.LABEL[FindItBuildingMenu.LockWindow]", "Lock Window Open")}
          aria-label={label("Tooltip.LABEL[FindItBuildingMenu.LockWindow]", "Lock Window Open")}
        >
          {/* The same two masks the deleted top bar drew, not a glyph: the
              game's font stack has no padlock, and a missing character is the
              one mark that would say nothing at all. */}
          <img className={styles.panelIcon} style={{ maskImage: `url(${isWindowLocked ? lock : unlock})` }} aria-hidden="true" />
        </Button>

        <Button
          className={styles.panelButton}
          variant="icon"
          onSelect={() => trigger(mod.id, "SetBuildingLensEnabled", false)}
          title={label("Tooltip.LABEL[FindItBuildingMenu.DisableBuildingLens]", "Disable building lens")}
          aria-label={label("Tooltip.LABEL[FindItBuildingMenu.DisableBuildingLens]", "Disable building lens")}
        >
          <span className={styles.panelButtonLabel}>
            {label("Tooltip.LABEL[FindItBuildingMenu.DisableBuildingLens]", "Disable building lens")}
          </span>
        </Button>
      </div>
    </div>
  );
};
