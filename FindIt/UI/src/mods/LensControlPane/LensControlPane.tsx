import { bindValue, trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import mod from "../../../mod.json";
import type { SortColumn } from "domain/buildingCatalogContracts";
import {
  nextSortState,
  setSortColumnCommand,
  setSortDescendingCommand,
} from "domain/buildingCatalogContracts";
import { getBuildingLensSortPresentation } from "domain/buildingLensSortPresentation";
import {
  groupDimensionsFor,
  defaultGroupDimensionFor,
  isEducationMenu,
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
import {
  ASSET_PACK_TRIGGER_GROUP,
  ASSET_PACK_TRIGGER_NAME,
  CONTENT_FACET_ID,
  VANILLA_TRIGGER_NAME,
  contentOptionKind,
  isContentFacetCommand,
  toggleAssetPack,
} from "domain/assetPackSelection";
import type { ToolbarEntity } from "domain/toolbarEntity";
import { countActiveMetricRanges } from "domain/filterRail";
import type { BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { BuildingLensMetricRangeState } from "domain/buildingLensFilterSummary";
import { ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import type { CatalogViewMode } from "mods/GroupedResults/GroupedResults";
import { useLensChoice } from "mods/useLensChoice";
import { useState } from "react";
import { BUILDING_LENS_CONTROL_PANE_TOTAL } from "domain/buildingLensLayout";
import styles from "./lensControlPane.module.scss";

const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn");
const BuildingCatalogSortDescending$ = bindValue<boolean>(mod.id, "BuildingCatalogSortDescending");
const BuildingLensMenu$ = bindValue<string>(mod.id, "BuildingLensMenu", "");
const BuildingLensStripAxis$ = bindValue<string>(mod.id, "BuildingLensStripAxis", "");
const BuildingLensMenuCategories$ = bindValue<unknown[]>(mod.id, "BuildingLensMenuCategories", []);
const CurrentSearch$ = bindValue<string>(mod.id, "CurrentSearch");
const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
// Read only to decide which grouping options can act on THIS menu. The window
// is a page rather than the whole result, which is the right trade: a
// dimension that splits nothing across the hundred entries on screen is one
// the player cannot see working either.
const BuildingCatalogPage$ = bindValue<{ items?: unknown[]; reorderableSortColumns?: string[] } | null>(
  mod.id,
  "BuildingCatalog",
  null
);
const BuildingCatalogMetricRanges$ = bindValue<BuildingLensMetricRangeState | null>(
  mod.id,
  "BuildingCatalogMetricRanges",
  null
);
// The GAME's pack selection, not one of ours: read so the rail can show what is
// ticked, written so a rail toggle lands in the same place the vanilla Pack row
// puts it. See domain/assetPackSelection.
const SelectedAssetPacks$ = bindValue<ToolbarEntity[]>("toolbar", "selectedAssetPacks", []);
const VanillaSelected$ = bindValue<boolean>("toolbar", "vanillaSelected", false);

/**
 * What the pane takes out of the panel's width: its own 379rem plus the 6rem
 * gap in lensControlPane.module.scss.
 *
 * 379rem, not 253rem. The target is vanilla's tool-side-column, measured at
 * 253 PIXELS, and 1rem is 0.6667px here. Written as 253rem it would draw at
 * two thirds the width and look nearly right — the same units slip that hid in
 * BuildingLensTileSize and in lensToolOptions' row height.
 */
export const LENS_CONTROL_PANE_TOTAL = BUILDING_LENS_CONTROL_PANE_TOTAL;

const LENS_VIEW_MODE_KEY = "viewMode";
const LENS_GROUP_KEY = "groupBy";

/**
 * The Building Lens control plane.
 *
 * A column to the right of the build menu, mirroring vanilla's tool-options
 * column on the left, and holding everything that acts on the catalog: what
 * narrows it, how it is grouped and ordered, and what shape it is drawn in.
 *
 * The division used to run the other way. Filters lived in vanilla's own
 * options bank, on the argument that Theme is a filter and splitting on
 * ownership would put two controls doing one job on opposite sides. That held
 * until left-aligning vanilla's column trio moved the bank to the screen edge,
 * a full panel's width from the results it narrows — so the filters followed
 * the results, and Theme is the control now stranded on the far side.
 *
 * Why a pane at all: these controls used to live in a band inside the panel
 * that rendered only when it was expanded, so at the strip height the lens
 * rests at there was no sort, no grouping and no view switch at all.
 */
export const LensControlPane = () => {
  const { translate } = useLocalization();
  const sortColumn = useValue(BuildingCatalogSortColumn$) ?? "Name";
  const descending = useValue(BuildingCatalogSortDescending$) ?? false;
  const menu = useValue(BuildingLensMenu$) ?? "";
  const catalogPage = useValue(BuildingCatalogPage$);
  const catalogEntries = (catalogPage?.items ?? []) as never[];
  // cm-ddw3: the fields that can actually reorder these results. The picker
  // drops the rest rather than offering a control that cannot act.
  const reorderableSortColumns = catalogPage?.reorderableSortColumns ?? [];
  const menuHasCategories = (useValue(BuildingLensMenuCategories$) ?? []).length > 0;
  const stripAxis = useValue(BuildingLensStripAxis$) ?? "";
  const currentSearch = useValue(CurrentSearch$);
  const facets = useValue(BuildingLensFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const selectedAssetPacks = useValue(SelectedAssetPacks$) ?? [];
  const vanillaSelected = useValue(VanillaSelected$) ?? false;

  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  const [viewModeChoice, setViewModeChoice] = useLensChoice(LENS_VIEW_MODE_KEY, "grid");
  const [chosenGroupBy, setChosenGroupBy] = useLensChoice(LENS_GROUP_KEY, "");
  const groupBy: GroupDimensionId = isGroupDimension(chosenGroupBy)
    ? chosenGroupBy
    : defaultGroupDimensionFor(menuHasCategories, stripAxis, isEducationMenu(menu));

  const sortPresentation = getBuildingLensSortPresentation(
    { column: sortColumn, descending },
    reorderableSortColumns
  );
  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const groupByLabel =
    translate(`Tooltip.LABEL[FindItBuildingMenu.GroupBy_${groupBy}]`, groupDimensionLabel(groupBy))
    ?? groupDimensionLabel(groupBy);

  const fire = (command: { method: string; args: readonly any[] }) =>
    trigger(mod.id, command.method, ...command.args);

  // Content is ONE axis over three pieces of state, so a click has to find its
  // way back to whichever owns it. Two of them are the game's — a pack goes to
  // its pack selection and base game to its Vanilla toggle, which is what keeps
  // the vanilla row and the rail showing the same thing. Only a pack-less DLC
  // is ours to filter. See domain/assetPackSelection.
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
  // route. Sending a pack removal through `fire` would address a field that no
  // longer exists, and the chip would sit there un-removable.
  const removeChip = (command: { method: string; args: readonly any[] }) => {
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
      {/* Identity first: which menu, which category — "what am
          I looking at", above the count of what that scope holds and the
          controls that reorder it. It was gated on `expanded` in the top bar,
          so the answer was missing at the height the lens rests at; here it
          costs the panel no row and is always on screen. */}
      <div className={styles.scope}>
        <ChipRow />
      </div>
      {/* The result count used to lead the pane — master's window badge, "100 /
          401 buildings", moved here when the toolbar band it lived in was
          deleted. It is gone: the grouping headings each carry their own count,
          the load-more button says when there is more, and a standing figure at
          the head of the column was a line spent on a number nothing was
          asking. */}

      {/* The search context stays, and only while a search is active. The
          search field is in the panel and this is the far side of the screen,
          so naming the query here is the one caption that is not restating
          something already in view. */}
      {currentSearch?.trim() && (
        <div className={styles.searchContext} title={currentSearch}>
          {translate("Tooltip.LABEL[FindItBuildingMenu.BuildingLensSearchResults]", "Results for {0}")
            ?.replace("{0}", currentSearch)}
        </div>
      )}

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
            onToggleOption={toggleFacetOption}
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
                  onSelect={() => chip.remove && removeChip(chip.remove)}
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
      {(
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
                    {groupDimensionsFor(menu, catalogEntries).map((dimension) => {
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
        </>
      )}

      {/* View lives HERE for both surfaces. The zoning view used to draw its
          own copy of this control inside the content area, so one concept had
          two homes depending on which menu you opened — reported from play as
          "the UI is inconsistent between the zoning and other views".

          Group by and Sort by stay gated above: they genuinely do not act on
          the zoning renderer, which has its own family/density hierarchy and no
          rows to order. Drawing them here would be drawing controls that cannot
          act, which is the other half of the same report. They come back when
          zones become catalog rows.

          Table is omitted for zoning because there is no table renderer for it;
          the omission moves with the control rather than being re-stated. */}
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

      {/* Back to how the menu opens. A menu accumulates a tab, a level, a
          search, a sort, a set of facets, a grouping and a view mode, and
          undoing them meant finding each control and remembering what it had
          been — a state the player could reach and not leave.

          It clears BOTH halves: the query state is the backend's, the grouping
          and view mode are lens choices held on this side, and a reset that
          dropped only one would leave the menu looking reset and behaving
          otherwise. */}
      <div className={styles.row}>
        <span className={styles.rowLabel} />
        <div className={styles.rowValue}>
          <button
            className={styles.resetButton}
            onClick={() => {
              setChosenGroupBy("");
              setViewModeChoice("grid");
              trigger(mod.id, "ResetBuildingLensMenu");
            }}
          >
            {label("Tooltip.LABEL[FindItBuildingMenu.ResetMenu]", "Reset menu")}
          </button>
        </div>
      </div>

      {/* NO panel-level control row. It held three buttons and each was a
          different kind of wrong for a build menu.

          LOCK WINDOW OPEN could not act from here. `_IsWindowLocked` is read in
          exactly two places, `LegacyGridVisible` and the `SetLensMenuOpen`
          guard, and both are about the LEGACY panel — which
          `(_ShowFindItPanel || _IsWindowLocked) && !_BuildingLensEnabled` hides
          for as long as the lens is up. So the button changed a flag whose only
          effects were invisible from where it was drawn.

          CLOSE had no counterpart in the thing this menu stands in for. Vanilla
          draws no X on its asset menu; you press the toolbar icon again. The
          argument for adding one was that the second press is "obvious once you
          know, invisible until then" — true, and an argument for teaching the
          vanilla gesture rather than for growing a control vanilla does not
          have.

          DISABLE BUILDING LENS did not survive its own next click. The comment
          here used to say removing it would make the lens a one-way door; that
          was already false. The toolbar-menu handler sets
          `_BuildingLensEnabled.Value = true` on every menu it resolves
          (Bindings.cs:161), and since cm-e98i every menu resolves, so the flag
          came back the moment the player opened anything. A switch that undoes
          itself on the next click is not an escape hatch.

          And there should be no off at all. The lens REPLACES vanilla's build
          menu; it is not an alternative view of it. `_BuildingLensEnabled` is
          a latch left from when it was opt-in — false at boot, set true at
          three sites the moment any menu resolves, and now reachable as false
          only before the player has opened anything. Giving that an Options
          setting would be building a switch for a state the product does not
          have. */}
    </div>
  );
};
