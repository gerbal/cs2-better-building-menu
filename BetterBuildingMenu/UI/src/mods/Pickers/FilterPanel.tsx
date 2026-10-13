import { trigger, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import { Button } from "cs2/ui";
import classNames from "classnames";

import { clearAssetMenuFiltersCommand } from "domain/assetMenuFilterSummary";
import {
  ASSET_PACK_TRIGGER_GROUP,
  ASSET_PACK_TRIGGER_NAME,
  CONTENT_FACET_ID,
  VANILLA_TRIGGER_NAME,
  contentOptionKind,
  isContentFacetCommand,
  toggleAssetPack,
} from "domain/assetPackSelection";
import { toggleAssetMenuFacetCommand } from "domain/buildingCatalogFacets";
import { countActiveMetricRanges, metricRangesFromState } from "domain/buildingCatalogRanges";
import type { Command } from "domain/command";
import { buildFilterChips, removableChipCount, type FilterChip } from "domain/filterChips";
import { BuildingCatalogMetricFilters } from "mods/BuildingCatalog/BuildingCatalogMetricFilters";
import { AssetMenuFacets$, BuildingCatalogMetricRanges$, SelectedAssetPacks$, VanillaSelected$, send } from "mods/bindings";
import { FilterRail } from "mods/FilterRail/FilterRail";
import styles from "./filterPanel.module.scss";

/** A chip for each filter on, from the facets and the ranges C# publishes. */
export function useFilterChips(): FilterChip[] {
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);

  return buildFilterChips({ facets, metricRanges });
}

/**
 * Where a filter's click goes. Content is ONE axis over three pieces of state, so a click has to
 * find its way back to whichever owns it — two are the game's, and routing there keeps the vanilla
 * row and the rail agreeing. See domain/assetPackSelection.
 */
function useFilterRouting(): { toggle: (groupId: string, optionId: string) => void; remove: (command: Command) => void } {
  const selectedAssetPacks = useValue(SelectedAssetPacks$) ?? [];
  const vanillaSelected = useValue(VanillaSelected$) ?? false;

  const toggle = (groupId: string, optionId: string) => {
    if (groupId !== CONTENT_FACET_ID) {
      send(toggleAssetMenuFacetCommand(groupId, optionId));
      return;
    }

    switch (contentOptionKind(optionId)) {
      case "pack":
        trigger(ASSET_PACK_TRIGGER_GROUP, ASSET_PACK_TRIGGER_NAME, toggleAssetPack(selectedAssetPacks, optionId));
        return;
      case "vanilla":
        trigger(ASSET_PACK_TRIGGER_GROUP, VANILLA_TRIGGER_NAME, !vanillaSelected);
        return;
      default:
        send(toggleAssetMenuFacetCommand(groupId, optionId));
    }
  };

  // A chip is the same toggle wearing a different hat, so it takes the same
  // route: sending a pack removal through `send` would address a field we do
  // not own, leaving the chip un-removable.
  const remove = (command: Command) => {
    if (isContentFacetCommand(command)) {
      toggle(CONTENT_FACET_ID, String(command.args[1]));
      return;
    }

    send(command);
  };

  return { toggle, remove };
}

/** The record of what the filters did: a chip for each filter on, each removable, and Clear filters once two are. */
export const FilterChips = ({ className }: { className?: string }) => {
  const { translate } = useLocalization();
  const chips = useFilterChips();
  const { remove } = useFilterRouting();
  const label = (key: string, fallback: string) => translate(key, fallback) ?? fallback;

  if (chips.length === 0) return null;

  const removeLabel = label("Tooltip.LABEL[BetterBuildingMenu.Remove]", "Remove");
  const clearLabel = label("Tooltip.LABEL[BetterBuildingMenu.ClearFilters]", "Clear filters");

  return (
    <div className={classNames(styles.chips, className)}>
      {chips.map((chip) => (
        <div className={styles.chip} key={chip.id}>
          <span className={styles.chipText}>{chip.label}</span>
          <Button
            className={styles.chipRemove}
            variant="icon"
            onSelect={() => chip.remove && remove(chip.remove)}
            aria-label={`${removeLabel} ${chip.label}`}
          >
            ×
          </Button>
        </div>
      ))}
      {removableChipCount(chips) > 1 && (
        <Button className={styles.clearAll} variant="icon" onSelect={() => send(clearAssetMenuFiltersCommand())} aria-label={clearLabel}>
          {clearLabel}
        </Button>
      )}
    </div>
  );
};

export interface FilterPanelProps {
  /** Told each time one of the rail's dropdowns opens or closes: the FILTER popover stays open meanwhile. */
  onDropdownToggle?: (open: boolean) => void;
  /** Draw the chips under the rail. The control pane draws them in a row of their own. */
  chips?: boolean;
}

/** FILTER's list, in its popover or the control pane: the rail of the game's dropdowns, then the chips. */
export const FilterPanel = ({ onDropdownToggle, chips = true }: FilterPanelProps) => {
  const facets = useValue(AssetMenuFacets$);
  const metricRanges = useValue(BuildingCatalogMetricRanges$);
  const { toggle } = useFilterRouting();

  return (
    <div className={styles.panel}>
      <FilterRail
        facets={facets}
        metricsActive={countActiveMetricRanges(metricRangesFromState(metricRanges))}
        onToggleOption={toggle}
        onDropdownToggle={onDropdownToggle}
        renderMetrics={() => <BuildingCatalogMetricFilters />}
      />
      {chips && <FilterChips className={styles.underRail} />}
    </div>
  );
};
