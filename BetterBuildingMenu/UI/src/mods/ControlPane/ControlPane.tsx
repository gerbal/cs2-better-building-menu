import { trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { memo, useState, type ReactNode } from "react";
import type { Command } from "domain/command";
import { ChipRow } from "mods/ChipRow/ChipRow";
import { FilterRail } from "mods/FilterRail/FilterRail";
import { BuildingCatalogMetricFilters } from "mods/BuildingCatalog/BuildingCatalogMetricFilters";
import { buildFilterChips, removableChipCount } from "domain/filterChips";
import { clearAssetMenuFiltersCommand } from "domain/assetMenuFilterSummary";
import { toggleAssetMenuFacetCommand } from "domain/buildingCatalogFacets";
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
import { ViewModeBar } from "mods/GroupedResults/ViewModeBar";
import { setAssetMenuView } from "domain/assetMenuViewStore";
import { DEFAULT_VIEW_MODE } from "domain/viewModeChoice";
import { GroupList, useGroupOptions } from "mods/Pickers/GroupList";
import { SortList, useSortOptions } from "mods/Pickers/SortList";
import { useViewOptions } from "mods/Pickers/ViewList";
import { useLookRoot } from "mods/useLookRoot";
import {
  AssetMenuFacets$,
  BuildingCatalogMetricRanges$,
  CurrentSearch$,
  SelectedAssetPacks$,
  VanillaSelected$,
  send,
} from "mods/bindings";
import styles from "./controlPane.module.scss";

/** A labelled row whose summary opens a list upward over the pane: the list the top row's popover shows. */
const PickerSummary = ({ label, value, children }: { label: string; value: string; children: (close: () => void) => ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowValue}>
        <div className={styles.picker}>
          <Button
            className={styles.pickerSummary}
            variant="icon"
            onSelect={() => setOpen((shown) => !shown)}
            aria-expanded={open}
            aria-label={`${label} · ${value}`}
          >
            <span className={styles.pickerLabel}>{value}</span>
            {/* U+25BC, not the small U+25BE: the game's font stack has no small
                triangles, so the one mark saying this control opens would be the
                one glyph that would not render. */}
            <span className={styles.caret} aria-hidden="true">▼</span>
          </Button>
          {open && <div className={styles.pickerOptions}>{children(() => setOpen(false))}</div>}
        </div>
      </div>
    </div>
  );
};

/**
 * The asset menu control plane, an option: a column to the right of the build menu, mirroring
 * vanilla's tool-options column, holding everything that acts on the catalog — what narrows it,
 * how it is grouped and ordered, what shape it draws. Its Group and Sort lists are the top row's,
 * so the two homes cannot disagree. It carries the look on its own root.
 */
export const ControlPane = memo(function ControlPane() {
  const { translate } = useLocalization();
  const look = useLookRoot();
  const sort = useSortOptions();
  const group = useGroupOptions();
  const currentSearch = useValue(CurrentSearch$);
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const selectedAssetPacks = useValue(SelectedAssetPacks$) ?? [];
  const vanillaSelected = useValue(VanillaSelected$) ?? false;

  const view = useViewOptions();
  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  const fire = send;

  // Content is ONE axis over three pieces of state, so a click has to find its
  // way back to whichever owns it — two are the game's, and routing there keeps
  // the vanilla row and the rail agreeing. See domain/assetPackSelection.
  const toggleFacetOption = (groupId: string, optionId: string) => {
    if (groupId !== CONTENT_FACET_ID) {
      fire(toggleAssetMenuFacetCommand(groupId, optionId));
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
        fire(toggleAssetMenuFacetCommand(groupId, optionId));
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

  return (
    <div className={classNames(styles.pane, look.className)} style={look.style}>
      {/* Identity first — which menu, which category — above the controls that
          act on it. Here it costs the asset menu no row and is on screen at every
          height the asset menu rests at. */}
      <div className={styles.scope}>
        <ChipRow />
      </div>
      {/* No standing result count here: each grouping heading carries its own,
          and the load-more row says when there is more. */}

      {/* Only while a search is active. The search field is in the asset menu and
          this is the far side of the screen, so naming the query here is the
          one caption that does not restate something already in view. */}
      {currentSearch?.trim() && (
        <div className={styles.searchContext} title={currentSearch}>
          {translate("Tooltip.LABEL[BetterBuildingMenu.AssetMenuSearchResults]", "Results for {0}")
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
                onSelect={() => fire(clearAssetMenuFiltersCommand())}
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
          grouping key first, then the sort within each group, its direction
          beside its name. */}
      <PickerSummary label={label("Tooltip.LABEL[BetterBuildingMenu.GroupBy]", "Group by")} value={group.current}>
        {(close) => <GroupList onPicked={close} />}
      </PickerSummary>
      <PickerSummary label={label("Tooltip.LABEL[BetterBuildingMenu.SortBy]", "Sort by")} value={`${sort.current} ${sort.indicator}`}>
        {(close) => <SortList onPicked={close} />}
      </PickerSummary>

      {/* The only View control in the mod, so the concept has one home
          whichever menu is open rather than a copy inside each content area. */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>
          {label("Tooltip.LABEL[BetterBuildingMenu.ViewMode]", "View")}
        </span>
        <div className={styles.rowValue}>
          <ViewModeBar value={view.options.find((option) => option.selected)?.id ?? DEFAULT_VIEW_MODE} onChange={view.pick} />
        </div>
      </div>

      {/* Back to how the menu opens, in one gesture. It clears the backend's query
          state and the view mode, in the UI's store and in the saved setting alike,
          because a half reset looks reset and behaves otherwise. */}
      <div className={styles.row}>
        <span className={styles.rowLabel} />
        <div className={styles.rowValue}>
          <button
            className={styles.resetButton}
            onClick={() => {
              // The view returns to the mode the menu opens in, by the constant so it
              // cannot drift from it, and "" is "no pick" in the settings, so the next
              // session opens there too.
              setAssetMenuView({ viewMode: DEFAULT_VIEW_MODE });
              send({ method: "SetAssetMenuViewMode", args: [""] });
              // The grouping is the query's; ResetAssetMenu clears it.
              send({ method: "ResetAssetMenu", args: [] });
            }}
          >
            {label("Tooltip.LABEL[BetterBuildingMenu.ResetMenu]", "Reset menu")}
          </button>
        </div>
      </div>
    </div>
  );
});
