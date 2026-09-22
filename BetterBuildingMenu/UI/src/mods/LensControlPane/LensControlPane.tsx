import { trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import type { SortColumn } from "domain/buildingCatalogContracts";
import type { Command } from "domain/command";
import { getBuildingLensSortPresentation } from "domain/buildingLensSortPresentation";
import {
  groupDimensionsFor,
  groupDimensionLabel,
  type GroupDimensionId,
} from "domain/buildingGroups";
import { ChipRow } from "mods/ChipRow/ChipRow";
import { FilterRail } from "mods/FilterRail/FilterRail";
import { BuildingCatalogMetricFilters } from "mods/BuildingCatalog/BuildingCatalogMetricFilters";
import { buildFilterChips, removableChipCount } from "domain/filterChips";
import { clearBuildingLensFiltersCommand } from "domain/buildingLensFilterSummary";
import { toggleBuildingLensFacetCommand } from "domain/buildingCatalogFacets";
import {
  ASSET_PACK_TRIGGER_GROUP,
  ASSET_PACK_TRIGGER_NAME,
  CONTENT_FACET_ID,
  VANILLA_TRIGGER_NAME,
  contentOptionKind,
  isContentFacetCommand,
  toggleAssetPack,
} from "domain/assetPackSelection";
import { countActiveMetricRanges, metricRangesFromState } from "domain/buildingCatalogRanges";
import { DEFAULT_VIEW_MODE, ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import type { CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { setLensView } from "domain/lensViewStore";
import { useLensView } from "mods/useLensView";
import { memo, useState } from "react";
import { BUILDING_LENS_CONTROL_PANE_TOTAL } from "domain/buildingLensLayout";
import {
  BuildingCatalog$,
  BuildingCatalogGroupBy$,
  BuildingCatalogMetricRanges$,
  BuildingCatalogSortColumn$,
  BuildingCatalogSortDescending$,
  BuildingLensFacets$,
  BuildingLensGroupDimensions$,
  CurrentSearch$,
  SelectedAssetPacks$,
  VanillaSelected$,
  send,
  sendSort,
} from "mods/bindings";
import styles from "./lensControlPane.module.scss";

/**
 * What the pane takes out of the panel's width: its own width plus the gap in
 * lensControlPane.module.scss. The figure is in rem, and a rem is not a pixel
 * here, so a pixel target copied straight in draws two thirds the width.
 */
export const LENS_CONTROL_PANE_TOTAL = BUILDING_LENS_CONTROL_PANE_TOTAL;

/**
 * The Building Lens control plane: a column to the right of the build menu,
 * mirroring vanilla's tool-options column, holding everything that acts on the
 * catalog — what narrows it, how it is grouped and ordered, what shape it draws.
 */
export const LensControlPane = memo(function LensControlPane() {
  const { translate } = useLocalization();
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  // Only for which sort fields can act on these results; see BuildingCatalogPage.
  const catalogPage = useValue(BuildingCatalog$);
  // The dimension ids that can act on the current menu. C# judges it over the
  // whole menu set; an empty list means it has not said yet.
  const offeredDimensions = useValue(BuildingLensGroupDimensions$) ?? [];
  // The fields that can actually reorder these results. The picker drops the
  // rest rather than offering a control that cannot act.
  const reorderableSortColumns = catalogPage?.reorderableSortColumns ?? [];
  const currentSearch = useValue(CurrentSearch$);
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const selectedAssetPacks = useValue(SelectedAssetPacks$) ?? [];
  const vanillaSelected = useValue(VanillaSelected$) ?? false;

  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  const viewModeChoice = useLensView((view) => view.viewMode) || DEFAULT_VIEW_MODE;
  const setViewModeChoice = (next: string): void => setLensView({ viewMode: next });
  // Resolved on the C# side: the player's choice, or the menu's default.
  const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;

  const sortPresentation = getBuildingLensSortPresentation(
    { column: sortColumn, descending },
    reorderableSortColumns
  );
  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const groupByLabel =
    translate(`Tooltip.LABEL[BetterBuildingMenu.GroupBy_${groupBy}]`, groupDimensionLabel(groupBy))
    ?? groupDimensionLabel(groupBy);

  const fire = send;

  // Content is ONE axis over three pieces of state, so a click has to find its
  // way back to whichever owns it — two are the game's, and routing there keeps
  // the vanilla row and the rail agreeing. See domain/assetPackSelection.
  const toggleFacetOption = (groupId: string, optionId: string) => {
    if (groupId !== CONTENT_FACET_ID) {
      fire(toggleBuildingLensFacetCommand(groupId, optionId));
      return;
    }

    switch (contentOptionKind(optionId)) {
      case "pack":
        trigger(
          ASSET_PACK_TRIGGER_GROUP,
          ASSET_PACK_TRIGGER_NAME,
          toggleAssetPack(selectedAssetPacks, optionId)
        );
        return;
      case "vanilla":
        trigger(ASSET_PACK_TRIGGER_GROUP, VANILLA_TRIGGER_NAME, !vanillaSelected);
        return;
      default:
        fire(toggleBuildingLensFacetCommand(groupId, optionId));
    }
  };

  // A chip is the same toggle wearing a different hat, so it takes the same
  // route: sending a pack removal through `fire` would address a field we do
  // not own, leaving the chip un-removable.
  const removeChip = (command: Command) => {
    if (isContentFacetCommand(command)) {
      toggleFacetOption(CONTENT_FACET_ID, String(command.args[1]));
      return;
    }

    fire(command);
  };

  const chips = buildFilterChips({
    facets,
    metricRanges,
  });

  const clearLabel = label("Tooltip.LABEL[BetterBuildingMenu.ClearFilters]", "Clear filters");

  const setSort = (column: SortColumn) => sendSort({ column: sortColumn, descending }, column);

  return (
    <div className={styles.pane}>
      {/* Identity first — which menu, which category — above the controls that
          act on it. Here it costs the panel no row and is on screen at every
          height the lens rests at. */}
      <div className={styles.scope}>
        <ChipRow />
      </div>
      {/* No standing result count here: each grouping heading carries its own,
          and the load-more row says when there is more. */}

      {/* Only while a search is active. The search field is in the panel and
          this is the far side of the screen, so naming the query here is the
          one caption that does not restate something already in view. */}
      {currentSearch?.trim() && (
        <div className={styles.searchContext} title={currentSearch}>
          {translate("Tooltip.LABEL[BetterBuildingMenu.BuildingLensSearchResults]", "Results for {0}")
            ?.replace("{0}", currentSearch)}
        </div>
      )}

      {/* The narrowing controls sit beside the results they narrow, not in the
          game's options bank at the screen edge. Vanilla's own Theme stays
          there, being the game's control, so filters do sit on both sides. */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>
          {label("Tooltip.LABEL[BetterBuildingMenu.Filters]", "Filters")}
        </span>
        <div className={styles.rowValue}>
          <FilterRail
            facets={facets}
            metricsActive={countActiveMetricRanges(metricRangesFromState(metricRanges))}
            onToggleOption={toggleFacetOption}
            renderMetrics={() => <BuildingCatalogMetricFilters />}
          />
        </div>
      </div>

      {/* The record of what the filters did, beside them: apart, each half
          explains the other from across the screen. */}
      {chips.length > 0 && (
        <div className={classNames(styles.row, styles.rowChips)}>
          <span className={styles.rowLabel}>
            {label("Tooltip.LABEL[BetterBuildingMenu.ActiveFilters]", "Active")}
          </span>
          <div className={styles.rowValue}>
            {chips.map((chip) => (
              <div className={styles.chip} key={chip.id}>
                <span className={styles.chipText}>{chip.label}</span>
                <Button
                  className={styles.chipRemove}
                  variant="icon"
                  onSelect={() => chip.remove && removeChip(chip.remove)}
                  aria-label={`${label("Tooltip.LABEL[BetterBuildingMenu.Remove]", "Remove")} ${chip.label}`}
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

      {/* The two controls that reorder rows, in the order they apply: the
          grouping key first, then the sort within each group. */}
      {(
        <>
          <div className={styles.row}>
            <span className={styles.rowLabel}>
              {label("Tooltip.LABEL[BetterBuildingMenu.GroupBy]", "Group by")}
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
                    {groupDimensionsFor(offeredDimensions).map((dimension) => {
                      const optionLabel = translate(
                        `Tooltip.LABEL[BetterBuildingMenu.GroupBy_${dimension.id}]`,
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
                            send({ method: "SetBuildingCatalogGroupBy", args: [dimension.id] });
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
              {label("Tooltip.LABEL[BetterBuildingMenu.SortBy]", "Sort by")}
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
              {/* Its own button, deliberately: inside the summary above, a
                  click on it bubbles and opens the picker instead of
                  reversing the order. */}
              <Button
                className={styles.direction}
                variant="icon"
                onSelect={() => setSort(sortColumn)}
                aria-label={label("Tooltip.LABEL[BetterBuildingMenu.ReverseSort]", "Reverse sort")}
                title={label("Tooltip.LABEL[BetterBuildingMenu.ReverseSort]", "Reverse sort")}
              >
                <span aria-hidden="true">{sortPresentation.compact.indicator}</span>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* The only View control in the mod, so the concept has one home
          whichever menu is open rather than a copy inside each content area. */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>
          {label("Tooltip.LABEL[BetterBuildingMenu.ViewMode]", "View")}
        </span>
        <div className={styles.rowValue}>
          <ViewModeBar
            value={viewModeChoice as CatalogViewMode}
            onChange={(next) => setViewModeChoice(next)}
          />
        </div>
      </div>

      {/* Back to how the menu opens, in one gesture. It clears BOTH halves —
          the backend's query state and the view mode held on this side —
          because a half reset looks reset and behaves otherwise. */}
      <div className={styles.row}>
        <span className={styles.rowLabel} />
        <div className={styles.rowValue}>
          <button
            className={styles.resetButton}
            onClick={() => {
              // The grouping is the query's; ResetBuildingLensMenu clears it.
              // Back to the mode the lens opens in via the constant, not to a
              // named one, so this cannot drift from the default.
              setViewModeChoice(DEFAULT_VIEW_MODE);
              send({ method: "ResetBuildingLensMenu", args: [] });
            }}
          >
            {label("Tooltip.LABEL[BetterBuildingMenu.ResetMenu]", "Reset menu")}
          </button>
        </div>
      </div>
    </div>
  );
});
